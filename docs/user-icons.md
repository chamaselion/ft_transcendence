# User icon storage

## Setup

The backend uses a private S3-compatible bucket. In Docker, configure:

```dotenv
S3_ENDPOINT=http://obj-storage:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=<application-access-key>
S3_SECRET_KEY=<application-secret-key>
S3_BUCKET=<bucket-name>
```

The local stack uses Rustfs as the S3 object storage solution. The bucket will be created dynamically on startup, depending
on the `S3_BUCKET` value. The `S3_BUCKET` value will be dynamically changed for the backend code for CRUD operations on
the object storages bucket.

Rebuild the backend and nginx after setting `.env`:

```sh
docker compose up -d --build backend nginx
```

There is no icon metadata table or icon column on the user model. Each user's
image is stored at `user-icons/<user-id>.webp` in S3.

## Endpoints

All endpoints require the normal session cookie.

| Method | Path                | Response                                               |
| ------ | ------------------- | ------------------------------------------------------ |
| PUT    | `/api/auth/me/icon` | `200 { "avatarUrl": "/api/auth/me/icon?v=<version>" }` |
| GET    | `/api/auth/me/icon` | `200 image/webp`, or `404` if absent                   |
| DELETE | `/api/auth/me/icon` | `204`, including when already absent                   |

PUT accepts exactly one multipart file named `icon`, up to 2 MiB. Supported inputs
are non-animated JPEG, PNG and WebP, with at most 16 million decoded pixels.
Images are decoded, oriented, resized to fit a 256px square crop, and re-encoded
as WebP without input metadata. The backend validates image contents rather than
trusting the filename or declared MIME type.

`GET /api/auth/me` includes `user.avatarUrl`, or `null` for the frontend's initials
fallback. This uses S3 HEAD metadata, with the object's ETag as its URL version.
A metadata lookup failure falls back to initials without invalidating the login.
The read route is **self-only**: it can't be used to display another
user's icon. Responses use `Cache-Control: private, no-store`.

| Code | Reason                         |
| ---- | ------------------------------ |
| 200  | Success                        |
| 400  | invalid multipart/image data   |
| 401  | missing auth cookie ('Bearer') |
| 503  | storage/s3 failure             |
| 429  | throttled writes               |
