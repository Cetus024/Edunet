# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS build
WORKDIR /app/services/edunets-api

COPY services/edunets-api/package.json services/edunets-api/package-lock.json ./
RUN npm ci --no-audit --no-fund

WORKDIR /app
COPY services/edunets-api ./services/edunets-api
COPY database ./database
RUN npm --prefix services/edunets-api run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    TZ=Asia/Singapore
WORKDIR /app/services/edunets-api

COPY services/edunets-api/package.json services/edunets-api/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build --chown=node:node /app/services/edunets-api/dist ./dist

USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/health >/dev/null || exit 1

CMD ["node", "dist/index.js"]
