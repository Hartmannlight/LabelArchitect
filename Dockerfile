FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS build
WORKDIR /workspace/printhub-sdk
COPY printhub-sdk/package*.json ./
RUN npm ci
COPY printhub-sdk ./
RUN npm run build
WORKDIR /workspace/LabelArchitect
COPY LabelArchitect/package*.json ./
RUN npm ci
COPY LabelArchitect ./
RUN npm run build

FROM nginx:stable-alpine-slim@sha256:77da26c31397bf6694b4bf93275f5b40b0b120ba1b8f114264b603e592c561d6 AS runtime
RUN apk upgrade --no-cache \
    && apk add --no-cache gettext \
    && sed -i 's@/var/run/nginx.pid@/tmp/nginx.pid@; s@/run/nginx.pid@/tmp/nginx.pid@; /^user /d' /etc/nginx/nginx.conf \
    && chown -R nginx:nginx /etc/nginx/conf.d /var/cache/nginx /usr/share/nginx/html
COPY --from=build --chown=nginx:nginx /workspace/LabelArchitect/dist /usr/share/nginx/html
COPY --from=build /workspace/LabelArchitect/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build --chown=nginx:nginx /workspace/LabelArchitect/public/config.template.js /usr/share/nginx/html/config.template.js
COPY --from=build /workspace/LabelArchitect/docker-entrypoint.d/99-runtime-config.sh /docker-entrypoint.d/99-runtime-config.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/99-runtime-config.sh \
    && chmod +x /docker-entrypoint.d/99-runtime-config.sh
ENV APP_BACKEND_API_BASE=/api APP_RENDER_API_BASE=/api APP_API_UPSTREAM=http://127.0.0.1:8000
USER nginx
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
