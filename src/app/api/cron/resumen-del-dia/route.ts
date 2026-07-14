import { autorizadoCron } from "@/lib/cron";
import { avisarResumenDelDia } from "@/lib/avisos";

// Prisma y web-push necesitan Node (no corren en edge). force-dynamic evita que
// Next intente evaluar la ruta durante el build.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cron diario (7:00 am Hermosillo, ver vercel.json). Vercel invoca con GET.
export async function GET(req: Request) {
  if (!autorizadoCron(req)) return new Response("No autorizado", { status: 401 });

  // Aquí sí se espera el envío: no hay un usuario del otro lado esperando.
  const r = await avisarResumenDelDia();
  return Response.json({ ok: true, ...r });
}
