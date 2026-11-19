FROM node:22-alpine

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/database/package.json packages/database/package.json
RUN pnpm install --frozen-lockfile

COPY packages/database packages/database
COPY apps/api apps/api
RUN pnpm --filter @gases/api build

CMD ["node", "apps/api/dist/main.js"]
