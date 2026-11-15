---
name: craftland-pugc-team-tooling-reference
description: >
  Team tooling and access reference for Craftland/PUGC VN. Covers the current
  Google Sheet task tracker, FF-OGC GitHub organization, fecl packaging tool,
  Craftland Editor, publishing-account setup, server regions, SeaTalk groups
  and bots, documentation links, reports, feedback channels, and asset folders.
  Use during team onboarding or when locating the correct tool or resource.
type: development-knowledge
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-09-08
source: >
  [C3][FF][Craftland] Onboarding Document (PUGC VN) and
  [C3][FF][Craftland] PUGC Common Questions
---

# Team Tooling Reference — Craftland/PUGC VN

> This file is a tool and resource map, not a credential store. Do not add
> passwords, tokens, private keys, or other secrets here. Links and installer
> versions should be rechecked before use when the source system changes.

## 1. Task and project tracking

- **Current team-wide tracker:** [VN PUGC Master Sheet](https://docs.google.com/spreadsheets/d/1BzR0KXRKPnJE1KhOjMdY6rmM3pMqXRxpO9a0LlApve8/edit?gid=1068671707#gid=1068671707)
- Use the sheet as the shared place to record task ownership, status, deadline,
  blockers, and links to the relevant document or build.
- ClickUp is no longer the team's task-management source of truth.

## 2. Source code and packaging

### GitHub

- **Organization:** [FF-OGC](https://github.com/FF-OGC)
- Create the GitHub account with a company email and request organization
  membership through the current team access process. Check the invitation
  email if the organization does not appear after approval.

### fecl project ZIP tool

- **Download:** [FE-Command-Line v0.2.1](https://github.com/FF-OGC/FE-Command-Line/releases/tag/v0.2.1)
- **Command line:** run `fecl zip` from the project root folder.
- **UI:** run the `.exe`, choose **Zip Project**, select the project root, and
  choose **Apply**.
- If Windows displays a warning, follow the approved company security process
  for verifying and running the release; do not bypass an unknown warning.

### Craftland / FreeFire Editor

- **Direct editor download:** [CraftlandStudio_1.12.3500732.exe](https://dl-cdn.craftlandstudio.com/live/package/CraftlandStudio_1.12.3500732.exe)
- **FreeFire Editor installer:** [installer](https://drive.google.com/file/d/14B_w8IFT32K_HbC239ddXXPX1_wrMVgH/view)
- During installation, select **Only for me**; the source guide notes that this
  is required for sound import to work.
- **Official FE site:** [ffcraftland.garena.com](https://ffcraftland.garena.com/en/)

## 3. Publishing-account setup

Publishing accounts are shared team resources used to support release-role
rotation. Create a new, dedicated email for each publishing account instead of
reusing a personal or pre-existing mailbox:

- **SG** — create this first for a new member; expand to the other regions when
  the role is stable.
- **US** — publishing account for the US/Brazil region setup.
- **IND** — publishing account for the India region setup.

The account itself is intended to be team-shared, but credentials must be
shared only through the approved internal credential process. Never commit a
password to GitHub or this repository, and never put actual credentials in a
public document.

Operational setup from the source guide:

1. Use a company-controlled FE account where available.
2. Keep the game-play account separate from the map-publishing account.
3. For the regional account setup, use **Hindi / India** for IND and
   **Portuguese / Brazil** for US.
4. After the account is created, record its approved account metadata in the
   [account tracking sheet](https://docs.google.com/spreadsheets/d/1BzR0KXRKPnJE1KhOjMdY6rmM3pMqXRxpO9a0LlApve8/edit?pli=1&gid=2097834403#gid=2097834403).
5. In Craftland → Studio, turn off **Is Visible** for the publishing account.
6. Bind the FE account to the Free Fire SG account. The FE and Free Fire
   accounts do not have to use the same identity.

For the detailed regional account flow, see the
[regional account guide](https://docs.google.com/document/d/1DbDWK2xWRtyxbwmYipMLwvP6tkejBvMGRcb02vDI2bM/edit?tab=t.0#heading=h.m8g3ouy8byo5).

## 4. Craftland server regions

These are the values used by the source guide when reading `GetServerRegion()`
in Craftland Editor:

| Region | Server values |
|---|---|
| **IND** | `IND` |
| **US** | `BR SAC NA US` |
| **SG** | `BD VN TH TW SG ID PK CIS ME SG` |

## 5. Asset licensing

The source guide recommends assets with **CC-BY** and without **NC**. For each
external asset, also keep the attribution text, source URL, license evidence,
and a check that the intended commercial use is permitted. Escalate unclear
licenses before the asset enters a release package.

## 6. SeaTalk groups

| Group | Use |
|---|---|
| **[Craftland] PUGC VN** | Main Craftland VN team group. |
| **VN UGC Dev Support** | Ask editor and development questions; SH team members provide support. |
| **[Craftland] Regional Team VN** | Shared group for Craftland VN and the Regional Publishing team. |
| **[Craftland] Regional Bug Report** | Bug-report group. |
| **PUGC bug反馈群（live）** | Live bug-report group. |

## 7. Useful SeaTalk bots

| Bot | Use |
|---|---|
| **Duck** | Internal team Q&A, schedule reminders, feedback/bug aggregation, adhoc task assignment, and deadline reminders. Improvement feedback can be sent to `giabao.tran@garena.vn`. |
| **GarenaGPT** | Editor questions and broader Garena questions; the organization-wide, expanded counterpart to Duck. |

## 8. Wiki and tutorials

- [FF-OGC GitHub Wiki](https://github.com/FF-OGC/wiki)
- [3D-related resources](https://docs.google.com/document/d/1lF0Cf7yBHMYLRoyAyKhssZ61wLLJNIgLSoCgMGBJGH0/edit?tab=t.0#heading=h.r1hwz4iag44s)
- [Official FE documentation](https://ffcraftland.garena.com/en/tutorial/fe/1)
- [Craftland GitHub tutorial](https://github.com/trivyGameCTV/Craftland-Tutorial)
- Sample projects can also be found in other repositories under [FF-OGC](https://github.com/FF-OGC).
- [Dawn of Undead encountered problems](https://docs.google.com/spreadsheets/d/1Kvtb1Qgi97aQqhQU60FbjplP6as6KAtlwk-RJmOi9E4/edit?gid=101820125#gid=101820125)

## 9. Reports, timeline, feedback, and bugs

### Reports and timeline

- [VN PUGC Brainstorm Ideas](https://docs.google.com/spreadsheets/d/1EEzewN1cuqeSpSRPE7dSspAKtPwLKYyjXJNmuJTO-Tc/edit?gid=1474183056#gid=1474183056)
- [VN PUGC Bi-Weekly Update](https://docs.google.com/document/d/1tqfODduAKOf9JR9wF7cmkJ44c8EHBPZgTxqCBRz6BJU/edit?tab=t.u0y9hlebsk1y)
- [VN PUGC Project Timeline](https://docs.google.com/spreadsheets/d/1BzR0KXRKPnJE1KhOjMdY6rmM3pMqXRxpO9a0LlApve8/edit?gid=1323854683#gid=1323854683)

### Feedback and bug reporting

- [Mobile Editor VN](https://docs.google.com/spreadsheets/d/1fDJgeT9v3WwktCzW_8dxnQDS4p1JXI8gVvqkTGvTCO8/edit?gid=0#gid=0)
- [VN Craftland Editor Feedback & Issue](https://docs.google.com/spreadsheets/d/19eGDkF8hn1u4QwAy7IHedgVkodq3a0Vk9oz-wfaQ_AQ/edit?gid=1831052699#gid=1831052699)
- [Local x REG x DEV Feedback List](https://docs.google.com/spreadsheets/d/1IZZ_sGZNzUO-pVrN6Q81lDEKvDPuxs6LwwJRPIgsyEs/edit?gid=260385397#gid=260385397)
- [FreeFire Editor SH issue summary](https://docs.google.com/spreadsheets/d/1eSAqpBjLcK6bOFlnu1dT1kigRHot4rOfgXi3_qgc4Uk/edit?gid=135594920#gid=135594920)
- [Bug Report folder](https://drive.google.com/drive/u/0/folders/1gOgnNjFKSznY0BqMoQHLZCks2nG4acZR)
- [Feedback folder](https://drive.google.com/drive/u/0/folders/1DK57JpWoI5avzBC9XWm0h8-76kjlBaxZ)

## 10. Asset folders and templates

- [MKT Assets](https://drive.google.com/drive/folders/16WqoyvgSH4ifFT0gY_jJ75pQiIcgxrGU)
- [Gameplay Clips](https://drive.google.com/drive/folders/1T5cnQBJLi1xL0lxj-XvW0tMMRTGTxp6v)
- [Game Packages](https://drive.google.com/drive/folders/1rYqq3jV3oAmx8Y84RVWgO_EIB0IGgLff)
- [FE Scene / Map Craftland](https://drive.google.com/drive/folders/15uOd0_03m6SaZAuaAG9PrJ_i-SYxNsXM)
- [Audio resources](https://drive.google.com/drive/u/0/folders/1qMyhU47wAvjpi_23EdBqwbUxxdruNfO_)
- [Playtest Forms and Feedback](https://drive.google.com/drive/folders/1o2qdWscdWMxx8NmmXQ__rTvHFpM3bCYs)
- [New Project Information Template](https://docs.google.com/spreadsheets/d/1fZymep0ZTzSquyZPOQg1HAGxXZJhVuymoHrPJW6ww6Q/edit?gid=0#gid=0)
- [Shared Folder](https://drive.google.com/drive/folders/1lIIYWd-hI1Brd8yZAQR479ofgP5Go9E3)

## 11. Performance and release references

- **PUGC QA / performance timeline:** [VN PUGC Project Timeline](https://docs.google.com/spreadsheets/d/1BzR0KXRKPnJE1KhOjMdY6rmM3pMqXRxpO9a0LlApve8/edit?pli=1&gid=934412245#gid=934412245)
- Repository procedures: [`client_performance_test.md`](client_performance_test.md), [`server_performance_test.md`](server_performance_test.md), and [`release_guideline.md`](release_guideline.md).

## 12. Cursor and editor command setup

In Cursor, press **Ctrl + Shift + P**, search for `code`, and run **Shell
Command: Install 'code' command**. For the standard FC save formatter and
Trigger Task on Save, follow [`auto_save_format.md`](auto_save_format.md).

## 13. Other reference

- [Printer setup and card registration guide](https://docs.google.com/document/d/13UkzblcWcQPR5xC3MbjYOzu2ZUyVgcko3PW8aLcsnjA/edit?tab=t.0)

## Related sources

- [Onboarding Document (PUGC VN)](https://docs.google.com/document/d/1lK851slLm2JiJG6pxBYIX9D4k9BkqfQNy1MqT6ofwc4/edit?tab=t.0#heading=h.lsszcw32pfuv)
- [PUGC Common Questions](https://docs.google.com/document/d/1h_oT9XMDi5Q8BiBxOuABYCPYN--mNV7PWM1D6X5h3jc/edit?pli=1&tab=t.0#heading=h.e7cdnkspu8w0)
