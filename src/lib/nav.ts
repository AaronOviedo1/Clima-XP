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
