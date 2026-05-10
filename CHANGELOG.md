# Changelog

All notable changes to `n8n-nodes-teable-io` are documented here.

---

## [0.2.6] — 2026-05-10

### Security

- **Prototype pollution prevention** — `buildFieldsObject` now uses `Object.create(null)` as the base object and explicitly blocks reserved keys (`__proto__`, `constructor`, `prototype`) from being used as field names.
- **URL credential leak fix** — `validateBaseUrl` no longer echoes the raw URL in error messages, preventing accidental exposure of embedded credentials in execution logs.

### Fixed

- **`Return All` memory cap** — `teableApiRequestAllItems` now stops at 100,000 records regardless of table size, preventing OOM on very large tables.
- **`Create Many` / `Update Many` JSON errors** — invalid JSON in the Records field now throws a clean `NodeOperationError` with a readable message instead of a raw JS stack trace.

---

## [0.2.5] — 2026-05-10

### Security

- **SSRF protection** — `baseUrl` is now validated against a blocklist of private and loopback address ranges (`localhost`, `127.x`, `10.x`, `192.168.x`, `172.16-31.x`, `169.254.x`). Non-HTTP/S protocols are also rejected. Prevents credential misuse in shared or cloud-hosted n8n deployments.
- **Path injection prevention** — All resource IDs (`tableId`, `recordId`, `baseId`, `spaceId`) are validated to contain only safe characters before being interpolated into API URL paths.
- **Credential test improved** — Test endpoint changed from `GET /api/space` to `GET /api/auth/user`. This endpoint is scoped to the token identity rather than a resource, so tokens with any permission level (space, base, table, or record) pass cleanly. `401` is now the only failure case — no more 403 ambiguity.
- **Error message hardening** — Invalid JSON parameter errors no longer echo raw user input in the message, preventing accidental exposure of sensitive values in n8n execution logs.

### Fixed

- **Bulk operation rate limiting** — `Create Many` and `Update Many` now insert a 200 ms delay between batch iterations to reduce the risk of hitting Teable API rate limits on large payloads.
- **Trigger memory growth** — `recordState` in the polling trigger is now capped at 5 000 entries. Oldest entries are evicted when the cap is exceeded, preventing unbounded growth in n8n workflow static data that could OOM the n8n process or silently lose records.
- **TypeScript build** — Added `DOM` to `tsconfig.json` lib so `URL` and `setTimeout` resolve correctly without requiring additional type packages.

---

## [0.2.4] — 2026-05-10

### Fixed

- Trigger: `createdOrUpdated` event now correctly emits `event: "created"` or `event: "updated"` per record based on `createdTime` vs `lastPollTime`
- Trigger: `Record Updated` event now excludes newly created records (records where `createdTime > lastPollTime` are filtered out)
- Upsert: match field is now a dropdown (loadOptionsMethod) instead of free-text to prevent typos
- Upsert: filter operator changed from `=` to `is` (Teable API validation requirement)
- Search: query is now sent as a JSON tuple `[value, fieldId|null, false]` — Teable rejected plain strings

---

## [0.2.3] — 2026-05-10

### Fixed

- Trigger: proper `504` / server error handling — poll cycle advances timestamp and skips silently on transient server errors
- Trigger: removed server-side date filter on `orderBy` to prevent 504 timeouts on large tables; filtering is now done client-side

---

## [0.2.2] — 2026-05-10

### Fixed

- Added `IPollFunctions` to `teableApiRequest` type union so the trigger can call shared request helpers without TypeScript errors

---

## [0.2.1] — 2026-05-10

### Fixed

- Trigger: previous/current record output structure corrected
- Trigger: `504` handling correctly reads `httpCode` from `NodeApiError`

---

## [0.2.0] — 2026-05-10

### Added

- **Field name dropdowns** — `Create`, `Update`, and `Upsert` operations now load field names dynamically from the selected table instead of requiring manual text input
- **Polling Trigger node** (`Teable Trigger`) — polls for new, updated, or new-or-updated records on a configurable schedule; emits `current` and `previous` field snapshots per record

---

## [0.1.x] — Prior releases

Initial releases covering:

- `record`: Get All, Get, Create, Create Many, Update, Update Many, Delete, Upsert, Search
- `table`: Get All, Get Schema, Get Views
- `space`: List Spaces, List Bases
- Dynamic Space → Base → Table cascading dropdowns
- Return All auto-pagination (skip/take)
- Visual filter builder + raw JSON filter override
- Credential test against Teable API

---

## Roadmap

- **Webhook trigger** — real-time record events via Teable webhooks (replaces polling)
- **Additional record operations** — bulk delete, record history, and more
