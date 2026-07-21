// Colores por día de la semana de la entrega, los mismos del Excel histórico.
// Índice = getUTCDay() (las fechas de renta son @db.Date, fecha pura en UTC).
export const DIA_SEMANA_META = [
  { letra: "D", nombre: "domingo", hex: "#f5c542", clase: "bg-[#ffe699]/60 dark:bg-[#ffe699]/20" },
  { letra: "L", nombre: "lunes", hex: "#7cbf6a", clase: "bg-[#c6e0b4]/60 dark:bg-[#c6e0b4]/20" },
  { letra: "M", nombre: "martes", hex: "#5cc2b0", clase: "bg-[#bee5dc]/60 dark:bg-[#bee5dc]/20" },
  { letra: "Mi", nombre: "miércoles", hex: "#c2c93e", clase: "bg-[#d6dc58]/50 dark:bg-[#d6dc58]/20" },
  { letra: "J", nombre: "jueves", hex: "#9aa3ad", clase: "bg-[#d9d9d9]/60 dark:bg-[#d9d9d9]/20" },
  { letra: "V", nombre: "viernes", hex: "#f0965e", clase: "bg-[#f8cbad]/60 dark:bg-[#f8cbad]/20" },
  { letra: "S", nombre: "sábado", hex: "#7093d1", clase: "bg-[#b4c6e7]/60 dark:bg-[#b4c6e7]/20" },
] as const;

export function claseColorDia(fecha: Date): string {
  return DIA_SEMANA_META[fecha.getUTCDay()].clase;
}

// Color sólido (barra lateral de la fila de renta).
export function colorBarraDia(fecha: Date): string {
  return DIA_SEMANA_META[fecha.getUTCDay()].hex;
}
