import { z } from "zod";
import { contextoDesdeSesion } from "@/lib/copiloto/contexto";
import { accionesHabilitadas } from "@/lib/copiloto/flag";
import { decidirPropuesta } from "@/lib/copiloto/propuestas";

// Confirmar o cancelar una propuesta del copiloto. Solo viaja el id (y, para
// Entregado/Recogido, los accesorios que eligió la persona): los args que se
// ejecutan son los que se guardaron al proponer. La sesión manda: la fila tiene
// que ser del usuario y la acción seguir disponible para su rol actual.
//
// No escribe ConsultaCopiloto (no es una consulta al modelo): su auditoría es
// la propia fila de AccionCopiloto. Protegida por el proxy y por la sesión.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cuerpoSchema = z.strictObject({
  id: z.string().min(1).max(40),
  decision: z.enum(["confirmar", "cancelar"]),
  datos: z.unknown().optional(),
});

export async function POST(req: Request) {
  if (!accionesHabilitadas()) {
    return Response.json({ error: "Acciones del copiloto deshabilitadas." }, { status: 404 });
  }
  const ctx = await contextoDesdeSesion();
  if (!ctx) return Response.json({ error: "No autorizado" }, { status: 401 });

  let json: unknown = null;
  try {
    json = await req.json();
  } catch {
    // Cae en el 400 de abajo.
  }
  const cuerpo = cuerpoSchema.safeParse(json);
  if (!cuerpo.success) {
    return Response.json(
      { error: "Cuerpo inválido: se espera { id, decision: 'confirmar' | 'cancelar', datos? }." },
      { status: 400 },
    );
  }

  try {
    const r = await decidirPropuesta(ctx, cuerpo.data.id, cuerpo.data.decision, cuerpo.data.datos);
    return Response.json(
      { ...(r.propuesta ? { propuesta: r.propuesta } : {}), ...(r.error ? { error: r.error } : {}) },
      { status: r.status },
    );
  } catch (e) {
    console.error("[copiloto] falló la decisión de la propuesta:", e);
    return Response.json({ error: "No se pudo procesar la confirmación." }, { status: 500 });
  }
}
