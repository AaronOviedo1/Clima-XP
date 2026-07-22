# CLAUDE.md — Climaxpress

Sistema de administración para renta de aerocoolers (verano) y calentones (invierno) en Hermosillo, Sonora. Ver `Plan.md` para el contexto de negocio y las fases completas.

## Stack

- **Next.js 16** (App Router, TypeScript, Server Actions) — carpeta `src/`
- **Tailwind CSS v4** + **shadcn/ui** (base radix, preset nova) — mobile-first
- **Prisma** + **PostgreSQL** (Supabase — pooler 6543 en runtime, `DIRECT_URL` 5432 para migraciones)
- **Auth.js v5** (NextAuth beta) con credenciales, roles `ADMIN` y `REPARTIDOR`
- Deploy en **Vercel**

## Comandos

```bash
npm run dev          # servidor de desarrollo (Turbopack)
npm run build        # build de producción
npm run lint         # eslint

npm run db:migrate   # prisma migrate dev (crea/aplica migración local)
npm run db:deploy    # prisma migrate deploy (producción/CI)
npm run db:seed      # crea usuarios admin + repartidor (lee .env)
npm run db:studio    # prisma studio
npm run db:generate  # regenerar cliente Prisma

# Migración del Excel histórico (coloca el .xlsx en la raíz):
npx tsx scripts/migrate-excel.ts            # dry-run: genera data/revision-migracion.csv
npx tsx scripts/migrate-excel.ts --commit   # inserta (idempotente, usa DIRECT_URL)

# Iconos de la PWA (regenerar si cambia public/HD_sinFondo.png):
node scripts/generar-iconos.mjs
```

## Convenciones

- **Español** para el dominio de negocio (modelos, variables, rutas, UI): `Renta`, `Cliente`, `costoDomicilio`, `/inventario`.
- **Inglés** para código utilitario/infra: `prisma`, `authConfig`, `handlers`, helpers genéricos.
- Precios y montos en **pesos enteros** (sin centavos), tipo `Int`.
- Fechas de renta como `@db.Date`. Zona horaria del negocio: `America/Hermosillo` (sin DST).
- **Las fechas de renta son días de calendario, no instantes.** Prisma devuelve `@db.Date` como **medianoche UTC**, y date-fns formatea en hora **local**: en Hermosillo (UTC−7) esa medianoche cae a las 17:00 del día **anterior**, así que formatear directo corre la fecha un día (una renta del 8 de agosto se mostraba como el 7). Por eso `fechaLarga`/`fechaCorta`/`diasDeRenta` (`src/lib/fechas.ts`) reconstruyen el día con los componentes **UTC** (`diaCalendario`). **Nunca formatees una fecha de renta directo con date-fns**; y al construir una fecha en código usa `fechaDesdeInput` (mediodía UTC), que no cruza el límite del día en ninguna zona razonable.
- **Ocupación fin-exclusiva**: una renta ocupa `[fechaInicio, fechaFin)` — el día de recolección la unidad queda libre para otra entrega (una renta del mismo día ocupa ese único día). Regla centralizada en `condicionTraslape` (`src/lib/disponibilidad.ts`) y replicada en `src/lib/calendario.ts`.
- Mobile-first en serio: botones grandes (`h-11`), mínimo tipeo.
- **Nada de colores hex sueltos en los componentes.** El diseño desktop se hizo con tonos claros fijos (`bg-white`, `#fafbfe`, `#94a3b8`…) y en modo oscuro dejaban texto claro sobre fondo casi blanco. Los tonos viven como tokens en `globals.css`, con su gemelo oscuro en `.dark`, y se usan como utilidades: superficies `bg-superficie-suave` / `-hover` / `-activa`, líneas `border-linea` / `border-linea-suave`, textos `text-tenue` (terciario) / `text-medio` (secundario) / `text-saldo` (ámbar de "debe"), los pares de chip/avatar/KPI `bg-chip-{azul,cielo,ambar,verde,rojo}` + `text-chip-*-fg` (en `style` inline: `var(--chip-azul)`), `bg-calenton` (naranja de calentones) y `bg-taller`/`text-taller-fg` (botón sólido de "Resolver": en claro naranja oscuro sobre blanco, en oscuro se invierte — el naranja de marca con texto blanco encima se queda en 2:1). Verificado con contraste WCAG: todos los pares texto/fondo del tema oscuro pasan AA (≥4.5), incluidas las filas pastel por día de la semana. Solo quedan hex donde el color es de marca y funciona en ambos temas (gradientes azules, `#152b47` del header móvil).
- Los `hover:brightness-[0.9x]` oscurecen: en tema oscuro necesitan su `dark:hover:brightness-125`, si no el hover desaparece.

## Estructura

```
src/
  auth.ts            # NextAuth: Credentials + Prisma + bcrypt (JWT)
  auth.config.ts     # config edge-safe (callbacks, control de acceso por rol)
  proxy.ts           # protege rutas usando auth.config (Next 16 renombró middleware.ts)
  lib/
    prisma.ts        # singleton de PrismaClient
    nav.ts           # items de navegación (con flag soloAdmin)
    fechas.ts        # días de calendario (ver Convenciones: se leen en UTC)
    auth-guard.ts    # esAdmin(), guard de las server actions solo-admin
    actions/auth.ts  # server actions: autenticar / cerrarSesion
  components/        # app-header, header-nav, bottom-nav, login-form, ui/*
  app/
    login/           # pantalla de login (pública)
    (app)/           # shell autenticado: layout + páginas
      page.tsx       # Dashboard "Hoy"
      @modal/        # ranura paralela: los pop-ups (ver "Pop-ups" abajo)
      ruta/ rentas/ clientes/ inventario/ calendario/ reportes/ configuracion/
prisma/
  schema.prisma      # schema completo del dominio (Fase 1)
  migrations/        # init + fase1_dominio_completo
  seed.ts            # usuarios + modelos, unidades, zonas y accesorios reales
```

Control de acceso por rol: `RUTAS_SOLO_ADMIN` en `src/auth.config.ts` debe mantenerse sincronizado con el flag `soloAdmin` en `src/lib/nav.ts`.

**PWA**: `src/app/manifest.ts` (instalable, `display: standalone`) + iconos generados con `scripts/generar-iconos.mjs` a partir de `public/HD_sinFondo.png` — `src/app/icon.png` (favicon), `src/app/apple-icon.png` (iOS) y `public/icons/*` (192/512, con variantes `maskable` para el recorte de Android).

**Rutas exentas del proxy** (`src/proxy.ts`): `manifest.webmanifest`, `sw.js` y `api/cron`. Las tres se piden **sin cookies**, así que el redirect al login las rompería en silencio (la app deja de ser instalable, el service worker no registra, y el cron devuelve 200 con el HTML del login sin ejecutar nada).

**Subtítulo y acciones del header de escritorio**: el `TopBar` saca título y subtítulo de la ruta (`META` en `desktop/top-bar.tsx`), pero una pantalla puede publicar cosas suyas cuando dependen de datos que el layout no tiene: su subtítulo con `<SubtituloSeccion texto="…" />` (Inventario: "28 unidades · 4 modelos") y sus **botones** con `<AccionesSeccion>…</AccionesSeccion>` (Clientes: "Edición masiva" + "Nuevo cliente"; Inventario: "Edición masiva"; Reportes: el selector de años). Ambos viven en `desktop/seccion.tsx`; el `SeccionProvider` está en el layout, envolviendo TopBar y contenido, y todo se limpia solo al salir de la pantalla. Cada dato usa **dos contextos** (valor y setter) a propósito: con un único `{valor, set}` el objeto cambia en cada render del provider, el efecto se vuelve a disparar y entra en bucle. Cada publicación lleva además **la ruta que la publicó** (congelada al montar) y el TopBar solo la pinta si coincide con el pathname: con un pop-up interceptado abierto ("Nueva renta" desde Clientes) la página de fondo sigue montada y publicando, pero el pathname ya es `/rentas/nueva` — sin ese candado se veía el título "Rentas" con los botones de Clientes debajo (el overlay del Dialog es casi transparente). Los botones que suben al navbar usan `CLASE_ACCION_TOP_BAR` (mismo alto/radio que el buscador y "Nueva renta"; sus gemelos `dark:` neutralizan los `dark:bg-input/*` del variant outline del Button, que tailwind-merge no elimina por ser otra cadena de modificadores); como el TopBar solo existe en `lg+`, cada vista móvil conserva sus botones propios.

**Pop-ups (rutas interceptadas)**: **editar** y **nueva renta** abren en pop-up sobre el fondo desde la lista; una carga directa de la URL cae en la pantalla completa. Comparten el mismo componente (`renta-editar` / `renta-nueva`, con prop `enModal`), y el pop-up vive en la ranura `@modal` (`(.)rentas/[id]/editar`, `(.)rentas/nueva`). **El detalle de renta ya NO es pop-up**: tiene su propia pantalla (`renta-detalle`, diseño iOS con header sticky de "volver" + WhatsApp), así que se quitó el interceptor `(.)rentas/[id]` y tocar una renta navega a `/rentas/[id]` a página completa. La ranura `@modal` renderiza `default.tsx` cuando no hay pop-up activo.

> **Cuidado con los segmentos literales bajo un `[id]` interceptado.** El interceptor `(.)rentas/[id]` tomaba `/rentas/nueva` como una renta con id `"nueva"` y abría un pop-up vacío. Se arregla con un `page.tsx` **literal** en `(.)rentas/nueva` (el segmento literal gana sobre el dinámico) que renderice el alta de verdad. Un `page.tsx` que devuelva `null` **no sirve**: seguiría siendo una intercepción, y una intercepción por diseño deja el fondo intacto y solo pinta la ranura del modal — con el modal vacío, hacer clic en "Nueva" no produce nada visible. Si agregas otro segmento literal bajo `/rentas/`, tiene que existir también dentro de `@modal`.

**Ocupación por rol**: no hay asignación de rentas a un repartidor (`Renta.repartidorId` existe pero no se usa). **Todos ven las mismas rentas del día**; lo que el repartidor no ve es el dinero, y eso se controla en dos lugares que deben moverse juntos: `conSaldos` en `datosDelDia` y **`conDinero` en `tarjetaDesdeRenta`** (el DTO viaja al cliente: esconder los montos solo en la UI los dejaría en el HTML).

## Estado de fases

- [x] **Fase 0 — Setup**: Next.js + shadcn + Prisma + Auth.js (roles) + layout mobile-first + navegación + seed de usuarios.
  - Pendiente por credenciales del usuario: `DATABASE_URL` + `DIRECT_URL` reales (Supabase), primera migración (`db:migrate`), seed, y deploy a Vercel con variables de entorno.
- [x] **Fase 1 — Modelo de datos completo + seed**: schema del dominio (Cliente, Renta, Unidad, ModeloEquipo, Pago, etc.), migración aplicada a Supabase, seed con equipos/precios reales (Eco-Fresco, Turbo-Frío, Chispas-Frescas, Fire Sense Café), 28 unidades (EF×6, TF×2, CAL×20), tarifa por km y accesorios. Enriquecido con el archivo INVENTARIO: `specs` por modelo (CFM, dimensiones, peso, etc.), color por unidad de calentón (7 Café Obscuro, 8 Gris Claro, 5 Café Gratinado) y accesorios reales (6 mangueras, 8 extensiones, 14 tambos). Pantalla `/inventario` construida (pantalla 6 del plan). **Inventario editable**: precios por modelo, alta/edición de unidades (código, estado, notas, con sugerencia de código siguiente), reporte de fallas → mantenimiento (resolver el último abierto regresa la unidad a DISPONIBLE), estados de tambos, alta de accesorios y **eliminación** de unidades/accesorios — solo sin rentas asociadas; con historial se rechaza (usar estado Baja). Todo en `src/lib/actions/inventario.ts` + `src/components/inventario-acciones.tsx`. Verificado contra Supabase (11/11 edición + 4/4 eliminación).
- [x] **Fase 2 — Clientes y Rentas (CRUD + estados + pagos)**: CRUD de clientes con normalización E.164 y detección de duplicados; formulario de renta con unidades filtradas por disponibilidad (revalidación transaccional anti-doble-apartado), total en vivo, regla de calentones 3+, descuentos con nota; tarifa de domicilio por km ($89–$610, tabla real) con sugerencia y override; flujo de estados (con efectos sobre inventario) y registro de pagos/anticipos/saldo. Verificado contra Supabase (8/8 reglas). **Edición de renta** (`/rentas/[id]/editar`, mismo `RentaForm` con prop `edicion`): editable en cualquier estado (`ESTADOS_EDITABLES` en `lib/rentas.ts`); con equipo en la calle las unidades quedan bloqueadas (solo fechas/datos/cargos); revalidación de disponibilidad excluye la propia renta; snapshots de precio recalculados al guardar; pagos y estado no se tocan desde el formulario. Verificado contra Supabase (7/7).
  - **Correcciones (solo admin)**, para arreglar capturas equivocadas sin tocar la BD a mano: `corregirEstadoRenta` saca una renta del flujo forward-only (p. ej. una marcada CONCLUIDA que en realidad no se ha hecho), revalidando disponibilidad antes de aplicar; `eliminarPago` borra un pago mal capturado, verificando que pertenezca a la renta indicada (protección IDOR). Ambas en `actions/rentas.ts`, con el guard `esAdmin` de `lib/auth-guard.ts`.
  - **Los accesorios no se cobran**: no tienen costo y no se eligen al crear la renta. Se capturan al marcar **Entregado** (`marcarEntregada`), que es cuando de verdad se sabe qué se llevó.
  - **Lista** (`/rentas`): agrupada por semana de entrega (con total y saldo por semana), buscador por cliente/teléfono/dirección/código de equipo (`?q=`), filtro de estado en un selector, y cada tarjeta dice **qué** se rentó (`2 × Eco-Fresco`, vía `equiposPorModelo`), no solo cuántos equipos. Una renta CANCELADA no arrastra saldo (`totalesDeRenta` fuerza `saldo = 0`).
- [x] **Fase 3 — Dashboard del día + vista repartidor**: pantalla "Hoy" con KPIs (entregas, recolecciones, por cobrar), entregas/recolecciones del día con acciones de un tap (En ruta / Entregado / Recogido), rentas de mañana y saldos pendientes (solo admin). Deep links a Google Maps (coords o dirección) y WhatsApp por tarjeta. El repartidor ve las mismas rentas pero sin el dinero (ver "Ocupación por rol" arriba). Verificado contra Supabase (7/7).
- [x] **Fase 4 — Domicilio automático**: parser de ubicación (coords decimales, DMS `29°06'51.9"N…`, links de Maps con coords, expansión de links cortos `maps.app.goo.gl` vía redirect) + `src/lib/google-maps.ts` (Geocoding con sesgo a Hermosillo y Distance Matrix, requiere `GOOGLE_MAPS_API_KEY`). Action `ubicarCompleto` (en `actions/rentas.ts`): coords pegadas o geocoding de la dirección → km reales manejando desde la bodega (`obtenerBodega()`: BD o env) → costo sugerido por tarifa, con avisos de degradación (sin key / sin bodega / sin resultado). **El cálculo es automático**: se dispara en el acto al pegar un link de Maps o coordenadas, y al salir del campo si se escribió la dirección a mano — así los km y el costo entran al total **antes** de guardar (no hay que tocar "Ubicar", que queda solo para recalcular). No repite llamadas: recuerda la última combinación dirección + ubicación que resolvió. Respeta el costo sobrescrito a mano (avisa la sugerencia sin aplicarla). Probado contra la API real (link largo, link corto, DMS, dirección de texto). La bodega real ya está capturada en la BD.
- [x] **Fase 5 — Migración del Excel**: `scripts/migrate-excel.ts` lee las 6 hojas (coolers/calentones 2023–2026), mapea columnas por encabezado (tolera layouts distintos), infiere el año por temporada, normaliza teléfonos (extrae el primero de cadenas con varios), parsea fechas en español (incl. typos/rangos) y coords/DMS del lugar, ignora filas TOTAL, dedup de clientes por teléfono/nombre, y marca históricas como CONCLUIDA/CANCELADA con pago = total. Genera `data/revision-migracion.csv` con filas ambiguas. Idempotente (usa `DIRECT_URL`, borra marcadas `⟦mig⟧` y reinserta). **482 rentas** migradas (2023:13, 2024:219, 2025:177, 2026:76), 424 clientes. El `.xlsx` y el CSV están gitignored (datos personales).
- [x] **Fase 6 — Ruta del día**: página `/ruta` con las entregas del día como paradas ordenadas (nearest-neighbor desde bodega si hay coords, si no por captura), botón "Abrir ruta en Google Maps" (deep link multi-parada, se parte en varias si hay >10 waypoints) y acciones de un tap por parada. **Se puede armar la ruta de cualquier día por adelantado** (`?fecha=YYYY-MM-DD`, con calendario en español): en un día que no es hoy las acciones de un tap se desactivan (`soloLectura`), para no marcar una entrega antes de que ocurra. Aviso masivo de WhatsApp → Fase 7.
- [x] **Calendario de ocupación** (pantalla 7 del plan, solo admin): página `/calendario` como **cuadrícula de mes** (semanas lunes–domingo), con las unidades libres de cada modelo en cada celda: rojo si el modelo está agotado, ámbar si hay ocupación parcial. **Al tocar un día se abren sus rentas** (`calendario-mes.tsx`), etiquetadas como Entrega / Recolección / En curso — salen de la misma query que ya contaba la ocupación, así que no agrega viajes a la BD. Misma regla de traslape que `disponibilidad.ts` (estados CONFIRMADA/EN_RUTA/ENTREGADA, excluye MANTENIMIENTO/BAJA y modelos sin unidades): ojo, una renta **aparece** en su día de recolección pero ese día ya **no ocupa** unidad. Navegación de mes por `?mes=YYYY-MM`. Se agregó `/calendario` a `RUTAS_SOLO_ADMIN` (faltaba; estaba desincronizado con `nav.ts`). Verificado contra Supabase (8/8 con rentas temporales, incluida una que cruza fin de mes; + alineación de la cuadrícula en meses que empiezan en cada día de la semana y en febrero bisiesto).
- [x] **Configuración** (pantalla 9 del plan, solo admin): página `/configuracion` con edición de precios por modelo (por día y 3+), tarifa de domicilio por km (editar/agregar/eliminar filas de `ZonaEnvio`) y coordenadas de bodega (acepta coords/DMS/links de Maps vía `resolverUbicacion`). Nuevo modelo `Configuracion` (clave-valor, migración `configuracion`); la bodega se lee de BD con fallback a env `BODEGA_LAT/LNG` (`obtenerBodega()` en `src/lib/configuracion.ts`, usada por `/ruta`). Server actions con guard de admin. Plantillas de WhatsApp → Fase 7. Verificado contra Supabase (9/9 checks con reversión).
- [x] **Fase 7.5 — Notificaciones push (Web Push)**, para admin y repartidor. `web-push` + VAPID; tabla `SuscripcionPush` (una fila **por dispositivo**, `endpoint` unique; se borra sola cuando el push service responde 404/410/403). Service worker en `public/sw.js` (solo push, sin caché). Cuatro avisos, con los textos en `src/lib/avisos.ts`: **renta confirmada** (entrega hoy/mañana → repartidores) y **entrega/recolección marcada** (→ admins, excluyendo a quien la marcó) enganchados en `crearRenta`/`cambiarEstadoRenta`/`marcarEntregada`; **resumen de la mañana** (7:00, a todos) y **saldos por cobrar** (lunes 8:00, solo admin) vía crons de Vercel. Los envíos van en `avisar()` → `after()`: fuera del `$transaction` y sin propagar errores, para que un push caído nunca tumbe una entrega. Se activan por dispositivo desde el dashboard (único punto que alcanzan los dos roles) o desde `/configuracion`. **En iPhone solo funcionan con la PWA instalada** (iOS 16.4+) y el permiso se pide una sola vez. Verificado contra un push service falso: payload cifrado `aes128gcm` con firma VAPID, limpieza de suscripciones muertas, exclusión del actor, y los dos crons con/sin `CRON_SECRET` (401).
  - Crons en `vercel.json`, **en UTC**: Hermosillo es UTC−7 fijo, así que `0 14 * * *` = 7:00 am y `0 15 * * 1` = lunes 8:00 am, hora local.
- [ ] Fase 7 — WhatsApp Business Cloud API
- [ ] Fase 8 — Mercado Pago
- [x] **Fase 9 — Reportes** (solo admin): pantalla `/reportes` con selector de periodo (todos / por año), KPIs (ingresos, rentas, ticket promedio, por cobrar), ingresos por mes/año, comparativo aerocoolers vs calentones, ingresos por método de pago, top clientes, utilización por unidad e ingresos por domicilio (km). Gráficas de barras CSS sin dependencias. Agrupa por `renta.fechaInicio` (los pagos históricos tienen fecha de migración, no la real).
- [ ] Fase 10 — CFDI (no prioridad)

## Puesta en marcha local

1. Copia `.env.example` a `.env` y pon `DATABASE_URL` + `DIRECT_URL` de Supabase y un `AUTH_SECRET` (`npx auth secret`).
2. `npm install`
3. `npm run db:migrate` (crea las tablas)
4. `npm run db:seed` (crea admin + repartidor)
5. `npm run dev` → http://localhost:3000
   - Admin: `admin@climaxpress.mx` / `admin1234` (ver `.env`)
   - Repartidor: `repartidor@climaxpress.mx` / `repartidor1234`
