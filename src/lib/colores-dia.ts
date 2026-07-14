// Colores por día de la semana de la entrega, los mismos del Excel histórico.
// Índice = getUTCDay() (las fechas de renta son @db.Date, fecha pura en UTC).
export const DIA_SEMANA_META = [
  { letra: "D", nombre: "domingo", clase: "bg-[#ffe699]/60 dark:bg-[#ffe699]/20" },
  { letra: "L", nombre: "lunes", clase: "bg-[#c6e0b4]/60 dark:bg-[#c6e0b4]/20" },
  { letra: "M", nombre: "martes", clase: "bg-[#bee5dc]/60 dark:bg-[#bee5dc]/20" },
  { letra: "Mi", nombre: "miércoles", clase: "bg-[#d6dc58]/50 dark:bg-[#d6dc58]/20" },
  { letra: "J", nombre: "jueves", clase: "bg-[#d9d9d9]/60 dark:bg-[#d9d9d9]/20" },
  { letra: "V", nombre: "viernes", clase: "bg-[#f8cbad]/60 dark:bg-[#f8cbad]/20" },
  { letra: "S", nombre: "sábado", clase: "bg-[#b4c6e7]/60 dark:bg-[#b4c6e7]/20" },
] as const;

export function claseColorDia(fecha: Date): string {
  return DIA_SEMANA_META[fecha.getUTCDay()].clase;
}
