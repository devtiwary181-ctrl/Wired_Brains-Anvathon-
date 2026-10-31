# Multi-stage production build for DisasterReady India Unified Single-Server
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies including devDependencies for TypeScript compilation
RUN npm ci

# Copy backend source and Prisma schema
COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

# Build TypeScript to dist
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5001

# Install curl for container health check
RUN apk add --no-cache curl

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy generated Prisma client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma

# Copy compiled backend
COPY --from=builder /app/dist ./dist

# Copy frontend static files and Stitch screens
COPY stitch-reference ./stitch-reference

# Create upload directory
RUN mkdir -p uploads && chown -R node:node /app

USER node

EXPOSE 5001

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5001/api/v1/health || exit 1

CMD ["node", "dist/server.js"]
