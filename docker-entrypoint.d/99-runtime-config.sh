#!/bin/sh
set -eu

TEMPLATE_PATH=/usr/share/nginx/html/config.template.js
OUTPUT_PATH=/usr/share/nginx/html/config.js

if [ -z "${APP_BACKEND_API_BASE:-}" ] && [ -n "${VITE_BACKEND_API_BASE:-}" ]; then
  APP_BACKEND_API_BASE="$VITE_BACKEND_API_BASE"
fi
if [ -z "${APP_RENDER_API_BASE:-}" ] && [ -n "${VITE_RENDER_API_BASE:-}" ]; then
  APP_RENDER_API_BASE="$VITE_RENDER_API_BASE"
fi
if [ -z "${APP_OPERATOR_APP_BASE:-}" ] && [ -n "${VITE_OPERATOR_APP_BASE:-}" ]; then
  APP_OPERATOR_APP_BASE="$VITE_OPERATOR_APP_BASE"
fi

export APP_BACKEND_API_BASE APP_RENDER_API_BASE APP_OPERATOR_APP_BASE

if [ -f "$TEMPLATE_PATH" ]; then
  envsubst '${APP_BACKEND_API_BASE} ${APP_RENDER_API_BASE} ${APP_OPERATOR_APP_BASE}' \
    < "$TEMPLATE_PATH" > "$OUTPUT_PATH"
fi
