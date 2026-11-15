---
name: craftland-release-guideline
description: Pre-release timeline and checklist for shipping a Craftland/UGC map, organized by phase (4 weeks → release). Defines who does what (Dev, QA, GD) at each milestone — performance testing, QA cycle, banner requests, build & publish registration, final checklists, and minor/major update rules. Also covers release/hotfix approvals, readiness checks, version and room observation, and bug containment-to-remediation. Use when planning a release, hotfix, or post-release incident response.
type: development-knowledge
domain: craftland-ugc
status: authoritative
version: 1.1.0
last_updated: 2026-09-19
source: "Release Guide Line.xlsx; team-shared live-ops notes (2026-09-19)"
---

# Release Guideline (Pre-Release, Release & Hotfix)

> A phase-by-phase plan for releasing a map, counting down from **4 weeks
> before release** to launch. Each task lists the **owner role** and key links.
>
> **Roles:** `[Dev]` developer · `[QA]` quality assurance · `[GD]` game designer ·
> `[GD/Dev]` either · `[PIC release]` person responsible for shipping the build ·
> `[PIC/ALL]` release PIC plus the whole team · `[ALL]` whole team. **Publishing
> Team** is the release-approval owner. In this
> document, **GMT** means the internal access/tool used to close old rooms; the
> exact expansion is intentionally not inferred here.

---

## Phase 1 — 4 Weeks Before Release: Tech & Testing Preparation

| Owner | Task | Details |
|---|---|---|
| **[Dev]** | Prepare Client & Server Test | 1. Fully configure all on/off items for Client & Server Test (see checklist below). 2. Finish setting up the map **before** handing it to QA for the Performance Test. |
| **[QA]** | Run Client & Server Test | Internal QA runs the client test & server test → confirm **Pass / Fail** with the team. |
| **[QA]** | QA Cycle (~1 week) | QA begins QC **immediately after** Client & Server Test pass. Flow: **Log Bug → Fix → Retest**. Bug list is kept in the VN PUGC QA sheet; after 3 days, send to SH QA. When sending to SH, also upload the **GDD** to the shared Drive. |

**Links**
- Client/Server test config checklist: https://docs.google.com/spreadsheets/d/1X9-yN0Elt_T08M_DB73lcC66ppOEQcMxKTeqy_q07ec/edit?gid=717719564#gid=717719564
- Bug list (VN): https://docs.google.com/spreadsheets/d/1_J8for2Risfy0Gvl5qbeMSvxlE1olrN-0fHDGwOCyUU/edit?pli=1&gid=2132870177#gid=2132870177
- Bug list (SH): https://docs.google.com/spreadsheets/d/1n0TTN46230IIsClwUQJ4orpfmEfPUTHvfLW82ysbeto/edit?pli=1&gid=1506393734#gid=1506393734
- GDD upload (Drive): https://drive.google.com/drive/folders/0AK_f-4C_DLJgUk9PVA

> Performance test procedures: [`client_performance_test.md`](client_performance_test.md) · [`server_performance_test.md`](server_performance_test.md)

---

## Phase 2 — 3 Weeks Before Release: Banner Request & Publishing Plan

| Owner | Task | Details |
|---|---|---|
| **[GD/Dev]** | Request Banner | Sizes: **338×216**, **790×216**; Cover image: **420×182**. Only request when there is a promotion plan, but **mandatory at least 3 weeks before release**. Brief must clearly state: **Gameplay · Main hook · Desired vibe/emotion**. |
| **[Dev]** | Build & Setup | Package the project and send to **Tuan**, or send the **map code** to Tuan. There are **3 map codes for 3 different servers**. |
| **[GD/Dev]** | Register publish (after a stable build) | Fill in the publish Google Sheet and notify all placeholders: **Leader, Publishing team, PM team, QA team**. |

**Links**
- Banner request form: https://docs.google.com/forms/d/e/1FAIpQLSfYnm7M2ef0pjH_zgW5XLyCo93RrS4Vg1IR0Dk_RtkRllpe6Q/viewform
- Publish info sheet: https://docs.google.com/spreadsheets/d/1o8Nx6fwm6_-YzSgSRFNto35UthrQR1nq_3C3RRaMh2Y/edit?gid=1166729799#gid=1166729799
- Publish template: https://docs.google.com/spreadsheets/d/1HEa0C7p3wzPvkqDzRS-ayDapl26lG72oXL0LoyPI_5s/edit?gid=0#gid=0

---

## Phase 3 — 2 Weeks Before Release: Finalize & Register

| Owner | Task | Details |
|---|---|---|
| **[Dev]** | Pre-release checklist | Complete the **Release Checklist**. Each project has a different checklist defined by QA input. |
| **[GD/Dev]** | Announce the fixed release plan | Notify: **Leader, Publishing team, PM team, QA team**. |

**Links**
- Release checklist (QA input): https://docs.google.com/spreadsheets/d/1_J8for2Risfy0Gvl5qbeMSvxlE1olrN-0fHDGwOCyUU/edit?gid=1346098177#gid=1346098177

## Release Readiness Checklist (Before Release)

Complete these checks before the release or hotfix is sent through the final
approval flow:

> **Performance is a release gate.** The client test is required, and the server
> test is required by default. When the server-test exemptions in
> [`server_performance_test.md`](server_performance_test.md) apply, record the
> applicable exemption; it does not waive the client test. Whenever a test is
> required, it must pass the canonical hard requirements defined in
> [`client_performance_test.md`](client_performance_test.md) and
> [`server_performance_test.md`](server_performance_test.md). A hard-requirement
> failure blocks release; soft metrics must still be recorded and addressed.

| Check | Pass condition |
|---|---|
| **Client performance** | Full-load client test passes all hard requirements: average FPS **> 25**, BigJank **< 50**, stutter rate **< 3%**, no overheating, **0 crashes**, no severe noticeable stuttering, and no prolonged freezes. Memory **< 700 MB** is a soft target. See [`client_performance_test.md`](client_performance_test.md) for the canonical standard. |
| **Server performance** | When required, server stress test is valid (**CCU > 1,000**) and passes all hard requirements: average/peak processor **< 60% / < 80%**, average/peak memory **< 60% / < 80%**, and downlink **< 50 KB/s/user** for new projects. Soft targets are mean `match_fps` **> 15 FPS** and Map GameBytes **< 10 MB**; existing-project traffic grace and the two documented server-test exemptions follow [`server_performance_test.md`](server_performance_test.md). |
| **External game presentation** | Game banner and outside-game description have the correct content and dates. |
| **In-game communication** | In-game change logs are updated with the correct content and dates. |
| **Code review** | The code-review bot has been used and its result has been reviewed before release. |
| **Localization** | Confirm whether new localization is required and verify that the latest approved localization is included. |

## Release / Hotfix Operating Flow

Use the following communication and approval order for both a normal release and
a hotfix:

1. **Dev sends the update to QA.**
2. **PIC sends the update email to the Craftland team at the same time.**
3. **After QA passes, QA sends the QA-pass email.**
4. **Publishing Team sends the email granting release permission.**
5. **PIC release ships the build, then sends the release-complete email.**

For a hotfix, the update email should make the affected bug, mitigation, and
scope of the hotfix explicit so that the approval and observation trail is
unambiguous.

---

## Phase 4 — At Release

| Owner | Task | Details |
|---|---|---|
| **[PIC release]** | Execute release | Follow the release/hotfix operating flow above and send the release-complete email after the build is live. |
| **[PIC/ALL]** | Observe release | Create a new room and verify that players can enter the new version; then apply the room/session handling rules below. |

## Release Observation: Version and Room Handling

- Create a **new room** after release to verify that the new version is live and
  joinable.
- A **mid-join** can still join an old version, so it is not sufficient as the
  only proof that the new version is available.
- Old rooms can remain for up to **24 hours**. If needed, ask a teammate with
  **GMT access** to close the old rooms.
- Closing an old room with GMT does **not** stop sessions that are already
  running. Those sessions continue until they reach the duration configured in
  the map settings.

## Bug Incident Response

When a bug appears after release, use this order:

1. **Check recent updates first.** Identify whether any recent change is
   related to the observed bug.
2. **Contain the spread.** Use an existing **Flag** when available. If no Flag
   exists, temporarily implement one to disable the feature or logic causing
   the bug.
3. **Investigate the root cause after containment.** Do not delay mitigation
   while beginning the deeper diagnosis.
4. **Fix and reopen safely.** Apply the fix, have QA verify it, and have
   Publishing reopen the disabled feature or logic.
5. **Observe and remediate.** After observation confirms that the bug has
   stopped, handle consequences such as compensation and clearing stale or
   duplicate data.

---

## General Notes

| Update type | Rule |
|---|---|
| **Minor update** | No banner request needed. |
| **Major update** | `[GD/Dev]` request banner **at least 2 weeks** in advance. |
| **Any banner request** | The more detailed the brief, the fewer mistakes and less rework. |
| **Hotfix** | Follow the same QA and Publishing approval order; use the bug-response flow to contain, verify, reopen, observe, and remediate. |

---

## Related

- Performance tests gating release → [`client_performance_test.md`](client_performance_test.md), [`server_performance_test.md`](server_performance_test.md)
- Full status pipeline (Requirement → Launch) → [`development_lifecycle_stages.md`](development_lifecycle_stages.md)
- Post-launch release/scale/drop decisions → [`../publishing/release_pipeline_decision_making.md`](../publishing/release_pipeline_decision_making.md)
