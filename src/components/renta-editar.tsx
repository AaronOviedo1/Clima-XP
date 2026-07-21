import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { inputDesdeFecha } from "@/lib/fechas";
import { unidadesParaFechas, type UnidadOpcion } from "@/lib/actions/rentas";
import { UNIDADES_BLOQUEADAS, type EstadoRentaStr } from "@/lib/rentas";
import { RentaForm } from "@/components/renta-form";

/**
 * Editor de una renta existente: carga cliente/unidades y monta el RentaForm.
 * Lo usan la pantalla completa (/rentas/[id]/editar) y el pop-up. Los
 * accesorios ya no se editan aquí: se capturan al marcar la renta como
 * entregada (ver marcarEntregada en actions/rentas.ts).
 */
export async function RentaEditar({
  id,
  enModal = false,
}: {
  id: string;
  enModal?: boolean;
}) {
  const renta = await prisma.renta.findUnique({
    where: { id },
    include: {
      cliente: { select: { nombre: true } },
      unidades: { include: { unidad: { include: { modelo: true } } } },
    },
  });
  if (!renta) notFound();

  const inicio = inputDesdeFecha(renta.fechaInicio);
  const fin = inputDesdeFecha(renta.fechaFin);

  const [clientes, disponibles] = await Promise.all([
    prisma.cliente.findMany({
      select: { id: true, nombre: true, telefono: true },
      orderBy: { nombre: "asc" },
    }),
    unidadesParaFechas(inicio, fin, renta.id),
  ]);

  // Las unidades ya asignadas siempre se muestran, aunque hoy estén en
  // mantenimiento/baja o apartadas (rentas cerradas del histórico).
  const opciones: UnidadOpcion[] = [...disponibles];
  for (const ru of renta.unidades) {
    if (opciones.some((u) => u.id === ru.unidadId)) continue;
    opciones.push({
      id: ru.unidad.id,
      codigo: ru.unidad.codigo,
      modeloId: ru.unidad.modeloId,
      modeloNombre: ru.unidad.modelo.nombre,
      tipo: ru.unidad.modelo.tipo,
      precioDia: ru.unidad.modelo.precioDia,
      precioDia3Mas: ru.unidad.modelo.precioDia3Mas,
    });
  }

  return (
    <RentaForm
      clientes={clientes}
      unidadesIniciales={opciones}
      fechasIniciales={{ inicio, fin }}
      enModal={enModal}
      edicion={{
        rentaId: renta.id,
        estado: renta.estado as EstadoRentaStr,
        bloquearUnidades: UNIDADES_BLOQUEADAS.includes(renta.estado as EstadoRentaStr),
        iniciales: {
          clienteId: renta.clienteId,
          ventanaEntrega: renta.ventanaEntrega ?? "",
          lugar: renta.lugar ?? "",
          direccion: renta.direccion,
          codigoAcceso: renta.codigoAcceso ?? "",
          ubicacionTexto:
            renta.linkMaps ??
            (renta.lat != null && renta.lng != null ? `${renta.lat}, ${renta.lng}` : ""),
          lat: renta.lat,
          lng: renta.lng,
          linkMaps: renta.linkMaps,
          distanciaKm: renta.distanciaKm != null ? String(renta.distanciaKm) : "",
          costoDomicilio: renta.costoDomicilio,
          domicilioSobrescrito: renta.domicilioSobrescrito,
          unidadIds: renta.unidades.map((u) => u.unidadId),
          descuentoMonto: renta.descuentoMonto,
          descuentoNota: renta.descuentoNota ?? "",
          requiereFactura: renta.requiereFactura,
          notas: renta.notas ?? "",
        },
      }}
    />
  );
}

export async function nombreDeCliente(id: string): Promise<string | null> {
  const renta = await prisma.renta.findUnique({
    where: { id },
    select: { cliente: { select: { nombre: true } } },
  });
  return renta?.cliente.nombre ?? null;
}
