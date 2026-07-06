// Todos los montos se manejan como pesos enteros (sin centavos).

const fmt = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function pesos(monto: number): string {
  return fmt.format(monto);
}
