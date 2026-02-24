# Environment variables: storage (dual Supabase + S3) and Remotion

## Backend – dual storage (legacy Supabase URLs + new media on S3)

To serve **old media from Supabase** and **new media from S3** (no file migration):

- **New media writes** go to S3. **URL generation** uses either Supabase or S3 per media via `blob_storage_backend`.

### Required for dual storage

**Amazon S3 (writes + URLs for new media):**

| Variable | Description |
|----------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `S3_BUCKET_NAME` | S3 bucket name |
| `AWS_REGION` | Optional; default `us-east-1` |

**Supabase (URLs only for legacy media):**

| Variable | Description |
|----------|-------------|
| `SUPABASE_STORAGE_ACCESS_KEY_ID` | Supabase S3-compatible access key |
| `SUPABASE_STORAGE_SECRET_ACCESS_KEY` | Supabase S3-compatible secret key |
| `SUPABASE_STORAGE_ENDPOINT` | e.g. `https://<project>.supabase.co/storage/v1/s3` |
| `SUPABASE_STORAGE_BUCKET_NAME` | Bucket name in Supabase |
| `SUPABASE_STORAGE_REGION` | Optional; default `us-east-1` |

### Optional

| Variable | Description |
|----------|-------------|
| `DEFAULT_STORAGE_BACKEND` | Backend for **new** media: `s3` (default) or `supabase` |
| `CURRENT_BLOB_STORAGE` | Only used when **not** using dual storage (single backend). For dual storage, set both AWS and Supabase vars above; writes use S3. |

With both AWS and Supabase sets set, the app uses **dual storage**: resolver is enabled, `final_url` and asset URLs use the correct backend per media.

---

## Render worker – storage and Remotion

Worker must write **new** renders to the same place the backend expects (S3 for new media). So use S3 for the worker when you use dual storage.

### Storage (worker)

| Variable | Description |
|----------|-------------|
| `CURRENT_BLOB_STORAGE` | Use `s3` so worker uploads go to S3 (for dual storage). |
| `AWS_ACCESS_KEY_ID` | Required when using S3. |
| `AWS_SECRET_ACCESS_KEY` | Required when using S3. |
| `S3_BUCKET_NAME` | Same bucket as backend. |
| `AWS_REGION` | Optional. |

If you still had worker on Supabase, you’d set `CURRENT_BLOB_STORAGE=supabase` and the Supabase storage vars instead.

### Remotion Lambda (30–60s path)

| Variable | Required | Description |
|----------|----------|-------------|
| `REMOTION_SERVE_URL` | Yes | Deployed Remotion site URL (from remotion-app deploy). |
| `REMOTION_LAMBDA_FUNCTION_NAME` | Yes | Lambda function name (from remotion-app deploy). |
| `REMOTION_LAMBDA_REGION` | No | Default `us-east-1`. |
| `REMOTION_COMPOSITION_ID` | No | Default `ReelComposition`. |
| `REMOTION_WORKER_CONCURRENCY` | No | Default `1`. |

Worker also needs **AWS credentials** (for Lambda invoke and presign), same as or separate from S3.

**Beat sync (30–60s pacing):** Pacing styles (rhythmic, viral, dramatic) use beat extraction for cut points and motion. The worker uses **aubio** (CLI `aubio beat`) and **ffprobe** (for duration). For Remotion **Lambda**, include **aubio** and **ffprobe** in the Lambda layer or runtime image so beat extraction works in production; otherwise the worker falls back to a duration-based beat grid. See render-worker README for details.

### Other worker vars (unchanged)

- `REDIS_URL` (or `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`)
- `DATABASE_URL`
- `FFMPEG_WORKER_CONCURRENCY` (optional; default `2`)

---

## Backend – Remotion queue (optional)

| Variable | Description |
|----------|-------------|
| `REMOTION_QUEUE_ENABLED` | Set to `'false'` to send 30–60s jobs to FFmpeg queue instead of Remotion. |
| `REMOTION_ALLOWED_USER_IDS` | Comma-separated user IDs that always use the Remotion queue, even when `REMOTION_QUEUE_ENABLED=false`. Useful for per-user testing. |
| `REMOTION_JOB_ATTEMPTS` | Optional; default `3`. |
| `REMOTION_JOB_BACKOFF_DELAY_MS` | Optional; default `5000`. |

---

## Minimal dual-storage backend `.env` snippet

```env
# S3 (writes + new media URLs)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=your-bucket
AWS_REGION=us-east-1

# Supabase (legacy media URLs only)
SUPABASE_STORAGE_ACCESS_KEY_ID=...
SUPABASE_STORAGE_SECRET_ACCESS_KEY=...
SUPABASE_STORAGE_ENDPOINT=https://xxx.supabase.co/storage/v1/s3
SUPABASE_STORAGE_BUCKET_NAME=your-supabase-bucket
SUPABASE_STORAGE_REGION=us-east-1

# Optional: new media backend (default s3)
DEFAULT_STORAGE_BACKEND=s3
```

Worker for dual storage: same S3 vars + `CURRENT_BLOB_STORAGE=s3` (+ Remotion vars if using Remotion for 30–60s).

---

## S3 CORS for presigned browser uploads (Video Tools)

When the frontend uploads directly to S3 using a presigned PUT URL (e.g. Video Resizer / Compressor), the **S3 bucket must have CORS configured**. Otherwise the browser’s OPTIONS preflight gets 403 and you see “Failed to fetch” in production.

### Steps to add CORS in AWS (bucket `auto-reels` / production)

1. **Open AWS Console** → **S3** → select your bucket (e.g. `auto-reels`, or whatever `S3_BUCKET_NAME` is).
2. Open the **Permissions** tab.
3. Scroll to **Cross-origin resource sharing (CORS)** and click **Edit**.
4. Paste the configuration below (adjust origins if needed), then **Save changes**.

**CORS configuration** (local + production for autoreels.in):

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://autoreels.in",
      "https://www.autoreels.in"
    ],
    "ExposeHeaders": ["ETag"]
  }
]
```

- **AllowedOrigins:** Add every origin that loads your app (exact scheme + host, no trailing slash). Above includes localhost and production.
- **AllowedMethods:** `PUT` is required for presigned uploads; `GET`/`HEAD` are useful for reading objects.
- **AllowedHeaders:** `["*"]` allows `Content-Type` and other headers the browser sends with the PUT.

5. **Retry** the Video Resizer or Compressor on https://autoreels.in; the OPTIONS request should return 200 and the PUT should succeed.

If you still see 403, check the Network tab: the failing request (OPTIONS or PUT) and the response XML will indicate whether it’s CORS or something else (e.g. bucket policy).
