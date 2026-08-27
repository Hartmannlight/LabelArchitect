#!/bin/sh
set -eu

TEMPLATE_PATH=/usr/share/nginx/html/config.template.js
OUTPUT_PATH=/usr/share/nginx/html/config.js
NGINX_TEMPLATE_PATH=/etc/nginx/templates/default.conf.template
NGINX_OUTPUT_PATH=/etc/nginx/conf.d/default.conf

if [ -z "${APP_BACKEND_API_BASE:-}" ] && [ -n "${VITE_BACKEND_API_BASE:-}" ]; then
  APP_BACKEND_API_BASE="$VITE_BACKEND_API_BASE"
fi
if [ -z "${APP_RENDER_API_BASE:-}" ] && [ -n "${VITE_RENDER_API_BASE:-}" ]; then
  APP_RENDER_API_BASE="$VITE_RENDER_API_BASE"
fi
if [ -z "${APP_OPERATOR_APP_BASE:-}" ] && [ -n "${VITE_OPERATOR_APP_BASE:-}" ]; then
  APP_OPERATOR_APP_BASE="$VITE_OPERATOR_APP_BASE"
fi
if [ -z "${APP_API_UPSTREAM:-}" ] && [ -n "${APP_BACKEND_API_BASE:-}" ]; then
  APP_API_UPSTREAM="$APP_BACKEND_API_BASE"
fi

# Only size-list characters may be interpolated into JavaScript.
APP_LABEL_SIZE_PRESETS=$(printf '%s' "${APP_LABEL_SIZE_PRESETS:-${VITE_LABEL_SIZE_PRESETS:-}}" | tr -cd '0-9xX., ')
export APP_BACKEND_API_BASE APP_RENDER_API_BASE APP_OPERATOR_APP_BASE APP_API_UPSTREAM APP_LABEL_SIZE_PRESETS

if [ -f "$TEMPLATE_PATH" ]; then
  envsubst '${APP_BACKEND_API_BASE} ${APP_RENDER_API_BASE} ${APP_OPERATOR_APP_BASE} ${APP_LABEL_SIZE_PRESETS}' \
    < "$TEMPLATE_PATH" > "$OUTPUT_PATH"
fi

if [ -f "$NGINX_TEMPLATE_PATH" ]; then
  envsubst '${APP_API_UPSTREAM}' < "$NGINX_TEMPLATE_PATH" > "$NGINX_OUTPUT_PATH"
fi
