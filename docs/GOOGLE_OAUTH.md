# Panduan Konfigurasi Google OAuth (MGMP)

Dokumen ini menjelaskan cara menyiapkan Google OAuth untuk fitur tombol **Masuk** (Beranda) yang mengarah ke endpoint:

- `GET /api/auth/google` (redirect ke Google)
- `GET /api/auth/google/callback` (callback Google)

Implementasi ada di:

- `apps/server/src/auth/google.ts`
- `apps/server/src/auth/session.ts`

## 1. Buat OAuth Client di Google Cloud Console

1. Buka **Google Cloud Console**.
2. Pilih/buat Project.
3. Buka **APIs & Services**:
   - **OAuth consent screen**: isi nama app, email support, dsb.
   - **Credentials** -> **Create Credentials** -> **OAuth client ID**.
4. Pilih **Web application**.

## 2. Set Authorized Redirect URI

Di credential OAuth, set **Authorized redirect URIs** sesuai environment.

### Development (Vite + Server)

Server berjalan di `http://localhost:3000` dan Web di `http://localhost:5173` (atau port lain).

Redirect URI yang dipakai oleh server default-nya:

- `http://localhost:5173/api/auth/google/callback`

Catatan: secara default server akan membangun `GOOGLE_REDIRECT_URI` dari `WEB_ORIGIN`:

- `GOOGLE_REDIRECT_URI = ${WEB_ORIGIN}/api/auth/google/callback`

Kalau `WEB_ORIGIN` kamu beda port (mis. `5174`/`5176`), sesuaikan.

### Production (Satu Domain)

Jika web dan server disajikan dari domain yang sama (server melayani `apps/web/dist`), kamu bisa pakai:

- `https://your-domain.com/api/auth/google/callback`

Pastikan domain production memakai HTTPS supaya cookie bisa `secure`.

## 3. Konfigurasi Environment Variable (Server)

Set env var berikut saat menjalankan `apps/server`:

```bash
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="xxx"

# Origin aplikasi web (tempat user kembali setelah login)
WEB_ORIGIN="http://localhost:5173"

# Opsional: override redirect uri (kalau kamu butuh callback host yang beda)
# GOOGLE_REDIRECT_URI="http://localhost:5173/api/auth/google/callback"

# Untuk signing cookie session (WAJIB diganti di production)
SESSION_SECRET="ganti_dengan_secret_panjang"

# Email yang otomatis mendapat role admin saat login Google
ADMIN_EMAILS="the.real.ferilee@gmail.com"

# CORS untuk /api/*
CORS_ORIGIN="http://localhost:5173"
```

## 4. Cara Kerja Flow di Aplikasi

1. Tombol **Masuk** di Beranda mengarah ke: `GET /api/auth/google`.
2. Server redirect user ke Google OAuth.
3. Setelah user setuju, Google memanggil callback: `GET /api/auth/google/callback?code=...&state=...`.
4. Server menukar `code` menjadi token, memverifikasi `id_token`, lalu membuat cookie session `mgmp_session`.
5. User di-redirect kembali ke `WEB_ORIGIN` dengan query:
   - `/?auth=success` atau `/?auth=error&reason=...`

Endpoint tambahan:

- `GET /api/auth/me` -> `{ user: ... | null }`
- `POST /api/auth/logout` -> hapus cookie session

## 5. Checklist Troubleshooting

- Error `bad_state`:
  - Biasanya karena cookie `mgmp_oauth_state` tidak tersimpan/terkirim.
  - Pastikan tidak memblokir cookie, dan `WEB_ORIGIN` sesuai.
- Error `bad_audience`:
  - `GOOGLE_CLIENT_ID` di server tidak sama dengan yang dipakai untuk generate `id_token`.
- Callback tidak bisa diakses:
  - Redirect URI di Google Console harus persis sama dengan `GOOGLE_REDIRECT_URI`.
- Di production cookie tidak kebaca:
  - Pastikan `WEB_ORIGIN` `https://...` supaya cookie `secure` sesuai.
