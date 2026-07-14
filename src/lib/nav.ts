import {
  CalendarDays,
  Home,
  Map,
  Package,
  Settings,
  Truck,
  Users,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  soloAdmin?: boolean;
};

// Rutas de la app. `soloAdmin` debe coincidir con RUTAS_SOLO_ADMIN en auth.config.ts.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Hoy", icon: Home },
  { href: "/ruta", label: "Ruta", icon: Map },
  { href: "/rentas", label: "Rentas", icon: Truck },
  { href: "/clientes", label: "Clientes", icon: Users, soloAdmin: true },
  { href: "/inventario", label: "Inventario", icon: Package, soloAdmin: true },
  { href: "/calendario", label: "Calendario", icon: CalendarDays, soloAdmin: true },
  { href: "/reportes", label: "Reportes", icon: BarChart3, soloAdmin: true },
  { href: "/configuracion", label: "Config", icon: Settings, soloAdmin: true },
];

export function navParaRol(esAdmin: boolean): NavItem[] {
  return NAV_ITEMS.filter((i) => esAdmin || !i.soloAdmin);
}

// En una pantalla de teléfono la barra inferior solo alcanza para ~5 destinos:
// los 8 del admin se salían del viewport y Reportes y Config quedaban invisibles
// (había que arrastrar la barra de lado para llegar). Estos son los que se
// quedan a la vista; el resto vive detrás del botón "Más" (ver bottom-nav).
const PRINCIPALES_MOVIL = ["/", "/ruta", "/rentas", "/calendario"];

export function navMovil(esAdmin: boolean): {
  principales: NavItem[];
  extras: NavItem[];
} {
  const items = navParaRol(esAdmin);
  return {
    principales: items.filter((i) => PRINCIPALES_MOVIL.includes(i.href)),
    extras: items.filter((i) => !PRINCIPALES_MOVIL.includes(i.href)),
  };
}
