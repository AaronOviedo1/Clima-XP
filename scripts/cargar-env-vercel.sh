#!/bin/bash
# Carga en Vercel las variables de las notificaciones push, leyéndolas del .env
# local. Las cuatro van a los tres entornos: si las claves VAPID difieren entre
# preview y production, las suscripciones creadas en uno son rechazadas (403) en
# el otro.
#
#   vercel login          # una sola vez, abre el navegador
#   bash scripts/cargar-env-vercel.sh
#
# Después hay que redesplegar: las variables nuevas no entran en un deploy ya hecho.
set -e
cd "$(dirname "$0")/.."

for VAR in VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT CRON_SECRET; do
  VALOR=$(grep "^$VAR=" .env | cut -d'"' -f2)
  if [ -z "$VALOR" ]; then
    echo "⚠️  $VAR está vacía en .env — se omite"
    continue
  fi
  for ENTORNO in production preview development; do
    printf '%s' "$VALOR" | vercel env add "$VAR" "$ENTORNO" --force > /dev/null 2>&1 \
      && echo "✅ $VAR → $ENTORNO" \
      || echo "❌ $VAR → $ENTORNO (¿sesión de vercel expirada? corre: vercel login)"
  done
done

echo
echo "Listo. Redespliega para que tomen efecto:  vercel --prod"
