import type { HojaCotizacion } from "@/lib/cotizacion";
import { pesos } from "@/lib/dinero";

// Hoja de cotización que se le manda al cliente, dibujada por satori (next/og).
//
// Ojo: esto NO es un componente de la app. Satori no ve Tailwind ni las CSS
// vars de globals.css, así que todo va en estilos inline y los colores se
// escriben literales — es la excepción a "nada de hex sueltos" del CLAUDE.md:
// un PNG es papel de tema claro fijo, no UI con modo oscuro. Otras reglas de
// satori: solo flexbox, `display: flex` explícito en todo contenedor con más de
// un hijo, y nada de emoji (los tendría que bajar de un CDN).

const AZUL = "#152b47"; // el mismo azul del header móvil
const TINTA = "#0f172a";
const TENUE = "#64748b";
const LINEA = "#e2e8f0";
const FONDO = "#ffffff";

export const ANCHO = 1000;

// Satori no pagina (lo que se desborda se corta) y sin `height` la imagen sale
// con el alto por defecto de la librería, así que hay que calcularlo: son las
// alturas reales de los bloques de abajo, sumadas.
const ALTO_MARCO = 548; // padding + encabezado + cliente/periodo + caja del total
const ALTO_LINEA = 123; // cada renglón de equipos
const ALTO_RENGLON = 51; // cada renglón de la suma (equipos, domicilio, descuento)
const ALTO_CLIENTE = 55; // el nombre, cuando la cotización trae cliente

export function altoDocumento(hoja: HojaCotizacion): number {
  const renglones = 1 + (hoja.costoDomicilio > 0 ? 1 : 0) + (hoja.descuentoMonto > 0 ? 1 : 0);
  return (
    ALTO_MARCO +
    (hoja.cliente ? ALTO_CLIENTE : 0) +
    hoja.lineas.length * ALTO_LINEA +
    renglones * ALTO_RENGLON
  );
}

function Renglon({
  etiqueta,
  valor,
  tenue = false,
}: {
  etiqueta: string;
  valor: string;
  tenue?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 30,
        color: tenue ? TENUE : TINTA,
        marginTop: 12,
      }}
    >
      <span>{etiqueta}</span>
      <span>{valor}</span>
    </div>
  );
}

export function DocumentoCotizacion({
  hoja,
  logo,
}: {
  hoja: HojaCotizacion;
  logo: string | null;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: FONDO,
        color: TINTA,
        fontFamily: "Manrope",
        padding: 56,
      }}
    >
      {/* Encabezado */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `3px solid ${AZUL}`,
          paddingBottom: 28,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 46, fontWeight: 800, color: AZUL }}>Climaxpress</span>
          <span style={{ fontSize: 28, color: TENUE, marginTop: 4 }}>
            Cotización de renta
          </span>
        </div>
        {logo ? (
          // next/image no existe para satori: aquí solo hay <img>.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} width={120} height={120} alt="" style={{ objectFit: "contain" }} />
        ) : null}
      </div>

      {/* Cliente y periodo */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 32 }}>
        {hoja.cliente ? (
          <span style={{ fontSize: 38, fontWeight: 800 }}>{hoja.cliente}</span>
        ) : null}
        <span style={{ fontSize: 30, color: TENUE, marginTop: hoja.cliente ? 6 : 0 }}>
          {hoja.periodo} · {hoja.dias} {hoja.dias === 1 ? "día" : "días"}
        </span>
      </div>

      {/* Equipos */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
        {hoja.lineas.map((l) => (
          <div
            key={l.modelo}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: `1px solid ${LINEA}`,
              paddingBottom: 20,
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 34, fontWeight: 800 }}>
                {l.cantidad} × {l.modelo}
              </span>
              <span style={{ fontSize: 26, color: TENUE, marginTop: 4 }}>
                {pesos(l.precioDia)} por día · {hoja.dias}{" "}
                {hoja.dias === 1 ? "día" : "días"}
              </span>
            </div>
            <span style={{ fontSize: 34 }}>{pesos(l.subtotal)}</span>
          </div>
        ))}
      </div>

      {/* Totales */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
        <Renglon etiqueta="Equipos" valor={pesos(hoja.subtotalEquipos)} tenue />
        {hoja.costoDomicilio > 0 ? (
          <Renglon
            etiqueta={
              hoja.distanciaKm
                ? `Servicio a domicilio (${hoja.distanciaKm.toFixed(1)} km)`
                : "Servicio a domicilio"
            }
            valor={pesos(hoja.costoDomicilio)}
            tenue
          />
        ) : null}
        {hoja.descuentoMonto > 0 ? (
          <Renglon
            etiqueta={hoja.descuentoNota ? `Descuento (${hoja.descuentoNota})` : "Descuento"}
            valor={`− ${pesos(hoja.descuentoMonto)}`}
            tenue
          />
        ) : null}
      </div>

      {/* Total */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: AZUL,
          borderRadius: 20,
          padding: "26px 32px",
          marginTop: 34,
        }}
      >
        <span style={{ fontSize: 36, color: "#dbeafe" }}>Total</span>
        <span style={{ fontSize: 56, fontWeight: 800, color: "#ffffff" }}>
          {pesos(hoja.total)}
        </span>
      </div>
    </div>
  );
}
