// Normalización de teléfonos mexicanos a E.164 (+52 + 10 dígitos).
// Acepta formatos mixtos: "662 123 4567", "6621234567", "+52 662...",
// "044 662...", "0452 662...", "521 662..." etc.

export function normalizarTelefono(entrada: string | null | undefined): string | null {
  if (!entrada) return null;
  let d = entrada.replace(/\D/g, "");
  if (!d) return null;

  // Prefijo internacional "00"
  if (d.startsWith("00")) d = d.slice(2);
  // Prefijos nacionales de larga distancia/celular (044/045)
  if (d.startsWith("044") || d.startsWith("045")) d = d.slice(3);
  // 52 + 1 (celular viejo) + 10 dígitos → 52 + 10
  if (d.length === 13 && d.startsWith("521")) d = "52" + d.slice(3);
  // 1 + 10 dígitos (móvil sin lada país) → 10
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  // 52 + 10 dígitos
  if (d.length === 12 && d.startsWith("52")) d = d.slice(2);

  if (d.length !== 10) return null; // no es un número mexicano válido
  return `+52${d}`;
}

// Formato legible: +52 662 123 4567
export function formatoTelefono(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = e164.match(/^\+52(\d{3})(\d{3})(\d{4})$/);
  if (!m) return e164;
  return `+52 ${m[1]} ${m[2]} ${m[3]}`;
}

// Número local de 10 dígitos para enlaces wa.me (sin +).
export function paraWhatsApp(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const m = e164.match(/^\+?(\d{12})$/);
  return m ? m[1] : null;
}

// Enlace a WhatsApp (wa.me), con mensaje pre-cargado opcional.
// Devuelve null si el teléfono no es válido.
export function linkWhatsApp(
  e164: string | null | undefined,
  texto?: string,
): string | null {
  const wa = paraWhatsApp(e164);
  if (!wa) return null;
  return texto
    ? `https://wa.me/${wa}?text=${encodeURIComponent(texto)}`
    : `https://wa.me/${wa}`;
}
