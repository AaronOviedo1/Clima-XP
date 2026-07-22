import { MessageCircle, Send, Users, Repeat, Circle } from "lucide-react";
import type { CanalOrigen } from "@prisma/client";

// Cómo se ve cada canal de origen: etiqueta, ícono y par de color (tokens de
// chip, que tienen su versión oscura en globals.css). Un solo lugar para que
// la lista de clientes, el detalle y los selects no se desincronicen.
export const CANAL_META: Record<
  CanalOrigen,
  { etiqueta: string; icono: typeof MessageCircle; clase: string }
> = {
  WHATSAPP: {
    etiqueta: "WhatsApp",
    icono: MessageCircle,
    clase: "bg-chip-verde text-chip-verde-fg",
  },
  MESSENGER: {
    etiqueta: "Messenger",
    icono: Send,
    clase: "bg-chip-cielo text-chip-cielo-fg",
  },
  RECOMENDACION: {
    etiqueta: "Recomendación",
    icono: Users,
    clase: "bg-chip-ambar text-chip-ambar-fg",
  },
  RECURRENTE: {
    etiqueta: "Recurrente",
    icono: Repeat,
    clase: "bg-chip-azul text-chip-azul-fg",
  },
  OTRO: {
    etiqueta: "Otro",
    icono: Circle,
    clase: "bg-muted text-muted-foreground",
  },
};

// Opciones de los selects (alta y edición de cliente), en el orden de uso real.
export const CANALES = (
  Object.keys(CANAL_META) as CanalOrigen[]
).map((v) => ({ v, l: CANAL_META[v].etiqueta }));
