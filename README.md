# MGMP Matematika SMK Kab. Lumajang (Full Stack)

Stack:
- Backend: Bun + Hono, API di `/api`
- DB: SQLite + Drizzle ORM (migrasi via drizzle-kit)
- Frontend: React (Vite) + Tailwind + komponen gaya shadcn
- Deploy/dev via Docker Compose

## Jalankan (Dev)
Terminal 1:
```bash
bun install
cd apps/server && bun run dev
```

Terminal 2:
```bash
cd apps/web && bun run dev
```

Frontend dev: `http://localhost:5173`  
API: `http://localhost:3000/api/health`

## Jalankan (Docker)
```bash
docker compose up -d --build
```
App: `http://localhost:3000`  
API: `http://localhost:3000/api/health`

SQLite disimpan di volume `sqlite_data` (lihat `docker-compose.yml`).

## Migrasi DB
```bash
bun run db:generate
bun run db:migrate
```

