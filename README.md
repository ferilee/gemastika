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

## Integrasi RustFS (Gemastika)

Untuk aplikasi Gemastika gunakan bucket:

`gemastika-assets`

Konfigurasi environment backend:

```env
S3_ENDPOINT=https://s3.gemastika.or.id
S3_ACCESS_KEY=isi_dengan_RUSTFS_ACCESS_KEY
S3_SECRET_KEY=isi_dengan_RUSTFS_SECRET_KEY
S3_BUCKET=gemastika-assets
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_BASE_URL=https://s3.gemastika.or.id
```

Jika aplikasi dijalankan sebagai container yang berada di network `ferileenet`, endpoint bisa diganti:

```env
S3_ENDPOINT=http://global-storage:9000
```

Endpoint upload internal Gemastika:

`POST /api/uploads/image` (multipart form-data, field `file`, optional `scope`: `news|portfolio`)
