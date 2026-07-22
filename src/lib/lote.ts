// Resultado de una acción en lote (edición masiva): cuántos registros se
// tocaron y cuáles se saltaron (por ejemplo, los que tienen historial y solo
// se pueden dar de baja). Compartido por inventario y clientes.
export type LoteActionResult =
  | { ok: true; afectadas: number; omitidas: string[] }
  | { error: string };
