# List documents

Base path: `/api/documents` — see [Documents API](README.md) for auth, the permission model and common errors.

- Method: `GET`
- Path: `/`

Returns the caller's own documents **plus every document shared with them** —
or every document in the system if the caller is an admin. Each entry carries
the caller's `permission` for that document.

### Query parameters

| Parameter | Values | Default | Meaning |
| --- | --- | --- | --- |
| `q` | any text, max 100 chars | — | matches `title` **or** `content`, case-insensitive |
| `scope` | `own`, `shared`, `all` | `all` | your own documents, the ones shared with you, or both |
| `sort` | `updatedAt`, `createdAt`, `title` | `updatedAt` | |
| `order` | `asc`, `desc` | `desc` | |
| `limit` | 1–100 | 20 | page size |
| `offset` | 0 or more | 0 | rows to skip |

`%` and `_` in `q` are matched literally, not as SQL wildcards.

There is deliberately **no filter by `permission`**. The permission is computed
per document (ownership, a share row, or the admin role) rather than stored, so
it cannot be expressed in the query — filtering the rows afterwards would leave
`total` counting documents that were then discarded. `scope` answers the same
question and does translate into SQL.

For an admin, `scope=all` means every document in the system, while `own` and
`shared` still mean their own and the ones shared with them.

Success response (`200`):

```json
{
  "documents": [
    {
      "id": "uuid",
      "title": "...",
      "content": "...",
      "permission": "editor",
      "owner": { "id": "uuid", "login": "alice" },
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  ],
  "pagination": { "total": 42, "limit": 20, "offset": 0 }
}
```

`total` is the number of matches **before** paging, so a client can tell how
many pages there are.

Errors: `400` for an unknown `sort`, `order` or `scope`, a `limit` outside
1–100, a non-numeric `limit`/`offset`, or a `q` longer than 100 characters. An
unknown sort field is rejected rather than silently ignored — the value would
otherwise end up inside the SQL `ORDER BY` clause, where it cannot be passed as
a bound parameter.
