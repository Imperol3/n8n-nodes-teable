# n8n-nodes-teable

An [n8n](https://n8n.io/) community node for [Teable.io](https://teable.io) — the fast, real-time, no-code database built on Postgres.

Replace clunky HTTP nodes with a proper Teable integration: dynamic dropdowns, full CRUD, bulk operations, upsert, and auto-pagination — all in one node.

[![npm version](https://img.shields.io/npm/v/n8n-nodes-teable.svg)](https://www.npmjs.com/package/n8n-nodes-teable)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Installation

In your n8n instance go to **Settings → Community Nodes → Install** and enter:

```
@imperol3/n8n-nodes-teable
```

Or install via npm (self-hosted n8n):

```bash
npm install @imperol3/n8n-nodes-teable
```

---

## Credentials

Create a **Teable API** credential with:

| Field | Description |
|---|---|
| **API Token** | Your personal access token from Teable account settings |
| **Base URL** | `https://app.teable.io` (default) or your self-hosted URL |

After saving, click **Test** — n8n will verify the token against your spaces.

---

## Resources & Operations

### Record (primary CRM resource)

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
| **Search** | Full-text search across all fields |

### Table

| Operation | Description |
|---|---|
| **Get All** | List all tables in a base |
| **Get Schema** | Return all fields with their types and settings |
| **Get Views** | List all views for a table |

### Space / Base

| Operation | Description |
|---|---|
| **List Spaces** | All spaces accessible to your token |
| **List Bases** | All bases within a space |

---

## Usage Tips

**Finding IDs:** Run *Space → List Spaces* then *Space → List Bases* to get your IDs, or copy them from the Teable URL.

**Return All:** Toggle on "Return All" in *Get All* to automatically paginate through every record (uses skip/take internally).

**Field Key Type:** Switch between *Field Name* (human-readable) and *Field ID* (fldXXX) per operation.

**Upsert:** Set the "Unique Field Name" to the field you want to match on — the node searches for a record with that value and updates it, or creates a new one.

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

## Development

```bash
# Install dependencies
npm install

# Build (compiles TypeScript to dist/)
npm run build

# Link to local n8n for testing
npm link
cd ~/.n8n
mkdir -p nodes && cd nodes
npm link n8n-nodes-teable

# Start n8n — the Teable node will appear in the node picker
npx n8n start
```

---

## Publishing to npm

```bash
# Bump version
npm version patch   # or minor / major

# Build & publish
npm run build
npm publish --access public
```

---

## License

[MIT](LICENSE) © Kimotho / Phoenix Consultants
