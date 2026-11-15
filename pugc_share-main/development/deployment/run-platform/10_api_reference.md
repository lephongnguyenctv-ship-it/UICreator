---
doc_type: deployment_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "plant-vs-zombie/run-platform-deploy-skills/10-api-reference.md"
---

# 10 - API Quick Reference

> RUN Platform reference imported on 2026-10-14; live API details were not revalidated.
> Apply only within an authorized deployment task; see [scope and verification](README.md#integration-and-scope).

Base `https://run.ingarena.net/api`, header `Authorization: Bearer pk_xxx`. `{id}` = project id. Async operations return a `task_id` -> `GET /projects/task/{task_id}/status` (`status`, `progress`, `result`, `logs`).

## Auth
| Method | Path | Notes |
|---|---|---|
| GET | `/auth/me` | verify key |
| GET | `/auth/api-key` | read key |
| POST | `/auth/api-key/reset` | rotate key |

## Projects
| Method | Path | Notes |
|---|---|---|
| POST | `/projects/` | `{name, description}`; name 3-50, `[A-Za-z0-9_-]`, no leading digit |
| GET | `/projects/` | list (no `ssh_host`) |
| GET | `/projects/{id}` | details incl. ssh_*, db, domain, quotas |
| PUT | `/projects/{id}` | name/description/custom_domain |
| POST | `/projects/check-domain` | `{domain_prefix}` |

## Files
| Method | Path | Notes |
|---|---|---|
| GET | `/projects/{id}/files` | list |
| GET | `/projects/{id}/files/content` | read a file |
| POST | `/projects/{id}/upload-zip` | multipart `file` |
| POST | `/projects/{id}/upload-files` | multipart `files[]` + `paths[]` (full relative paths) |
| POST | `/projects/{id}/import-git` | `{repo_url, branch, access_token}` |
| GET | `/projects/{id}/import-status/{task_id}` | poll |
| DELETE | `/projects/{id}/files` | delete listed paths (ask) |
| DELETE | `/projects/{id}/clear` | wipe all (ask) |
| GET | `/projects/{id}/download` | ZIP (202 + task for big projects) |
| GET | `/projects/{id}/download-status/{task_id}` | poll |
| GET | `/projects/{id}/export` | ZIP |

## Docker / ports / SSH
| Method | Path | Notes |
|---|---|---|
| GET | `/projects/{id}/docker/status` | `hasContainer,isInitialized,isRunning,containerStatus` |
| POST | `/projects/{id}/docker/initialize` | `{force_reinitialize}` async |
| GET | `/projects/{id}/docker/initialization` | `status, progress, message` |
| POST | `/projects/{id}/docker/start` | |
| POST | `/projects/{id}/docker/stop` | |
| GET | `/projects/{id}/docker/logs?tail=100` | container logs |
| POST | `/projects/{id}/docker/sync-resources` | apply resource limits |
| GET | `/projects/{id}/docker/port-mappings` | list |
| POST | `/projects/{id}/docker/port-mapping` | `{container_port}` |
| DELETE | `/projects/{id}/docker/port-mapping` | `{container_port}` |
| GET | `/projects/{id}/ssh/status` | sshd status only |
| POST | `/projects/{id}/ssh/restart` | |

## Databases
| Method | Path |
|---|---|
| POST/DELETE | `/projects/{id}/database` (`{db_name}`) |
| POST/DELETE | `/projects/{id}/milvus-database` (`{db_name}`) |

## API proxy / resources
| Method | Path |
|---|---|
| GET/POST | `/projects/{id}/api-proxy` |
| POST | `/projects/{id}/expansion-request` |
| GET | `/projects/{id}/expansion-requests` |
| GET | `/projects/{id}/resource-usage` |
| GET | `/projects/{id}/storage-usage` |

## Backups
`GET /backup/status`, `POST /backup`, `GET /backup/history`, `GET /backup/preview`, `GET|PUT /backup/settings`, `POST /backup/restore`, `POST /backup/join-gitlab`, `GET /backup/task/{task_id}` (all under `/projects/{id}`).

## Collaborators / sharing
`GET|POST /collaborators`, `PUT|DELETE /collaborators/{cid}`, `GET /user-permission`, `PUT /public-status` (**source-code publish: forbidden without explicit consent**). Never call `/public/publish`.

## Project detail example (shape)
```json
{ "id": 1, "name": "my-project", "status": "running", "docker_initialized": true,
  "ssh_host": "run.ingarena.net", "ssh_port": 22001, "ssh_username": "project_user_1", "ssh_password": "***",
  "default_domain": "...", "custom_domain": null, "is_public": false,
  "cpu_limit": 1.0, "memory_limit": 1024, "storage_limit": 5120,
  "database": { "host": "10.16.100.92", "port": 3306, "database": "...", "username": "...", "password": "***" },
  "milvus_database": null }
```
