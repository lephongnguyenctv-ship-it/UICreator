---
doc_type: knowledge_base_index
domain: craftland-ugc
version: 1.0.1
last_updated: 2026-10-14
---

# Deployment

Deployment workflows and reusable templates for hosting the team's web apps and services.
This is a module of [Development](../README.md) and the existing [Craftland PUGC umbrella](../../SKILL.md).
Provider-specific details belong in subfolders so future deployment targets can be added here.

## Contents

| Platform / Knowledge | File | Purpose |
|---|---|---|
| RUN Platform | [run-platform/README.md](run-platform/README.md) | Internal container/service deployment on `run.ingarena.net`: auth, project/files, SSH, service/ports, redeploy, Windows templates, resources and recovery. |

## Related knowledge

- [Release Guideline](../release_guideline.md): pre-release and release/hotfix operations for Craftland maps.
- [Game Balance & Visualization](../../game-design/knowledge-pack/README.md): building internal balance websites and player simulators.
- [Development tooling](../README.md): editor, code review, UI mockups and team workflows.


- [Analytics Website Builder](../analytics-website-builder/README.md): building the app before choosing
  a hosting target; [app deployment/operations](../analytics-website-builder/16_deployment_and_operations.md)
  covers artifacts, sessions/keys, supervisor, health and rollback. Provider auth/containers/ports stay here.
