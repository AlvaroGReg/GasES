FROM node:22-alpine AS build

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/database/package.json packages/database/package.json
RUN pnpm install --frozen-lockfile

COPY apps/web apps/web
ARG VITE_API_URL
RUN test -n "$VITE_API_URL" && pnpm --filter @gases/web build

FROM nginx:1.27-alpine
ENV PORT=8080
ENV NGINX_ENVSUBST_FILTER=^PORT$
COPY docker/web.nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
