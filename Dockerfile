# Multi-stage build for production deployment
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json package-lock.json ./
COPY packages/admin/package.json ./packages/admin/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./
COPY packages/admin/package.json ./packages/admin/

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy admin source code
COPY packages/admin ./packages/admin

# Build arguments
ARG NODE_ENV=production
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

# Set environment variables for build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client
RUN npx prisma generate --schema=./packages/admin/prisma/schema.prisma

# Build the application
WORKDIR /app/packages/admin
RUN npm run build

# Ensure public directory exists (create empty one if needed)
RUN mkdir -p /app/packages/admin/public

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application from standalone output
COPY --from=builder --chown=nextjs:nodejs /app/packages/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/packages/admin/.next/static ./packages/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/packages/admin/public ./packages/admin/public

# Copy Prisma schema and generated client (needed for runtime)
COPY --from=builder --chown=nextjs:nodejs /app/packages/admin/prisma ./packages/admin/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Add labels for metadata
LABEL org.opencontainers.image.title="Geofence Admin"
LABEL org.opencontainers.image.description="Geofencing admin dashboard and API"
LABEL org.opencontainers.image.source="https://github.com/HCL-CDP-TA/geofence"

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start the application
CMD ["node", "packages/admin/server.js"]
