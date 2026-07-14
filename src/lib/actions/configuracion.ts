"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { esAdmin } from "@/lib/auth-guard";
import { CLAVE_BODEGA_LAT, CLAVE_BODEGA_LNG } from "@/lib/configuracion";
import { resolverUbicacion } from "@/lib/actions/rentas";

export type ConfigFormState = { ok?: string; error?: string } | undefined;

const SOLO_ADMIN: ConfigFormState = {
  error: "Solo el administrador puede modificar la configuración.",
};

function precioValido(v: FormDataEntryValue | null): number | null {
  const n = Number(String(v ?? "").trim());
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// ---------- Precios por modelo ----------

export async function guardarPrecios(
  _prev: ConfigFormState,
  formData: FormData,
): Promise<ConfigFormState> {
  if (!(await esAdmin())) return SOLO_ADMIN;

  const modelos = await prisma.modeloEquipo.findMany({
    select: { id: true, nombre: true },
  });

  const cambios: { id: string; precioDia: number; precioDia3Mas: number | null }[] = [];
  for (const m of modelos) {
    const precioDia = precioValido(formData.get(`precioDia-${m.id}`));
    if (precioDia === null || precioDia === 0) {
      return { error: `Precio por día inválido para ${m.nombre}.` };
    }
    const crudo3Mas = String(formData.get(`precioDia3Mas-${m.id}`) ?? "").trim();
    let precioDia3Mas: number | null = null;
    if (crudo3Mas !== "") {
      precioDia3Mas = precioValido(crudo3Mas);
      if (precioDia3Mas === null || precioDia3Mas === 0) {
        return { error: `Precio 3+ inválido para ${m.nombre}.` };
      }
    }
    cambios.push({ id: m.id, precioDia, precioDia3Mas });
  }

  await prisma.$transaction(
    cambios.map((c) =>
      prisma.modeloEquipo.update({
        where: { id: c.id },
        data: { precioDia: c.precioDia, precioDia3Mas: c.precioDia3Mas },
      }),
    ),
  );

  revalidatePath("/configuracion");
  revalidatePath("/inventario");
  return { ok: "Precios guardados. Las rentas existentes conservan su precio (snapshot)." };
}

// ---------- Tarifa de domicilio por km ----------

export async function guardarTarifas(
  _prev: ConfigFormState,
  formData: FormData,
): Promise<ConfigFormState> {
  if (!(await esAdmin())) return SOLO_ADMIN;

  const tarifas = await prisma.zonaEnvio.findMany({ select: { id: true, kmMax: true } });
  const cambios: { id: string; costo: number }[] = [];
  for (const t of tarifas) {
    const costo = precioValido(formData.get(`costo-${t.id}`));
    if (costo === null) return { error: `Costo inválido para el km ${t.kmMax}.` };
    cambios.push({ id: t.id, costo });
  }

  await prisma.$transaction(
    cambios.map((c) =>
      prisma.zonaEnvio.update({ where: { id: c.id }, data: { costo: c.costo } }),
    ),
  );

  revalidatePath("/configuracion");
  return { ok: "Tarifas de domicilio guardadas." };
}

export async function agregarTarifa(
  _prev: ConfigFormState,
  formData: FormData,
): Promise<ConfigFormState> {
  if (!(await esAdmin())) return SOLO_ADMIN;

  const km = Number(String(formData.get("km") ?? "").trim());
  const costo = precioValido(formData.get("costo"));
  if (!Number.isInteger(km) || km <= 0) return { error: "Los km deben ser un entero positivo." };
  if (costo === null) return { error: "El costo debe ser un número en pesos (entero)." };

  const existente = await prisma.zonaEnvio.findFirst({ where: { kmMax: km } });
  if (existente) return { error: `Ya existe una tarifa para ${km} km.` };

  await prisma.zonaEnvio.create({
    data: { nombre: `${km} km`, kmMax: km, costo },
  });

  revalidatePath("/configuracion");
  return { ok: `Tarifa de ${km} km agregada.` };
}

export async function eliminarTarifa(id: string): Promise<ConfigFormState> {
  if (!(await esAdmin())) return SOLO_ADMIN;
  const t = await prisma.zonaEnvio.delete({ where: { id }, select: { kmMax: true } });
  revalidatePath("/configuracion");
  return { ok: `Tarifa de ${t.kmMax} km eliminada.` };
}

// ---------- Bodega ----------

export async function guardarBodega(
  _prev: ConfigFormState,
  formData: FormData,
): Promise<ConfigFormState> {
  if (!(await esAdmin())) return SOLO_ADMIN;

  const texto = String(formData.get("ubicacion") ?? "").trim();
  if (!texto) return { error: "Pega las coordenadas o un link de Google Maps." };

  const res = await resolverUbicacion(texto);
  if (!res.coords) {
    return {
      error:
        res.error ??
        "No se encontraron coordenadas. Pega algo como “29.0729, -110.9559” o un link de Maps.",
    };
  }

  const { lat, lng } = res.coords;
  await prisma.$transaction([
    prisma.configuracion.upsert({
      where: { clave: CLAVE_BODEGA_LAT },
      create: { clave: CLAVE_BODEGA_LAT, valor: String(lat) },
      update: { valor: String(lat) },
    }),
    prisma.configuracion.upsert({
      where: { clave: CLAVE_BODEGA_LNG },
      create: { clave: CLAVE_BODEGA_LNG, valor: String(lng) },
      update: { valor: String(lng) },
    }),
  ]);

  revalidatePath("/configuracion");
  revalidatePath("/ruta");
  return { ok: `Bodega guardada: ${lat.toFixed(5)}, ${lng.toFixed(5)}.` };
}

export async function quitarBodega(): Promise<ConfigFormState> {
  if (!(await esAdmin())) return SOLO_ADMIN;
  await prisma.configuracion.deleteMany({
    where: { clave: { in: [CLAVE_BODEGA_LAT, CLAVE_BODEGA_LNG] } },
  });
  revalidatePath("/configuracion");
  revalidatePath("/ruta");
  return { ok: "Coordenadas de bodega eliminadas (se usará el env si existe)." };
}
