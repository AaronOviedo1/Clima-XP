# PLAN.md — Climaxpress App

Sistema de administración para negocio de renta de aerocoolers (verano) y calentones (invierno) en Hermosillo, Sonora.

---

## 1. Contexto del negocio

**Flujo actual:**
1. Cliente contacta por Messenger (o WhatsApp directo)
2. Se amarra la renta y el cliente manda su ubicación al WhatsApp de negocio
3. Se le confirma ventana de entrega (ej. "11:00 a 3:00 PM")
4. Día de la renta: se entrega el equipo y se avisa previamente
5. Al día siguiente se recoge y se concluye la renta
6. Todo se registra hoy en Excel (rentas + inventario)

**Datos clave del negocio (extraídos del Excel actual):**
- Equipos: Eco-Fresco ($450/día), Turbo-Frío ($650/día), Chispas-Frescas ($550/día, actualmente 0 unidades), calentones Fire Sense y café gratinado ($550/día, $495 con 3+)
- Gas para calentones: tambo 20kg = $200
- Domicilio por zonas de distancia: Zona 1 (6km) a Zona 5 (35km), rango $50–$400
- Accesorios que se prestan: mangueras (10m), extensiones (5/10/15/45m)
- Hay rentas multi-día (hasta 54 días con 25% descuento), clientes recurrentes (Escuela San José, etc.), anticipos parciales, descuentos, cancelaciones y clientes que requieren factura
- Hay un repartidor además del dueño

## 2. Stack

| Capa | Tecnología |
|---|---|
| Frontend + API | Next.js 15 (App Router, TypeScript, Server Actions) |
| UI | Tailwind CSS + shadcn/ui — **mobile-first** (se usa desde el cel en entregas) |
| ORM | Prisma |
| Base de datos | PostgreSQL en Railway |
| Auth | Auth.js (NextAuth v5) con credenciales, roles ADMIN y REPARTIDOR |
| Deploy | Vercel |
| Mapas/distancias | Google Maps (Geocoding + Distance Matrix + deep links) |
| Mensajería | WhatsApp Business Cloud API (Meta) |
| Pagos | Mercado Pago (links de pago / preferencias) |
| Facturación | Facturama o SW Sapien (Fase 10, NO prioridad) |

## 3. Roles

- **ADMIN (dueño):** todo — rentas, clientes, inventario, precios, reportes, pagos
- **REPARTIDOR:** vista del día (entregas/recolecciones asignadas), marcar "en ruta" / "entregado" / "recogido", ver dirección y abrir en Google Maps, disparar mensaje de "vamos en camino". No ve reportes ni edita precios.

## 4. Schema Prisma (base)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Rol {
  ADMIN
  REPARTIDOR
}

enum TipoEquipo {
  AEROCOOLER
  CALENTON
}

enum EstadoUnidad {
  DISPONIBLE
  RENTADA
  MANTENIMIENTO
  BAJA
}

enum EstadoRenta {
  COTIZADA      // cliente interesado, sin confirmar
  CONFIRMADA    // fecha y equipo apartados
  EN_RUTA       // repartidor salió a entregar
  ENTREGADA     // equipo con el cliente
  RECOGIDA      // equipo recuperado
  CONCLUIDA     // pagada y cerrada
  CANCELADA
}

enum MetodoPago {
  EFECTIVO
  TRANSFERENCIA
  LINK_MERCADO_PAGO
  OTRO
}

enum TipoPago {
  ANTICIPO
  LIQUIDACION
  REEMBOLSO
}

enum CanalOrigen {
  MESSENGER
  WHATSAPP
  RECOMENDACION
  RECURRENTE
  OTRO
}

enum TipoAccesorio {
  MANGUERA
  EXTENSION
  TAMBO_GAS
}

enum EstadoTambo {
  LLENO
  VACIO
  EN_CLIENTE
}

model User {
  id           String   @id @default(cuid())
  nombre       String
  email        String   @unique
  passwordHash String
  rol          Rol      @default(REPARTIDOR)
  rentas       Renta[]  @relation("RepartidorRentas")
  createdAt    DateTime @default(now())
}

model Cliente {
  id          String      @id @default(cuid())
  nombre      String
  telefono    String?     // normalizado E.164: +52662XXXXXXX
  canalOrigen CanalOrigen @default(WHATSAPP)
  notas       String?
  rentas      Renta[]
  createdAt   DateTime    @default(now())

  @@index([telefono])
}

model ModeloEquipo {
  id            String     @id @default(cuid())
  tipo          TipoEquipo
  nombre        String     @unique // "Eco-Fresco", "Turbo-Frío", "Fire Sense Café", etc.
  precioDia     Int        // en pesos (enteros, sin centavos)
  precioDia3Mas Int?       // precio con 3+ unidades (calentones: 495)
  specs         Json?      // CFM, área, peso, dimensiones, etc.
  unidades      Unidad[]
}

model Unidad {
  id          String       @id @default(cuid())
  modeloId    String
  modelo      ModeloEquipo @relation(fields: [modeloId], references: [id])
  codigo      String       @unique // etiqueta física: "EF-01", "TF-02", "CAL-05"
  estado      EstadoUnidad @default(DISPONIBLE)
  notas       String?      // "bomba falla", "manchado", etc.
  rentaItems  RentaUnidad[]
  mantenimientos Mantenimiento[]
}

model Mantenimiento {
  id          String   @id @default(cuid())
  unidadId    String
  unidad      Unidad   @relation(fields: [unidadId], references: [id])
  descripcion String
  costo       Int?
  fecha       DateTime @default(now())
  resuelto    Boolean  @default(false)
}

model Accesorio {
  id        String        @id @default(cuid())
  tipo      TipoAccesorio
  descripcion String      // "Extensión 15m", "Manguera 10m", "Tambo #3"
  codigo    String?       @unique
  estadoTambo EstadoTambo? // solo aplica a TAMBO_GAS
  rentas    RentaAccesorio[]
}

model ZonaEnvio {
  id     String @id @default(cuid())
  nombre String // "Zona 1"
  kmMax  Float  // límite superior de la zona
  costo  Int
}

model Renta {
  id              String      @id @default(cuid())
  clienteId       String
  cliente         Cliente     @relation(fields: [clienteId], references: [id])
  estado          EstadoRenta @default(COTIZADA)

  fechaInicio     DateTime    @db.Date
  fechaFin        DateTime    @db.Date // día de recolección
  ventanaEntrega  String?     // "11:00 a 3:00 PM"

  direccion       String
  lat             Float?
  lng             Float?
  linkMaps        String?
  codigoAcceso    String?     // "código 3112#" — aparece seguido en las notas
  distanciaKm     Float?

  costoDomicilio       Int    @default(0)
  domicilioSobrescrito Boolean @default(false) // true si el admin lo editó manual

  descuentoMonto  Int         @default(0)
  descuentoNota   String?     // "25% renta larga", "bomba fallaba"

  requiereFactura Boolean     @default(false)
  facturada       Boolean     @default(false)
  cfdiUuid        String?

  repartidorId    String?
  repartidor      User?       @relation("RepartidorRentas", fields: [repartidorId], references: [id])

  unidades        RentaUnidad[]
  accesorios      RentaAccesorio[]
  pagos           Pago[]
  mensajes        MensajeWhatsApp[]
  notas           String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([fechaInicio, fechaFin])
  @@index([estado])
}

model RentaUnidad {
  id        String @id @default(cuid())
  rentaId   String
  renta     Renta  @relation(fields: [rentaId], references: [id], onDelete: Cascade)
  unidadId  String
  unidad    Unidad @relation(fields: [unidadId], references: [id])
  precioDia Int    // snapshot del precio al momento de rentar

  @@unique([rentaId, unidadId])
}

model RentaAccesorio {
  id          String    @id @default(cuid())
  rentaId     String
  renta       Renta     @relation(fields: [rentaId], references: [id], onDelete: Cascade)
  accesorioId String
  accesorio   Accesorio @relation(fields: [accesorioId], references: [id])
  cargo       Int       @default(0) // gas $200, accesorios normalmente $0
}

model Pago {
  id          String     @id @default(cuid())
  rentaId     String
  renta       Renta      @relation(fields: [rentaId], references: [id])
  monto       Int
  metodo      MetodoPago
  tipo        TipoPago   @default(LIQUIDACION)
  mpPaymentId String?    // id de Mercado Pago si vino por link
  mpLinkUrl   String?
  pagado      Boolean    @default(false) // false = link generado sin pagar
  fecha       DateTime   @default(now())
}

model MensajeWhatsApp {
  id        String   @id @default(cuid())
  rentaId   String
  renta     Renta    @relation(fields: [rentaId], references: [id])
  plantilla String   // "confirmacion", "en_camino", "recordatorio_recoleccion"
  waMessageId String?
  estado    String   // sent / delivered / read / failed
  createdAt DateTime @default(now())
}
```

## 5. Reglas de negocio

### Disponibilidad (crítico)
Una unidad está ocupada para un rango `[inicio, fin]` si existe otra renta activa (CONFIRMADA/EN_RUTA/ENTREGADA) cuyo rango se traslapa:

```
rentaExistente.fechaInicio <= nueva.fechaFin
AND rentaExistente.fechaFin >= nueva.fechaInicio
```

- Al crear/editar una renta, mostrar solo unidades disponibles para esas fechas (y en estado DISPONIBLE, no MANTENIMIENTO/BAJA).
- Vista de calendario de ocupación por modelo: cuántas unidades libres hay cada día.
- Validación server-side con transacción para evitar doble apartado.

### Precios
- Total = Σ(unidades × precioDia × días) + costoDomicilio + cargos accesorios (gas) − descuento
- Calentones: si la renta lleva 3+ calentones, usar `precioDia3Mas` ($495)
- Los precios se toman de `ModeloEquipo` pero se guardan como snapshot en `RentaUnidad.precioDia` (para que cambios futuros de precio no alteren el histórico)
- Descuentos siempre con nota del motivo

### Domicilio automático
1. Al capturar la dirección: geocodificar (o aceptar coordenadas/link de Maps pegado directo — el cliente muchas veces manda `29°06'51.9"N 111°00'34.7"W` o link `maps.app.goo.gl`)
2. Distance Matrix desde la bodega (guardar coords de bodega en env/config)
3. Mapear km → `ZonaEnvio` → costo sugerido
4. El admin puede sobrescribir (`domicilioSobrescrito = true`) — hay envíos de cortesía, recomendados, etc.

### Estados de renta
```
COTIZADA → CONFIRMADA → EN_RUTA → ENTREGADA → RECOGIDA → CONCLUIDA
                ↓ (cualquier punto antes de ENTREGADA)
            CANCELADA
```
- Al pasar a EN_RUTA: opción de disparar WhatsApp "vamos en camino" a todos los clientes de la ruta
- Al pasar a RECOGIDA: las unidades regresan a DISPONIBLE
- CONCLUIDA requiere que Σ pagos confirmados ≥ total (o confirmación manual del admin)

### Saldo y pagos
- `saldoPendiente = total − Σ(pagos con pagado=true)`
- Soportar anticipos (ej. "pagó 20% de anticipo, $455")
- Dashboard debe mostrar rentas con saldo pendiente de forma prominente

## 6. Pantallas principales

1. **Login** (roles)
2. **Dashboard del día** (pantalla principal, mobile-first):
   - Entregas de hoy y recolecciones de hoy, ordenadas
   - Botones grandes: "En ruta", "Entregado", "Recogido", "Abrir en Maps", "WhatsApp"
   - Alertas: saldos pendientes, rentas de mañana
3. **Ruta del día**: mapa con pins de las entregas + botón "Abrir ruta en Google Maps" (deep link con waypoints, máx ~10 paradas por link — si hay más, partir en 2 rutas) + botón "Avisar a todos: vamos en camino"
4. **Rentas**: lista con filtros (estado, fecha, saldo pendiente) + detalle + formulario de captura rápida (cliente → dirección → fechas → equipos disponibles → total calculado en vivo)
5. **Clientes**: lista, historial de rentas por cliente, detección de recurrentes por teléfono
6. **Inventario**: unidades por modelo con estado, mantenimientos, tambos de gas (lleno/vacío/en cliente), accesorios
7. **Calendario de ocupación**: disponibilidad por modelo por día
8. **Reportes** (solo ADMIN): ingresos por semana/mes/temporada, comparativo aerocoolers vs calentones, top clientes, cuentas por cobrar, utilización por unidad
9. **Configuración**: precios, zonas de envío, coords de bodega, plantillas de WhatsApp

## 7. Fases de implementación (una por sesión de Claude Code)

### Fase 0 — Setup
- [ ] `create-next-app` (TS, App Router, Tailwind), shadcn/ui
- [ ] Prisma + PostgreSQL Railway (`DATABASE_URL`)
- [ ] Auth.js v5 con credenciales, middleware de roles
- [ ] Deploy inicial a Vercel, variables de entorno
- [ ] Layout base mobile-first con navegación

### Fase 1 — Modelo de datos + seed
- [ ] Schema Prisma completo (sección 4) + migración
- [ ] Seed: modelos de equipo con precios reales, unidades (EF-01…EF-06, TF-01, TF-02, CAL-01…CAL-20), zonas de envío, accesorios, usuario admin y repartidor

### Fase 2 — Clientes y Rentas (CRUD + estados)
- [ ] CRUD clientes con normalización de teléfono (E.164) y detección de duplicados
- [ ] Formulario de renta con selección de unidades **filtradas por disponibilidad**
- [ ] Cálculo de total en vivo, descuentos, flujo de estados con validaciones
- [ ] Registro de pagos manuales (efectivo/transferencia), anticipos, saldo pendiente

### Fase 3 — Dashboard del día + vista repartidor
- [ ] Entregas/recolecciones de hoy, acciones de un tap
- [ ] Vista restringida para rol REPARTIDOR
- [ ] Deep link a Google Maps por dirección/coords

### Fase 4 — Domicilio automático
- [ ] Parser de entrada: dirección de texto, coordenadas DMS (`29°06'51.9"N…`), links de Google Maps
- [ ] Geocoding + Distance Matrix desde bodega
- [ ] Zona → costo sugerido con override manual

### Fase 5 — Migración del Excel
- [ ] Script en TypeScript (`scripts/migrate-excel.ts`) que lea los dos .xlsx
- [ ] Parseo de: fechas en español sin año ("1 de Marzo", "28 AGOSTO - 1 SEPT" → rango), horas como fracción de Excel, teléfonos en formatos mixtos, filas TOTAL intercaladas (ignorar), estados desde notas (PAGADO/PENDIENTE/CANCELADA/FACTURARA), descuentos, accesorios ("manguera + extensión")
- [ ] Generar CSV de revisión con las filas ambiguas ANTES de insertar
- [ ] Deduplicar clientes por teléfono
- [ ] Marcar rentas históricas como CONCLUIDA (o CANCELADA)

### Fase 6 — Ruta del día
- [ ] Mapa con pins de entregas de hoy (orden sugerido: nearest-neighbor simple desde bodega, no hace falta optimización exacta)
- [ ] Link de ruta multi-parada en Google Maps (dividir si >10 waypoints)

### Fase 7 — WhatsApp Business Cloud API
- [ ] App en Meta for Developers, número dedicado, token permanente
- [ ] Plantillas (requieren aprobación de Meta, iniciar el trámite temprano):
  - `confirmacion_renta`: fecha, ventana de entrega, total
  - `en_camino`: "Ya vamos en camino a entregar tu {equipo}"
  - `recordatorio_recoleccion`: "Mañana pasamos a recoger entre {ventana}"
- [ ] Botón "Avisar a todos" en la ruta del día (envío en lote)
- [ ] Webhook de estados (sent/delivered/read/failed) → `MensajeWhatsApp`

### Fase 8 — Mercado Pago
- [ ] Crear preferencia/link de pago desde la renta (monto = saldo o anticipo)
- [ ] Enviar link por WhatsApp al cliente
- [ ] Webhook de notificaciones → marcar `Pago.pagado = true` y recalcular saldo

### Fase 9 — Reportes
- [ ] Ingresos por semana/mes/temporada, aerocoolers vs calentones
- [ ] Cuentas por cobrar, top clientes, utilización por unidad, ingresos por zona

### Fase 10 — CFDI (posterior, NO prioridad)
- [ ] Evaluar Facturama vs SW Sapien (sandbox primero)
- [ ] Timbrado desde la renta marcada `requiereFactura`, guardar UUID y PDF/XML

## 8. Variables de entorno

```
DATABASE_URL=            # Railway PostgreSQL
AUTH_SECRET=
GOOGLE_MAPS_API_KEY=     # Geocoding + Distance Matrix
BODEGA_LAT=
BODEGA_LNG=
WHATSAPP_TOKEN=          # Meta Cloud API
WHATSAPP_PHONE_ID=
WHATSAPP_VERIFY_TOKEN=   # para el webhook
MP_ACCESS_TOKEN=         # Mercado Pago
MP_WEBHOOK_SECRET=
```

## 9. Riesgos y notas importantes

1. **⚠️ WhatsApp Cloud API y tu número actual:** un número registrado en la Cloud API **deja de poder usarse en la app normal de WhatsApp/WhatsApp Business**. NO registres tu número de negocio actual sin decidirlo bien — lo más seguro es conseguir un número nuevo para la API y conservar el actual para chatear manualmente. Además las plantillas requieren aprobación de Meta (puede tardar días) y los mensajes iniciados por el negocio tienen costo por conversación.
2. **Webhooks en Vercel:** los webhooks de WhatsApp y Mercado Pago van como route handlers (`app/api/webhooks/...`). Verificar firma en ambos.
3. **Migración:** el Excel trae mucha info en texto libre; el script debe ser conservador — mejor exportar dudas a CSV de revisión que adivinar. Las fechas sin año se infieren por la hoja/temporada (coolers 2026, calentones 2023-2024).
4. **Zona horaria:** todo en `America/Hermosillo` (sin horario de verano). Cuidado con `Date` de JS en server (Vercel corre en UTC) — usar date-fns-tz o guardar fechas como `@db.Date`.
5. **Distance Matrix tiene costo** — cachear la distancia por dirección y solo consultar al capturar/editar.
6. **Mobile-first en serio:** el 90% del uso será desde el cel durante entregas. Botones grandes, mínimo tipeo, pegar link de Maps y listo.

## 10. Cómo trabajar este plan con Claude Code

- Una fase por sesión. Al terminar cada fase: migración aplicada, `npm run build` sin errores, commit.
- Antes de la Fase 5, subir los dos Excel a `data/` en el repo (o pasarlos por ruta).
- Mantener un `CLAUDE.md` en la raíz con: stack, comandos (`npm run dev`, `npx prisma studio`, `npx prisma migrate dev`), convenciones (español para dominio de negocio, inglés para código utilitario), y el estado de fases completadas.