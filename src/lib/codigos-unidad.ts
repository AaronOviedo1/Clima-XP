// Códigos de unidad para un modelo nuevo. Módulo neutro: lo usan la action
// (que los crea) y el diálogo (que los muestra antes de crear).

// "Eco-Fresco" → "EF", "Fire Sense Café" → "FSC". Solo letras, sin acentos.
export function prefijoSugerido(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[\s\-_]+/)
    .map((p) => p.replace(/[^a-zA-Z]/g, "")[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 4);
}

// "EF" + 3 → ["EF-01", "EF-02", "EF-03"]. El guion se agrega si falta, y el
// ancho mínimo es 2, como el resto del inventario ("CAL-05").
export function codigosModeloNuevo(prefijo: string, cantidad: number): string[] {
  const p = prefijo.trim().toUpperCase();
  if (!p || cantidad <= 0) return [];
  const base = p.endsWith("-") ? p : `${p}-`;
  const ancho = Math.max(2, String(cantidad).length);
  return Array.from({ length: cantidad }, (_, i) => `${base}${String(i + 1).padStart(ancho, "0")}`);
}
