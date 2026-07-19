// Un template.tsx se re-monta en cada navegación (a diferencia del layout), así
// que las clases de entrada de tw-animate-css animan cada cambio de pantalla.
// Sutil a propósito: fade + un deslice leve que no provoca saltos de scroll.
// tw-animate-css respeta prefers-reduced-motion, así que no anima si el SO lo
// pide.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
      {children}
    </div>
  );
}
