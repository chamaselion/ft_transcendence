# User icon storage

## Setup

The backend uses a private S3-compatible bucket. In Docker, configure:

```dotenv
S3_ENDPOINT=http://obj-storage:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=<application-access-key>
S3_SECRET_KEY=<application-secret-key>
```

The storage service currently uses the `icon-store` bucket. Create it in the RustFS console and grant the application key
`s3:GetObject`, `s3:PutObject`, and `s3:DeleteObject` for objects in that bucket.
Grant `s3:ListBucket` for the `user-icons/` prefix so missing objects can return
`404` rather than an ambiguous access-denied response.
Keep anonymous bucket access disabled. Bucket creation is an administration step;
the API does not need bucket-administration permissions. Browser S3 CORS settings
are unnecessary because all image traffic goes through the authenticated API.

Rebuild the backend and nginx after setting `.env`:

```sh
docker compose up -d --build backend nginx
```

There is no icon metadata table or icon column on the user model. Each user's
image is stored at `user-icons/<user-id>.webp` in S3.

On startup, `src/db/removeUserIconsTable.js` migrates active uploaded icons from
the previous layout to these deterministic keys, deletes old objects, and drops
`user_icons`. The migration runs before the server accepts requests and is a no-op
when the table is absent. It retains the table if storage operations fail and can
resume on the next startup. Legacy URL-only/default rows are removed with the
table; users without an uploaded S3 icon use the frontend initials fallback.
Stop older backend instances before starting the upgraded version.

## Endpoints

All endpoints require the normal session cookie. User identity comes from the
session, never from multipart fields or the filename.

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
The read route is **self-only**: it must not be used to display another
user's icon. Responses use `Cache-Control: private, no-store`.

```sh
# cookies.txt contains a valid login session cookie.
curl --cacert <local-ca.pem> -b cookies.txt \
  -X PUT -F 'icon=@avatar.png' https://localhost:8443/api/auth/me/icon

curl --cacert <local-ca.pem> -b cookies.txt \
  https://localhost:8443/api/auth/me/icon -o avatar.webp

curl --cacert <local-ca.pem> -b cookies.txt \
  -X DELETE https://localhost:8443/api/auth/me/icon
```

Invalid multipart/image data returns `400`, missing authentication returns `401`,
oversized uploads return `413`, throttled writes return `429`, and storage/database
failures return `503`. Writes are limited to ten per minute per user. nginx permits
3 MiB API request bodies to accommodate multipart overhead.
