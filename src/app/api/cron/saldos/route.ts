import { autorizadoCron } from "@/lib/cron";
import { avisarSaldosPendientes } from "@/lib/avisos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cron semanal (lunes 8:00 am Hermosillo, ver vercel.json). Solo al admin.
export async function GET(req: Request) {
  if (!autorizadoCron(req)) return new Response("No autorizado", { status: 401 });

  const r = await avisarSaldosPendientes();
  return Response.json({ ok: true, ...r });
}
