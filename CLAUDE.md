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
- **Ocupación fin-exclusiva**: una renta ocupa `[fechaInicio, fechaFin)` — el día de recolección la unidad queda libre para otra entrega (una renta del mismo día ocupa ese único día). Regla centralizada en `condicionTraslape` (`src/lib/disponibilidad.ts`) y replicada en `src/lib/calendario.ts`.
- Mobile-first en serio: botones grandes (`h-11`), mínimo tipeo.

## Estructura

```
src/
  auth.ts            # NextAuth: Credentials + Prisma + bcrypt (JWT)
  auth.config.ts     # config edge-safe (callbacks, control de acceso por rol)
  middleware.ts      # protege rutas usando auth.config
  lib/
    prisma.ts        # singleton de PrismaClient
    nav.ts           # items de navegación (con flag soloAdmin)
    actions/auth.ts  # server actions: autenticar / cerrarSesion
  components/        # app-header, bottom-nav, login-form, placeholder-page, ui/*
  app/
    login/           # pantalla de login (pública)
    (app)/           # shell autenticado: layout + páginas
      page.tsx       # Dashboard "Hoy"
      ruta/ rentas/ clientes/ inventario/ calendario/ reportes/ configuracion/
prisma/
  schema.prisma      # schema completo del dominio (Fase 1)
  migrations/        # init + fase1_dominio_completo
  seed.ts            # usuarios + modelos, unidades, zonas y accesorios reales
```

Control de acceso por rol: `RUTAS_SOLO_ADMIN` en `src/auth.config.ts` debe mantenerse sincronizado con el flag `soloAdmin` en `src/lib/nav.ts`.

**PWA**: `src/app/manifest.ts` (instalable, `display: standalone`) + iconos generados con `scripts/generar-iconos.mjs` a partir de `public/HD_sinFondo.png` — `src/app/icon.png` (favicon), `src/app/apple-icon.png` (iOS) y `public/icons/*` (192/512, con variantes `maskable` para el recorte de Android). El matcher de `src/proxy.ts` deja pasar `manifest.webmanifest` sin sesión: el navegador lo pide sin cookies y un redirect al login rompería la instalación.

## Estado de fases

- [x] **Fase 0 — Setup**: Next.js + shadcn + Prisma + Auth.js (roles) + layout mobile-first + navegación + seed de usuarios.
  - Pendiente por credenciales del usuario: `DATABASE_URL` + `DIRECT_URL` reales (Supabase), primera migración (`db:migrate`), seed, y deploy a Vercel con variables de entorno.
- [x] **Fase 1 — Modelo de datos completo + seed**: schema del dominio (Cliente, Renta, Unidad, ModeloEquipo, Pago, etc.), migración aplicada a Supabase, seed con equipos/precios reales (Eco-Fresco, Turbo-Frío, Chispas-Frescas, Fire Sense Café), 28 unidades (EF×6, TF×2, CAL×20), tarifa por km y accesorios. Enriquecido con el archivo INVENTARIO: `specs` por modelo (CFM, dimensiones, peso, etc.), color por unidad de calentón (7 Café Obscuro, 8 Gris Claro, 5 Café Gratinado) y accesorios reales (6 mangueras, 8 extensiones, 14 tambos). Pantalla `/inventario` construida (pantalla 6 del plan). **Inventario editable**: precios por modelo, alta/edición de unidades (código, estado, notas, con sugerencia de código siguiente), reporte de fallas → mantenimiento (resolver el último abierto regresa la unidad a DISPONIBLE), estados de tambos, alta de accesorios y **eliminación** de unidades/accesorios — solo sin rentas asociadas; con historial se rechaza (usar estado Baja). Todo en `src/lib/actions/inventario.ts` + `src/components/inventario-acciones.tsx`. Verificado contra Supabase (11/11 edición + 4/4 eliminación).
- [x] **Fase 2 — Clientes y Rentas (CRUD + estados + pagos)**: CRUD de clientes con normalización E.164 y detección de duplicados; formulario de renta con unidades filtradas por disponibilidad (revalidación transaccional anti-doble-apartado), total en vivo, regla de calentones 3+, descuentos con nota; tarifa de domicilio por km ($89–$610, tabla real) con sugerencia y override; flujo de estados (con efectos sobre inventario) y registro de pagos/anticipos/saldo. Verificado contra Supabase (8/8 reglas). **Edición de renta** (`/rentas/[id]/editar`, mismo `RentaForm` con prop `edicion`): editable en COTIZADA/CONFIRMADA/EN_RUTA/ENTREGADA (`ESTADOS_EDITABLES` en `lib/rentas.ts`); con equipo en la calle las unidades quedan bloqueadas (solo fechas/datos/cargos); revalidación de disponibilidad excluye la propia renta; snapshots de precio recalculados al guardar; pagos y estado no se tocan desde el formulario. Verificado contra Supabase (7/7).
- [x] **Fase 3 — Dashboard del día + vista repartidor**: pantalla "Hoy" con KPIs (entregas, recolecciones, por cobrar), entregas/recolecciones del día con acciones de un tap (En ruta / Entregado / Recogido), rentas de mañana y saldos pendientes (solo admin). Deep links a Google Maps (coords o dirección) y WhatsApp por tarjeta. Vista filtrada por rol (el repartidor solo ve lo asignado y sin datos de dinero). Verificado contra Supabase (7/7).
- [x] **Fase 4 — Domicilio automático**: parser de ubicación (coords decimales, DMS `29°06'51.9"N…`, links de Maps con coords, expansión de links cortos `maps.app.goo.gl` vía redirect) + `src/lib/google-maps.ts` (Geocoding con sesgo a Hermosillo y Distance Matrix, requiere `GOOGLE_MAPS_API_KEY`). Action `ubicarCompleto` (en `actions/rentas.ts`): coords pegadas o geocoding de la dirección → km reales manejando desde la bodega (`obtenerBodega()`: BD o env) → costo sugerido por tarifa, con avisos de degradación (sin key / sin bodega / sin resultado). El botón "Ubicar" del formulario de renta hace todo en un tap y respeta el costo sobrescrito a mano. Probado contra la API real (DMS, dirección de texto, vacío). **Nota:** falta capturar la bodega real en `/configuracion` para que calcule distancias.
- [x] **Fase 5 — Migración del Excel**: `scripts/migrate-excel.ts` lee las 6 hojas (coolers/calentones 2023–2026), mapea columnas por encabezado (tolera layouts distintos), infiere el año por temporada, normaliza teléfonos (extrae el primero de cadenas con varios), parsea fechas en español (incl. typos/rangos) y coords/DMS del lugar, ignora filas TOTAL, dedup de clientes por teléfono/nombre, y marca históricas como CONCLUIDA/CANCELADA con pago = total. Genera `data/revision-migracion.csv` con filas ambiguas. Idempotente (usa `DIRECT_URL`, borra marcadas `⟦mig⟧` y reinserta). **482 rentas** migradas (2023:13, 2024:219, 2025:177, 2026:76), 424 clientes. El `.xlsx` y el CSV están gitignored (datos personales).
- [x] **Fase 6 — Ruta del día**: página `/ruta` con las entregas de hoy como paradas ordenadas (nearest-neighbor desde bodega si hay coords + `BODEGA_LAT/LNG`, si no por captura), botón "Abrir ruta en Google Maps" (deep link multi-parada, se parte en varias si hay >10 waypoints) y acciones de un tap por parada. Aviso masivo de WhatsApp → Fase 7.
- [x] **Calendario de ocupación** (pantalla 7 del plan, solo admin): página `/calendario` con tabla mes × modelo de unidades libres por día (misma regla de traslape que `disponibilidad.ts`: estados CONFIRMADA/EN_RUTA/ENTREGADA, excluye MANTENIMIENTO/BAJA y modelos sin unidades), navegación de mes por `?mes=YYYY-MM`, hoy resaltado, días pasados atenuados, celdas rojo/ámbar según ocupación. Se agregó `/calendario` a `RUTAS_SOLO_ADMIN` (faltaba; estaba desincronizado con `nav.ts`). Verificado contra Supabase (8/8 checks con rentas temporales, incluida una que cruza fin de mes).
- [x] **Configuración** (pantalla 9 del plan, solo admin): página `/configuracion` con edición de precios por modelo (por día y 3+), tarifa de domicilio por km (editar/agregar/eliminar filas de `ZonaEnvio`) y coordenadas de bodega (acepta coords/DMS/links de Maps vía `resolverUbicacion`). Nuevo modelo `Configuracion` (clave-valor, migración `configuracion`); la bodega se lee de BD con fallback a env `BODEGA_LAT/LNG` (`obtenerBodega()` en `src/lib/configuracion.ts`, usada por `/ruta`). Server actions con guard de admin. Plantillas de WhatsApp → Fase 7. Verificado contra Supabase (9/9 checks con reversión).
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
