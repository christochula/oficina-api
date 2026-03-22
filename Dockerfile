# ── Estágio 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Remove dependências de desenvolvimento após o build
RUN npm ci --omit=dev

# ── Estágio 2: produção ────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Copia apenas o necessário do estágio de build
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma

EXPOSE 3000

# Executa migrações e inicia a aplicação
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
