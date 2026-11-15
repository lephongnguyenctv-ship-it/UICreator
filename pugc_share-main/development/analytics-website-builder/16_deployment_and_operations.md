---
doc_type: development_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "pugc_tracking/exports/analytics-website-builder/16-deployment-and-operations.md"
---

# Deployment and Operations

> Imported reference snapshot (2026-10-14): product-specific defaults and implementation
> limitations require validation for the target app. See [integration and canonical owners](README.md#integration-and-canonical-owners).

[Skill index](README.md) · [Diagnostics](17_diagnostics_and_verification.md)

## Portable runtime

The reference Docker base uses Node 20 and a supervised `npm start` entrypoint. Pin and review a supported Node runtime for the new deployment rather than assuming that historical base image is the best current choice.

Bind to the platform's interface/port (`HOST=0.0.0.0`, operator-configured `PORT`; the reference uses 8501). Provide `/health` returning a simple successful response. A healthy process does not prove Google login, source access or calculations work.

Run through a supervisor if the app offers controlled self-restart. Direct `node server.js` can serve data but cannot reliably implement its own replacement. Package `run_server.js` with the worker entrypoint.

## Artifact preparation

Build an explicit deployment allowlist, typically:

```text
Dockerfile
package.json and lockfile if present
server.js
run_server.js
lib/
public/
validated non-secret runtime config/templates
```

Include every worker/frontend module. Missing `lib/calculationWorker.js` breaks calculation isolation; missing split config breaks startup/config loading; missing public assets breaks the UI. No compilation step exists in the reference frontend, but its asset cache versions still matter.

Do not package the entire workstation/repository blindly. Exclude Git history, local virtual environments, logs, downloads, private backups, token/session stores, encryption keys, live webhook config and private AI preferences. `.gitignore` does not protect Docker/upload artifacts. Review the generated archive/container context independently.

Install dependencies from the lockfile when supplied; avoid changing dependency versions just to package. Supply installation-specific config and secrets through approved runtime mechanisms, not a shareable archive.

## Hosting workflow

Choose a provider from the [Deployment index](../deployment/README.md).
If the operator explicitly selects [RUN Platform](../deployment/run-platform/README.md),
reuse its project/auth/import/container/SSH/port workflow and the app's supervisor entrypoint below.
RUN already provides the container: omit the Dockerfile from its SSH/upload artifact;
include it only for a verified host that builds images.


The original project uses an organization-specific upload/check/deploy service. This export intentionally omits its identity, URLs, workspace IDs and gateway details. Use the operator's own deployment CLI/API/MCP connector with verified arguments, never guessed tool names or identifiers.

1. Validate code syntax and every included config/schema.
2. Run targeted synthetic calculation/privacy/cache checks.
3. Generate and inspect the sanitized artifact.
4. Upload to the explicitly authorized project/environment.
5. Run platform build/deployment checks and inspect errors.
6. Deploy; record the new release/version privately.
7. Verify process health, Google callback and one authorized dashboard flow.
8. Verify static assets and the expected updated UI on the public installation.
9. Retain rollback artifacts/config privately; clean only confirmed temporary packaging files.

## Persistent state

Separate code release, operational config, encrypted token/session store and encryption key. Decide which survive restart/redeploy. Keep stable keys with the intended private store; losing the key can make existing tokens unusable.

Local JSON persistence is a single-instance convenience, not a distributed database. Multiple replicas require coordinated writes, shared sessions/config or sticky routing, shared quota control, scheduled-job ownership and a clear cache invalidation model. Restart/cache-clear/debug state affect one instance unless explicitly coordinated.

## Proxy and timeouts

Configure trusted proxy/canonical origin correctly for HTTPS OAuth callbacks and secure cookies. Observe gateway request limits. Increasing a timeout alone does not fix CPU blocking, long quota queues or giant response serialization.

Move expensive calculations off the request event loop, show staged progress and use background diagnostics for longer tests. Verify the worker and new code are actually deployed; a local fix does not update another server.

## Restart and rollback

Admin restart requires explicit confirmation, no active diagnostic/API/snapshot work, draining connections and a supervisor replacing the server. Confirm a changed instance ID. Export investigation logs before restart; process caches/debug history are lost.

Prefer config/schema-compatible rollback. Do not overwrite private operational config with an older code bundle that cannot read its current access schema. Confirm health and access restrictions again after rollback.

## Example local checks

```text
node --check server.js
node --check run_server.js
node --check public/app.js
npm start
```

Also check edited `lib/` and frontend modules, parse JSON/includes and validate schemas. No real provider, administrator or source IDs are required for synthetic tests.
