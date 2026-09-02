import { autorizadoIntegracion, pagosParaExportar } from "@/lib/integracion";
import { hoyNegocio, sumarDiasInput } from "@/lib/fechas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cuánto abarca la consulta si no se pide un rango. */
const DIAS_DEFAULT = 45;

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Pagos confirmados, para que pasta stats sepa de quién es cada depósito que le
 * cae a Spin. Se llama sin sesión (está exento en proxy.ts) y se autentica con
 * PASTA_STATS_SECRET.
 *
 * Es de solo lectura y devuelve un contrato propio, no filas de Prisma.
 */
export async function GET(req: Request) {
  if (!autorizadoIntegracion(req)) {
    return new Response("No autorizado", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const hastaParam = searchParams.get("hasta");
  const desdeParam = searchParams.get("desde");
  const hasta = hastaParam && ES_FECHA.test(hastaParam) ? hastaParam : hoyNegocio();
  const desde =
    desdeParam && ES_FECHA.test(desdeParam) ? desdeParam : sumarDiasInput(hasta, -DIAS_DEFAULT);

  const pagos = await pagosParaExportar({ desde, hasta });

  return Response.json({ pagos });
}
