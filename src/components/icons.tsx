import type { SVGProps } from 'react';

// Set mínimo de íconos de línea propios (formas genéricas, sin depender de una librería externa
// solo para 15 glifos) — mismo stroke/viewBox en todos para que se vean como un solo sistema.
export type IconProps = SVGProps<SVGSVGElement>;
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function MenuIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M3 6h18M3 12h18M3 18h18" /></svg>;
}
export function CloseIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M18 6 6 18M6 6l12 12" /></svg>;
}
export function GridIcon(props: IconProps) {
  return <svg {...base} {...props}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>;
}
export function ChartIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M3.5 20.5h17" /><rect x="6" y="12" width="3" height="7" rx="0.5" /><rect x="10.5" y="7" width="3" height="12" rx="0.5" /><rect x="15" y="10" width="3" height="9" rx="0.5" /></svg>;
}
export function BuildingIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M5 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16" /><path d="M13 10h5a1 1 0 0 1 1 1v10" /><path d="M9 8h.01M9 12h.01M9 16h.01M16 14h.01M16 17h.01" /><path d="M3 21h18" /></svg>;
}
export function CalendarIcon(props: IconProps) {
  return <svg {...base} {...props}><rect x="3.5" y="4.5" width="17" height="16" rx="2" /><path d="M8 3v3M16 3v3M3.5 9.5h17" /></svg>;
}
export function CardIcon(props: IconProps) {
  return <svg {...base} {...props}><rect x="2.5" y="5.5" width="19" height="13" rx="2" /><path d="M2.5 9.5h19" /><path d="M6 14.5h4" /></svg>;
}
export function PinIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.25" /></svg>;
}
export function GearIcon(props: IconProps) {
  return <svg {...base} {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V20a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.96 18.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.96a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 13.5Z" /></svg>;
}
export function ShieldIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" /><path d="m9.5 12 1.8 1.8 3.2-3.6" /></svg>;
}
export function LogoutIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>;
}
export function SearchIcon(props: IconProps) {
  return <svg {...base} {...props}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>;
}
export function PlusIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M12 5v14M5 12h14" /></svg>;
}
export function ChevronRightIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="m9 6 6 6-6 6" /></svg>;
}
export function RefreshIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 4v5h-5" /></svg>;
}
export function ExternalLinkIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14 21 3" /></svg>;
}
export function DocumentIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M7 3.5h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" /><path d="M14 3.5V8h4" /><path d="M9 13h6M9 16.5h6" /></svg>;
}
export function SparkleIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M11 3v3M11 17v3M3 11h3M17 11h3M5.5 5.5l2 2M16.5 16.5l-2-2M5.5 16.5l2-2M16.5 5.5l-2 2" /><circle cx="11" cy="11" r="2.5" /></svg>;
}
export function WrenchIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M14.7 6.3a4 4 0 0 0-5.4 4.6L4 16.2V20h3.8l5.3-5.3a4 4 0 0 0 4.6-5.4l-2.5 2.5-2-2 2.5-2.5Z" /></svg>;
}
export function AlertIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L14.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>;
}
export function HistoryIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4.5h4.5" /><path d="M12 8v4.5l3 2" /></svg>;
}
