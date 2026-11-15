---
doc_type: deployment_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "plant-vs-zombie/run-platform-deploy-skills/08-domains-databases-resources.md"
---

# 08 - Domains, Databases, Resources, API Proxy, Backups, Collaborators

> RUN Platform reference imported on 2026-10-14; live API details were not revalidated.
> Apply only within an authorized deployment task; see [scope and verification](README.md#integration-and-scope).

All optional. Only do what the user asked for.

## Custom domain
```
POST /api/projects/check-domain      { "domain_prefix": "my-app" }
PUT  /api/projects/{id}              { "custom_domain": "my-app" }     -> https://my-app.run.ingarena.net
PUT  /api/projects/{id}              { "custom_domain": "" }           -> unbind
```
A domain is **not** public deployment ([00](00_safety_and_rules.md)).

## MySQL
```
POST /api/projects/{id}/database     { "db_name": "mydb" }
DELETE /api/projects/{id}/database   (ask first)
```
Credentials come back in the response and later in `GET /api/projects/{id}` -> `database` {host, port, database, username, password}.
The source snapshot recorded **inside the container: `10.16.100.92:3306`**; from outside: `43.173.171.237:3306`. Verify addresses against current project/platform details before connecting. Keep credentials in approved environment variables or a credential store, never in git.

## Milvus (vector DB)
```
POST /api/projects/{id}/milvus-database    { "db_name": "myvectordb" }
```
Details in `GET /api/projects/{id}` -> `milvus_database` {host, port (19530), database, username, password, admin_ui}.

## Resource expansion (do not over-request)
```
POST /api/projects/{id}/expansion-request
{ "memory_limit": 2048, "storage_limit": 10240, "reason": "evidence-based explanation (<= 500 chars)" }
```
Limits:
- `memory_limit`, `storage_limit` (MB): multiples of 1024, **at most 2x the current quota per request**; request again after the first takes effect if still insufficient.
- `cpu_limit`: absolute cap **2 cores**; if the project already has >= 2, do not send the field - tell the user to contact an admin.
- **Project id <= 1172 (main-disk projects): memory expansion is not accepted** - never send `memory_limit`; tell the user to contact an admin. CPU/disk still allowed.
- `reason` is required and must cite measurements (OOM log, disk usage). Do not request before the app has run.
- Approval by an admin is required. History: `GET .../expansion-requests`. Usage: `GET .../resource-usage`, `.../storage-usage`.

## API proxy (needs a custom domain)
```
GET  /api/projects/{id}/api-proxy
POST /api/projects/{id}/api-proxy
{ "version": 1, "proxies": [ { "name": "openai", "target_url": "https://api.openai.com",
    "path_prefix": "/proxy/openai", "headers": { "Authorization": "Bearer <key>" } } ] }
```
Then `https://<domain>.run.ingarena.net/proxy/openai/v1/...` is proxied. (The platform's own doc shows a garbled field name for the prefix; it is a path prefix such as `/proxy/<name>` - confirm against the current `skill.md`.)

## Backups / version control
```
GET  /api/projects/{id}/backup/status
POST /api/projects/{id}/backup               { "message": "optional" }
GET  /api/projects/{id}/backup/history?limit=20&offset=0
POST /api/projects/{id}/backup/restore       { "commit_sha": "abc123...", "backup_current": true }
GET/PUT /api/projects/{id}/backup/settings   { "enabled": true, "gitignore_content": "node_modules/\n.env\ndist/" }
GET  /api/projects/{id}/backup/preview, POST .../backup/join-gitlab, GET .../backup/task/{task_id}
```
Restore overwrites the project - keep `backup_current: true`.

## Collaborators
`GET/POST /api/projects/{id}/collaborators`, `PUT/DELETE .../collaborators/{cid}`, `GET .../user-permission`. `PUT .../public-status` is the **source-code publish switch - forbidden without explicit user consent**.
