FROM node:20-alpine AS build

WORKDIR /workspace

COPY printhub-sdk ./printhub-sdk
COPY LabelArchitect ./LabelArchitect

WORKDIR /workspace/printhub-sdk
RUN npm install
RUN npm run build

WORKDIR /workspace/LabelArchitect
RUN npm install
RUN npm run build

FROM nginx:1.27-alpine

RUN apk add --no-cache gettext

COPY --from=build /workspace/LabelArchitect/dist /usr/share/nginx/html
COPY --from=build /workspace/LabelArchitect/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/LabelArchitect/public/config.template.js /usr/share/nginx/html/config.template.js
COPY --from=build /workspace/LabelArchitect/docker-entrypoint.d/99-runtime-config.sh /docker-entrypoint.d/99-runtime-config.sh

RUN sed -i 's/\r$//' /docker-entrypoint.d/99-runtime-config.sh \
    && chmod +x /docker-entrypoint.d/99-runtime-config.sh

EXPOSE 80
