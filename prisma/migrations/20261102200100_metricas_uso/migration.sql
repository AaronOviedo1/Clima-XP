-- ============================================================================
-- metricas_uso — contrato de uso para el panel pasta-stats
--
-- Única puerta del panel a esta base: lee esta vista con el rol
-- `panel_metricas` y nada más. Contrato en pasta-stats:
-- lib/validations/uso.ts; copia versionada allá en supabase/externas/clima/.
-- Si tocas una, toca la otra. Es aparte de la integración de cobros
-- (src/lib/integracion.ts): aquélla manda pesos, esta vista solo cuenta.
--
-- Reglas del contrato:
--   1. CONTEOS, nunca pesos. Rentas y pagos traen montos y nada de eso sale
--      de aquí: el dinero ya llega al panel por la integración.
--   2. Se mide por "createdAt" (cuándo alguien usó la app), no por las fechas
--      de la renta.
--   3. FLUJO y STOCK no se mezclan.
--   4. Lo migrado del Excel no es uso: esas rentas llevan ⟦mig⟧ al inicio de
--      `notas` (scripts/migrate-excel.ts) y se cuentan aparte. Los clientes
--      que creó esa migración no traen marca en su fila, así que las altas de
--      cliente no se miden: sin un discriminador en la misma fila, contarlas
--      habría leído la migración como uso.
--
-- Ojo con la zona: Prisma guarda "createdAt" como `timestamp` SIN zona, en
-- UTC. Primero se declara UTC y luego se pasa a Hermosillo; con un solo
-- `at time zone` Postgres lo leería al revés.
--
-- Vistas de pantalla: el contrato no tiene dimensión de usuario, así que el
-- usuario va en el slug (`v_<pantalla>_<usuario>`). Solo los últimos 6 meses y
-- sin rellenar ceros, para no acercarse al tope de 600 filas.
--
-- Sin security_invoker a propósito: corre como su dueño, así el rol lector no
-- necesita permisos sobre las tablas.
-- ============================================================================

create or replace view public.metricas_uso as
with ahora as (
  select (now() at time zone 'America/Hermosillo')::date                    as hoy,
         date_trunc('month', now() at time zone 'America/Hermosillo')::date as mes_actual
),
eventos_uso as (
  -- Levantar una renta es el pulso de la app: es la unidad de uso.
  select 'rentas'::text as metrica, 'Rentas capturadas'::text as etiqueta,
         'renta'::text  as unidad,  true                      as principal,
         r."createdAt"  as creado
  from public."Renta" r
  where r.notas is null or r.notas not like '⟦mig⟧%'
  union all
  select 'rentas_migradas', 'Rentas migradas del Excel', 'renta', false, r."createdAt"
  from public."Renta" r
  where r.notas like '⟦mig⟧%'
  union all
  select 'consultas_copiloto', 'Consultas al copiloto', 'consulta', false, c."createdAt"
  from public."ConsultaCopiloto" c
),
por_mes as (
  select e.metrica, e.etiqueta, e.unidad, e.principal,
         date_trunc('month', (e.creado at time zone 'UTC') at time zone 'America/Hermosillo')::date as periodo,
         count(*)::numeric                as valor,
         max(e.creado at time zone 'UTC') as ultimo_evento
  from eventos_uso e
  group by 1, 2, 3, 4, 5
),
catalogo as (
  select distinct metrica, etiqueta, unidad, principal from por_mes
),
inicio as (
  select metrica, min(periodo) as primer_periodo from por_mes group by 1
),
rejilla as (
  -- Ceros explícitos en meses sin actividad, desde el primer mes con dato.
  select c.metrica, c.etiqueta, c.unidad, c.principal, g.periodo::date as periodo
  from catalogo c
  join inicio i using (metrica)
  cross join ahora a
  cross join lateral generate_series(
    greatest(i.primer_periodo, (a.mes_actual - interval '23 months')::date),
    a.mes_actual,
    interval '1 month'
  ) as g(periodo)
),
vistas as (
  -- Usuario en slug: «Administrador» → administrador. Sin `unaccent`.
  select trim(both '_' from regexp_replace(
           translate(lower(u.nombre), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', '_', 'g'
         ))                                                       as usuario,
         u.nombre,
         s.pantalla,
         date_trunc('month', (s."createdAt" at time zone 'UTC') at time zone 'America/Hermosillo')::date as periodo,
         count(*)::numeric                                        as valor,
         max(s."createdAt" at time zone 'UTC')                    as ultimo_evento
  from public."ScreenView" s
  join public."User" u on u.id = s."userId"
  cross join ahora a
  where s."createdAt" >= ((a.mes_actual - interval '5 months') at time zone 'America/Hermosillo') at time zone 'UTC'
  group by 1, 2, 3, 4
)
-- ------------------------------------------------------------------- FLUJO
select
  r.periodo,
  r.metrica,
  r.etiqueta,
  'FLUJO'::text                 as naturaleza,
  r.unidad,
  coalesce(m.valor, 0)::numeric as valor,
  r.principal,
  least(a.hoy, (r.periodo + interval '1 month - 1 day')::date) as medido_hasta,
  m.ultimo_evento
from rejilla r
cross join ahora a
left join por_mes m on m.metrica = r.metrica and m.periodo = r.periodo

-- ------------------------------------------------- FLUJO: vistas de pantalla
union all
select
  v.periodo,
  left('v_' || regexp_replace(v.pantalla, '[^a-z0-9]+', '_', 'g') || '_' || v.usuario, 40),
  left(v.nombre || ' · ' || initcap(replace(replace(v.pantalla, '/', ' › '), '-', ' ')), 60),
  'FLUJO'::text,
  'vista'::text,
  v.valor,
  false,
  least(a.hoy, (v.periodo + interval '1 month - 1 day')::date),
  v.ultimo_evento
from vistas v
cross join ahora a

-- ------------------------------------------------------------------- STOCK
-- Una fila por métrica en el mes en curso: es una foto de hoy.
union all
-- Activa = el equipo está apartado, en camino o con el cliente.
select a.mes_actual, 'rentas_activas'::text, 'Rentas activas'::text, 'STOCK'::text, 'renta'::text,
       (select count(*) from public."Renta" r
         where r.estado in ('CONFIRMADA', 'EN_RUTA', 'ENTREGADA'))::numeric,
       false, a.hoy, null::timestamptz
from ahora a
union all
select a.mes_actual, 'unidades_rentadas'::text, 'Equipos rentados'::text, 'STOCK'::text, 'equipo'::text,
       (select count(*) from public."Unidad" u where u.estado = 'RENTADA')::numeric,
       false, a.hoy, null::timestamptz
from ahora a
union all
-- «Cuentas», no «usuarios activos»: esto no sabe quién entró.
select a.mes_actual, 'cuentas'::text, 'Cuentas en la app'::text, 'STOCK'::text, 'cuenta'::text,
       (select count(*) from public."User")::numeric,
       false, a.hoy, null::timestamptz
from ahora a;

comment on view public.metricas_uso is
  'Contrato de uso para el panel pasta-stats. Conteos, nunca dinero. FLUJO = '
  'creado en el mes (por createdAt, hora de Hermosillo); STOCK = foto de hoy. '
  'Copia versionada en el repo del panel: supabase/externas/clima/.';

-- ---------------------------------------------------------------- permisos
-- El panel no entra con service_role: entra con un rol cuyo único privilegio
-- es leer esta vista.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'panel_metricas') then
    create role panel_metricas nologin noinherit;
  end if;
end
$$;

revoke all on public.metricas_uso from anon, authenticated;
grant usage  on schema public       to panel_metricas;
grant select on public.metricas_uso to panel_metricas;
grant panel_metricas to authenticator;   -- para que PostgREST pueda asumirlo

-- BOTÓN DE PÁNICO (corta solo al panel):
--     revoke select on public.metricas_uso from panel_metricas;
