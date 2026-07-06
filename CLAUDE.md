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
```

## Convenciones

- **Español** para el dominio de negocio (modelos, variables, rutas, UI): `Renta`, `Cliente`, `costoDomicilio`, `/inventario`.
- **Inglés** para código utilitario/infra: `prisma`, `authConfig`, `handlers`, helpers genéricos.
- Precios y montos en **pesos enteros** (sin centavos), tipo `Int`.
- Fechas de renta como `@db.Date`. Zona horaria del negocio: `America/Hermosillo` (sin DST).
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

## Estado de fases

- [x] **Fase 0 — Setup**: Next.js + shadcn + Prisma + Auth.js (roles) + layout mobile-first + navegación + seed de usuarios.
  - Pendiente por credenciales del usuario: `DATABASE_URL` + `DIRECT_URL` reales (Supabase), primera migración (`db:migrate`), seed, y deploy a Vercel con variables de entorno.
- [x] **Fase 1 — Modelo de datos completo + seed**: schema del dominio (Cliente, Renta, Unidad, ModeloEquipo, Pago, etc.), migración aplicada a Supabase, seed con equipos/precios reales (Eco-Fresco, Turbo-Frío, Chispas-Frescas, Fire Sense Café), 28 unidades (EF×6, TF×2, CAL×20), 5 zonas y 10 accesorios.
- [ ] Fase 2 — Clientes y Rentas (CRUD + estados + pagos)
- [ ] Fase 3 — Dashboard del día + vista repartidor
- [ ] Fase 4 — Domicilio automático (Google Maps)
- [ ] Fase 5 — Migración del Excel
- [ ] Fase 6 — Ruta del día
- [ ] Fase 7 — WhatsApp Business Cloud API
- [ ] Fase 8 — Mercado Pago
- [ ] Fase 9 — Reportes
- [ ] Fase 10 — CFDI (no prioridad)

## Puesta en marcha local

1. Copia `.env.example` a `.env` y pon `DATABASE_URL` + `DIRECT_URL` de Supabase y un `AUTH_SECRET` (`npx auth secret`).
2. `npm install`
3. `npm run db:migrate` (crea las tablas)
4. `npm run db:seed` (crea admin + repartidor)
5. `npm run dev` → http://localhost:3000
   - Admin: `admin@climaxpress.mx` / `admin1234` (ver `.env`)
   - Repartidor: `repartidor@climaxpress.mx` / `repartidor1234`
