import {
  CalendarDays, Home, Inbox, LayoutGrid, List, PiggyBank, Plus, Settings, Tags, Upload, Wallet,
} from "lucide-react";

export const TODAS = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/importar", label: "Agregar / Importar", icon: Upload },
  { href: "/revisar", label: "Por revisar", icon: Inbox },
  { href: "/movimientos", label: "Movimientos", icon: List },
  { href: "/metas", label: "Metas de ahorro", icon: PiggyBank },
  { href: "/calendario", label: "Calendario de pagos", icon: CalendarDays },
  { href: "/cuentas", label: "Cuentas", icon: Wallet },
  { href: "/categorias", label: "Categorías y presupuesto", icon: Tags },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export const MOVIL = [
  { href: "/", label: "Inicio", icon: Home, destacado: false },
  { href: "/movimientos", label: "Movs.", icon: List, destacado: false },
  { href: "/importar", label: "Agregar", icon: Plus, destacado: true },
  { href: "/revisar", label: "Revisar", icon: Inbox, destacado: false },
  { href: "/mas", label: "Más", icon: LayoutGrid, destacado: false },
];

export const LINKS_MAS = TODAS.filter((l) => !MOVIL.some((m) => m.href === l.href));
