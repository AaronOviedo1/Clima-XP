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

const TINTA = "#1e2a3a";
const AZUL_TITULO = "#1f4c8f";
const AZUL_ENCABEZADO = "#a9c4ee";
const AZUL_CELDA = "#c6d9f7";
const AMBAR_CELDA = "#fbedca";
const MARCO = "#d8dce3";
const BLANCO = "#ffffff";

export const ANCHO = 1000;

// Anchos de las columnas de la tabla (suman 1).
const COL = { equipo: 0.24, cantidad: 0.19, precio: 0.21, dias: 0.18, importe: 0.18 };

const PADDING = 44;
const ANCHO_UTIL = ANCHO - PADDING * 2;
const SEPARACION = 8; // hueco blanco entre celdas, como en el formato
const ALTO_FILA = 62;
const ALTO_ENCABEZADO = 52;

// Satori no pagina (lo que se desborda se corta) y sin `height` la imagen sale
// con el alto por defecto, así que hay que calcularlo.
export function altoDocumento(hoja: HojaCotizacion): number {
  const cabecera = 260; // marco + logo + chip de fecha
  const tablas = hoja.grupos.reduce(
    (acc, g) => acc + ALTO_ENCABEZADO + SEPARACION + g.lineas.length * (ALTO_FILA + SEPARACION),
    0,
  );
  const totalEquipos = ALTO_FILA + 24;
  const renglones =
    (hoja.costoDomicilio > 0 ? 1 : 0) +
    (hoja.descuentoMonto > 0 ? 1 : 0) +
    (hoja.iva != null ? 1 : 0) +
    1; // el TOTAL siempre
  return Math.round(cabecera + tablas + totalEquipos + renglones * (ALTO_FILA + SEPARACION) + 40);
}

function ancho(fraccion: number): number {
  return Math.round(ANCHO_UTIL * fraccion) - SEPARACION;
}

// Celda de la tabla: fondo de color, texto centrado, esquinas suaves.
function Celda({
  texto,
  w,
  fondo,
  color = TINTA,
  fuerte = false,
  tamano = 22,
  sub,
  crece = false,
}: {
  texto: string;
  w?: number;
  fondo: string;
  color?: string;
  fuerte?: boolean;
  tamano?: number;
  sub?: string;
  crece?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        ...(crece ? { flexGrow: 1 } : { width: w }),
        height: ALTO_FILA,
        marginRight: SEPARACION,
        backgroundColor: fondo,
        borderRadius: 10,
        padding: "0 10px",
      }}
    >
      <span
        style={{
          fontSize: tamano,
          fontWeight: fuerte ? 800 : 400,
          color,
          textAlign: "center",
          lineHeight: 1.15,
        }}
      >
        {texto}
      </span>
      {sub ? <span style={{ fontSize: 13, color: "#6b7a8d", marginTop: 2 }}>{sub}</span> : null}
    </div>
  );
}

function Fila({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", marginBottom: SEPARACION }}>
      {children}
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
  const dias = String(hoja.dias);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: BLANCO,
        color: TINTA,
        fontFamily: "Manrope",
        border: `3px solid ${MARCO}`,
        borderRadius: 28,
        padding: PADDING,
      }}
    >
      {/* Encabezado: logo al centro y la fecha de entrega a la derecha */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 34,
        }}
      >
        <div style={{ display: "flex", width: 150 }} />
        {logo ? (
          // next/image no existe para satori: aquí solo hay <img>.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} width={150} height={150} alt="" style={{ objectFit: "contain" }} />
        ) : (
          <span style={{ fontSize: 42, fontWeight: 800, color: AZUL_TITULO }}>Climaxpress</span>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            backgroundColor: AZUL_CELDA,
            borderRadius: 12,
            padding: "12px 18px",
          }}
        >
          <span style={{ fontSize: 19, fontWeight: 800, color: AZUL_TITULO, marginRight: 8 }}>
            FECHA:
          </span>
          <span style={{ fontSize: 19, fontWeight: 800 }}>{hoja.fecha}</span>
        </div>
      </div>

      {/* Una tabla por tipo de equipo (aerocoolers / calentones) */}
      {hoja.grupos.map((g) => (
        <div key={g.titulo} style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", marginBottom: SEPARACION }}>
            {[
              [g.titulo, COL.equipo],
              ["CANTIDAD", COL.cantidad],
              ["PRECIO X UNIDAD", COL.precio],
              ["DIAS", COL.dias],
              ["IMPORTE", COL.importe],
            ].map(([texto, fraccion]) => (
              <div
                key={texto as string}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: ancho(fraccion as number),
                  height: ALTO_ENCABEZADO,
                  marginRight: SEPARACION,
                  backgroundColor: AZUL_ENCABEZADO,
                  borderRadius: 10,
                  padding: "0 8px",
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: AZUL_TITULO,
                    textAlign: "center",
                    lineHeight: 1.15,
                  }}
                >
                  {texto as string}
                </span>
              </div>
            ))}
          </div>

          {g.lineas.map((l) => (
            <Fila key={l.modelo}>
              <Celda texto={l.modelo.toUpperCase()} w={ancho(COL.equipo)} fondo={AZUL_CELDA} tamano={19} />
              <Celda texto={String(l.cantidad)} w={ancho(COL.cantidad)} fondo={AZUL_CELDA} />
              <Celda texto={pesos(l.precioDia)} w={ancho(COL.precio)} fondo={AZUL_CELDA} />
              <Celda texto={dias} w={ancho(COL.dias)} fondo={AZUL_CELDA} />
              <Celda texto={pesos(l.importe)} w={ancho(COL.importe)} fondo={AZUL_CELDA} />
            </Fila>
          ))}
        </div>
      ))}

      {/* Total de equipos, alineado con las dos últimas columnas */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12, marginBottom: 24 }}>
        <Celda texto="TOTAL" w={ancho(COL.dias)} fondo={AZUL_CELDA} fuerte />
        <div style={{ display: "flex", marginRight: -SEPARACION }}>
          <Celda texto={pesos(hoja.subtotalEquipos)} w={ancho(COL.importe)} fondo={AZUL_CELDA} fuerte />
        </div>
      </div>

      {/* Cargos: solo salen los que aplican a esta renta */}
      {hoja.costoDomicilio > 0 && (
        <Fila>
          <Celda
            texto="SERV A DOM + INSTALACIÓN"
            w={ancho(COL.equipo)}
            fondo={AMBAR_CELDA}
            fuerte
            tamano={18}
          />
          <Celda texto={pesos(hoja.costoDomicilio)} fondo={AMBAR_CELDA} crece />
        </Fila>
      )}

      {hoja.descuentoMonto > 0 && (
        <Fila>
          <Celda texto="DESCUENTO" w={ancho(COL.equipo + COL.cantidad)} fondo={AMBAR_CELDA} fuerte />
          <Celda texto={hoja.descuentoPct ?? ""} w={ancho(COL.precio)} fondo={AMBAR_CELDA} />
          <Celda texto={pesos(hoja.descuentoMonto)} w={ancho(COL.dias)} fondo={AMBAR_CELDA} />
          <Celda
            texto={pesos(hoja.subtotalConDescuento)}
            w={ancho(COL.importe)}
            fondo={AMBAR_CELDA}
            sub="TOTAL"
          />
        </Fila>
      )}

      {hoja.iva != null && (
        <Fila>
          <Celda texto="IVA" w={ancho(COL.equipo + COL.cantidad)} fondo={AMBAR_CELDA} fuerte />
          <Celda texto="16%" w={ancho(COL.precio)} fondo={AMBAR_CELDA} />
          <Celda texto={pesos(hoja.iva)} w={ancho(COL.dias)} fondo={AMBAR_CELDA} sub="IVA" />
          <Celda
            texto={pesos(hoja.total)}
            w={ancho(COL.importe)}
            fondo={AMBAR_CELDA}
            sub="IVA + TOTAL"
          />
        </Fila>
      )}

      <Fila>
        <Celda texto="TOTAL" w={ancho(COL.equipo)} fondo={AMBAR_CELDA} fuerte tamano={24} />
        <Celda texto={pesos(hoja.total)} fondo={AMBAR_CELDA} fuerte tamano={30} crece />
      </Fila>
    </div>
  );
}
