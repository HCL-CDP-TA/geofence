# syntax=docker/dockerfile:1

# Builder stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files for workspace resolution
COPY package*.json ./
COPY packages/admin/package.json ./packages/admin/
COPY packages/admin/prisma ./packages/admin/prisma/

# Install dependencies
RUN npm ci

# Copy admin source code
COPY packages/admin ./packages/admin

# Generate Prisma client
RUN npx prisma generate --schema=./packages/admin/prisma/schema.prisma

# Build Next.js application (standalone output)
WORKDIR /app/packages/admin
RUN npm run build

# Runner stage
FROM node:20-slim AS runner

WORKDIR /app

# Install postgresql-client and OpenSSL for Prisma
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user with home directory
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 --gid nodejs --create-home nextjs

# Copy prisma for migrations - copy all Prisma packages and dependencies
COPY --from=builder --chown=nextjs:nodejs /app/packages/admin/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin ./node_modules/.bin

# Copy standalone Next.js build
COPY --from=builder --chown=nextjs:nodejs /app/packages/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/packages/admin/.next/static ./packages/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/packages/admin/public ./packages/admin/public

# Copy docker entrypoint script
COPY --chmod=755 docker-entrypoint.sh /docker-entrypoint.sh

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NPM_CONFIG_CACHE=/app/.npm-cache

# Create npm cache directory with proper permissions
RUN mkdir -p /app/.npm-cache && chown -R nextjs:nodejs /app/.npm-cache

# Add labels for metadata
LABEL org.opencontainers.image.title="Geofence Admin"
LABEL org.opencontainers.image.description="Geofencing admin dashboard and API"

EXPOSE 3000

USER nextjs

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "packages/admin/server.js"]
