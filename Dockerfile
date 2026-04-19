# ── Estágio 1: build ──────────────────────────────────────────────────────────
FROM node:20-slim AS build

WORKDIR /app

# Instalar OpenSSL e ca-certificates (requerido pelo Prisma)
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ── Estágio 2: produção ────────────────────────────────────────────────────────
FROM node:20-slim AS production

WORKDIR /app

# Instalar OpenSSL e ca-certificates (requerido pelo Prisma em runtime)
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copia apenas o necessário do estágio de build
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma

EXPOSE 3000

# Executa migrações e inicia a aplicação
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
