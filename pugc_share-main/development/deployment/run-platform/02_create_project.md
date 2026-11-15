---
doc_type: deployment_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "plant-vs-zombie/run-platform-deploy-skills/02-create-project.md"
---

# 02 - Find or Create a Project

> RUN Platform reference imported on 2026-10-14; live API details were not revalidated.
> Apply only within an authorized deployment task; see [scope and verification](README.md#integration-and-scope).

## Find existing projects first
```
GET /api/projects/
```
Returns `{ "projects": [...], "total": N }`. **The list does not include `ssh_host`** - call `GET /api/projects/{id}` for that. To find "the project the user means", match on `name`, or fetch details and match on `ssh_port`/`ssh_username` the user gave you (PowerShell example in [templates/deploy.ps1](templates/deploy.ps1)).

## Create
```
POST /api/projects/
Content-Type: application/json

{ "name": "my-project", "description": "optional" }
```
Name rules: 3-50 chars, letters/digits/underscore/hyphen only, **must not start with a digit**. Returns the project incl. `id` (needed for all later calls).

```bash
curl -X POST https://run.ingarena.net/api/projects/ \
  -H "Authorization: Bearer pk_xxx" -H "Content-Type: application/json" \
  -d '{"name":"my-project","description":"My web app"}'
```

## Project details
```
GET /api/projects/{id}
```
Key fields: `status`, `docker_initialized`, `ssh_host`, `ssh_port`, `ssh_username`, `ssh_password`, `default_domain`, `custom_domain`, `cpu_limit`, `memory_limit` (MB), `storage_limit` (MB), `is_public`, `database`, `milvus_database`.

- `ssh_*` are only populated **after the container is initialized**.
- `database` / `milvus_database` are `null` until requested.
- `ssh_host` depends on the node: main-disk projects -> `run.ingarena.net`; data-node projects -> the node's public IP (e.g. `124.156.197.28`). **Always use the returned value.**

## Update name/description/domain
```
PUT /api/projects/{id}      { "name": "...", "description": "...", "custom_domain": "my-domain" }
```
All fields optional. See [08](08_domains_databases_resources.md) for domains.

## Done-criteria
You have the project `id`, and `GET /api/projects/{id}` returns it. Next: [03_import_files.md](03_import_files.md) or, if the user already has files in the container, [04](04_init_container_and_ssh.md).
