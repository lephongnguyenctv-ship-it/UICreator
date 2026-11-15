---
doc_type: deployment_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "plant-vs-zombie/run-platform-deploy-skills/03-import-files.md"
---

# 03 - Import Project Files (first upload)

> RUN Platform reference imported on 2026-10-14; live API details were not revalidated.
> Apply only within an authorized deployment task; see [scope and verification](README.md#integration-and-scope).

Skip if `GET /api/projects/{id}/files` already lists files. **This chapter is for the first import. For later small changes use rsync/scp ([06](06_update_code_redeploy.md))** - the upload API is easy to misuse (files land in the wrong directory).

Ask whether the user has a local runnable project (-> ZIP/files) or wants to develop inside the container.

## Option A - ZIP (best for first import)
Remove `node_modules`, build caches and secrets first.
```
POST /api/projects/{id}/upload-zip      (multipart/form-data, field: file)
```
- < 50 MB: synchronous result.
- Larger: background; response has `task_id` -> poll `GET /api/projects/{id}/import-status/{task_id}` until `status` is `completed` (`processing|completed|failed`, `progress`, `message`, `files_count`).
- Rejected if > 50,000 files or > 2 GB unpacked. A `warnings` field is returned if `node_modules` etc. were detected.

```bash
curl -X POST https://run.ingarena.net/api/projects/$ID/upload-zip \
  -H "Authorization: Bearer $KEY" -F "file=@project.zip"
```

## Option B - individual files
```
POST /api/projects/{id}/upload-files    (multipart: files[] + paths[])
```
`paths[]` must match `files[]` one-to-one and be the **full relative path** (`public/app.js`, not `app.js`). Without correct `paths` the server falls back to the bare filename and writes into the project **root**.

## Option C - from Git
```
POST /api/projects/{id}/import-git
{ "repo_url": "https://github.com/user/repo.git", "branch": "main", "access_token": "<only for private repos>" }
```
Async: poll `import-status/{task_id}`. Never log the token.

## Verify
`GET /api/projects/{id}/files` lists the expected tree. Delete/clear endpoints exist (`DELETE .../files`, `DELETE .../clear`) - ask the user before using them.

## Other file endpoints
`GET .../files/content`, `GET .../download` (ZIP; > 5000 files returns 202 + `task_id`, poll `download-status/{task_id}`; throttled to 3 MB/s), `GET .../export`.
