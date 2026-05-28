# Menggunakan RustFS dari Proyek Lain

Panduan ini fokus pada cara memakai RustFS sebagai S3-compatible object storage dari aplikasi/proyek lain.

## Endpoint

Gunakan salah satu endpoint berikut sesuai lokasi aplikasi:

```env
# Jika aplikasi mengakses lewat internet/domain publik
S3_ENDPOINT=https://s3.gemastika.or.id
```

```env
# Jika aplikasi berjalan sebagai container di network ferileenet
S3_ENDPOINT=http://global-storage:9000
```

## Credential

Credential aplikasi sama dengan credential RustFS:

```env
S3_ACCESS_KEY=isi_dengan_RUSTFS_ACCESS_KEY
S3_SECRET_KEY=isi_dengan_RUSTFS_SECRET_KEY
```

Jika perlu cek nilai di server:

```bash
docker exec global-storage env | grep RUSTFS
```

## 1. Buat Bucket

1. Login ke RustFS Console:

   ```text
   https://console.gemastika.or.id/rustfs/console/auth/login
   ```

2. Buat bucket untuk proyek.

Contoh nama bucket:

```text
mathflix
ruangtugas
gemastika-assets
```

Gunakan nama bucket huruf kecil, tanpa spasi, dan konsisten dengan nama proyek.

## 2. Konfigurasi Environment Aplikasi

Untuk aplikasi yang mengakses RustFS melalui domain publik:

```env
S3_ENDPOINT=https://s3.gemastika.or.id
S3_ACCESS_KEY=isi_dengan_RUSTFS_ACCESS_KEY
S3_SECRET_KEY=isi_dengan_RUSTFS_SECRET_KEY
S3_BUCKET=nama-bucket-proyek
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
```

Untuk aplikasi yang berjalan sebagai container di network `ferileenet`:

```env
S3_ENDPOINT=http://global-storage:9000
S3_ACCESS_KEY=isi_dengan_RUSTFS_ACCESS_KEY
S3_SECRET_KEY=isi_dengan_RUSTFS_SECRET_KEY
S3_BUCKET=nama-bucket-proyek
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
```

Catatan:

- `S3_FORCE_PATH_STYLE=true` penting untuk S3-compatible storage seperti RustFS.
- Region bisa memakai `us-east-1` kecuali aplikasi membutuhkan nilai lain.
- Jangan taruh `S3_SECRET_KEY` di frontend/browser. Simpan hanya di backend/server.

## 3. Contoh Node.js / TypeScript

Install dependency:

```bash
npm install @aws-sdk/client-s3
```

### Client

```ts
import { S3Client } from "@aws-sdk/client-s3";

export const s3 = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
});
```

### Upload File

```ts
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "./s3";

await s3.send(
  new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: "uploads/test.txt",
    Body: "hello rustfs",
    ContentType: "text/plain",
  })
);
```

### Download File

```ts
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "./s3";

const result = await s3.send(
  new GetObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: "uploads/test.txt",
  })
);

const body = await result.Body?.transformToString();
console.log(body);
```

### Hapus File

```ts
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "./s3";

await s3.send(
  new DeleteObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: "uploads/test.txt",
  })
);
```

## 4. URL File

Jika bucket/object dibuat publik, pola URL dengan path-style:

```text
https://s3.gemastika.or.id/nama-bucket/path/file.ext
```

Contoh:

```text
https://s3.gemastika.or.id/mathflix/uploads/poster.png
```

Untuk file privat, jangan expose URL langsung. Gunakan backend aplikasi untuk membuat presigned URL atau proxy download.

## 5. Checklist Integrasi

- Bucket sudah dibuat di RustFS Console.
- Aplikasi memakai endpoint yang benar:
  - publik: `https://s3.gemastika.or.id`
  - internal Docker: `http://global-storage:9000`
- `S3_ACCESS_KEY` dan `S3_SECRET_KEY` sesuai credential RustFS.
- `S3_FORCE_PATH_STYLE=true`.
- Container aplikasi join network `ferileenet` jika memakai endpoint internal.
- Secret hanya dipakai di backend/server.
