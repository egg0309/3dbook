# 构建上下文为仓库根目录（见根目录 docker-compose.yml）
FROM node:22-alpine AS build

WORKDIR /app

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ ./

ARG VITE_AGENT_MODE=live
ARG VITE_AGENT_API_URL=/api/chat
ARG VITE_AGENT_TIMEOUT_MS=30000
ENV VITE_AGENT_MODE=${VITE_AGENT_MODE} \
    VITE_AGENT_API_URL=${VITE_AGENT_API_URL} \
    VITE_AGENT_TIMEOUT_MS=${VITE_AGENT_TIMEOUT_MS}

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
