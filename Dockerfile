FROM oven/bun:1.3.5 AS deps
WORKDIR /app
COPY package.json bun.lock* ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
RUN bun install

FROM deps AS build
WORKDIR /app
COPY . .
RUN cd apps/web && bun run build
RUN cd apps/server && bun run build

FROM oven/bun:1.3.5 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/apps/server/drizzle ./apps/server/drizzle
COPY --from=build /app/apps/web/dist ./apps/web/dist
EXPOSE 3000
CMD ["bun", "run", "--cwd", "apps/server", "start"]
