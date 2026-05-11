# n8n-nodes-teable

An [n8n](https://n8n.io/) community node for [Teable.io](https://teable.io) — the fast, real-time, no-code database built on Postgres.

Replace clunky HTTP nodes with a proper Teable integration: dynamic dropdowns, full CRUD, bulk operations, upsert, and auto-pagination — all in one node.

[![npm version](https://img.shields.io/npm/v/n8n-nodes-teable-io.svg)](https://www.npmjs.com/package/n8n-nodes-teable-io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Installation

In your n8n instance go to **Settings → Community Nodes → Install** and enter:

```
n8n-nodes-teable-io
```

Or install via npm (self-hosted n8n):

```bash
npm install n8n-nodes-teable-io
```

---

## Credentials

Create a **Teable API** credential with:

| Field | Description |
|---|---|
| **API Token** | Your personal access token from Teable account settings |
| **Base URL** | `https://app.teable.io` (default) or your self-hosted URL |

After saving, click **Test** — n8n verifies the token works regardless of which permission scope it was issued with (space, base, table, or record level).

---

## Nodes

### Teable (action node)

#### Record

| Operation | Description |
|---|---|
| **Get All** | List records with optional filter, sort, view, field selection, and auto-pagination |
| **Get** | Fetch a single record by its ID |
| **Create** | Create a new record with a field-value UI |
| **Create Many** | Bulk-create from a JSON array (auto-batched at 1 000 per request) |
| **Update** | Patch fields on a single record |
| **Update Many** | Bulk-update from a JSON array |
| **Delete** | Delete a record by ID |
| **Upsert** | Create or update based on a unique field match |
| **Search** | Full-text or field-scoped search |

#### Table

| Operation | Description |
|---|---|
| **Get All** | List all tables in a base |
| **Get Schema** | Return all fields with their types and settings |
| **Get Views** | List all views for a table |

#### Space / Base

| Operation | Description |
|---|---|
| **List Spaces** | All spaces accessible to your token |
| **List Bases** | All bases within a space |

---

### Teable Trigger (polling trigger)

Polls for new or updated records on a schedule you set in the workflow settings.

| Event | Description |
|---|---|
| **New Record** | Fires when a record is added |
| **Record Updated** | Fires when an existing record is modified (excludes newly created records) |
| **New or Updated Record** | Fires on any change |

Each trigger output includes:
- `event` — `"created"` or `"updated"`
- `current` — current field values (flattened for easy expression access)
- `previous` — previous field snapshot (null on first run)

---

## Usage Tips

**Finding IDs:** Run *Space → List Spaces* then *Space → List Bases* to get your IDs, or copy them from the Teable URL.

**Return All:** Toggle on "Return All" in *Get All* to automatically paginate through every record (uses skip/take internally, max 1 000 per page).

**Field Key Type:** Switch between *Field Name* (human-readable) and *Field ID* (`fldXXX`) per operation.

**Upsert:** Pick the match field from the dropdown — the node searches for a record with that value and updates it, or creates a new one if not found.

**Bulk operations:** Pass a JSON array to *Create Many* / *Update Many*. Each update object needs `id` and `fields`:
```json
[
  { "id": "recABC123", "fields": { "Status": "Done" } },
  { "id": "recXYZ456", "fields": { "Status": "In Progress" } }
]
```

**Filter JSON:** The *Get All* filter follows Teable's filter schema:
```json
{
  "conjunction": "and",
  "filterSet": [
    { "fieldId": "fldXXX", "operator": "=", "value": "Active" }
  ]
}
```

---

## Known Limitations

| Limitation | Detail |
|---|---|
| **n8n version** | `usableAsTool` (AI Agent support) requires n8n ≥ 1.22.0. Workflow node works on any supported n8n version. |
| **Large table sorting** | Ordering by `createdTime` or `lastModifiedTime` on very large tables can cause 504 timeouts. The trigger falls back to unordered fetching automatically. The main node does not — avoid sorting by system fields on tables with millions of rows. |
| **Trigger poll volume** | The trigger fetches up to the configured limit per poll cycle. If your table receives bursts larger than that limit between polls, some records may be missed. Raise the limit or shorten the poll interval to compensate. |
| **Static crawl only** | JS-rendered pages are not relevant here, but the Teable API is REST-only — there is no real-time webhook trigger yet. Polling introduces latency equal to your poll interval. |
| **Return All cap** | All `Return All` operations are hard-capped at 100,000 records to prevent out-of-memory crashes in n8n. |

---

## Roadmap

- **Webhook trigger** — real-time record events via Teable webhooks (no polling)
- **Additional record operations** — bulk delete, record history, and more

---

## Security

`0.2.5` introduced a security hardening pass:

- SSRF protection on the `baseUrl` credential field
- Path injection prevention on all resource ID parameters
- Improved credential test endpoint (works with any token scope)
- Error message hardening (no raw user input in logs)

See [CHANGELOG.md](CHANGELOG.md) for full details.

---

## Development

```bash
# Install dependencies
npm install

# Build (compiles TypeScript to dist/)
npm run build

# Link to local n8n for testing
npm link
cd ~/.n8n && mkdir -p nodes && cd nodes
npm link n8n-nodes-teable-io

# Start n8n — the Teable node appears in the node picker
npx n8n start
```

---

## Author

Built and maintained by **ZACHARIA Kimotho (Imperol)**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-ZACHARIA%20Kimotho-0077B5?logo=linkedin)](https://www.linkedin.com/in/zacharia-kimotho/)
[![GitHub](https://img.shields.io/badge/GitHub-Imperol3-181717?logo=github)](https://github.com/Imperol3)

---

## License

[MIT](LICENSE) © ZACHARIA Kimotho (Imperol)
