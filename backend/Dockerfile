# Multi-stage Dockerfile for Backend (NestJS + Prisma)
FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* prisma7.config.ts ./
COPY prisma ./prisma/

RUN pnpm install

COPY tsconfig*.json nest-cli.json ./
COPY src ./src/

RUN pnpm prisma generate
RUN pnpm run build

# Production Runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* prisma7.config.ts ./
COPY prisma ./prisma/

RUN pnpm install --prod

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated

EXPOSE 4000

CMD ["node", "dist/main.js"]
