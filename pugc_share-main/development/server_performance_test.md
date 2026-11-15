---
name: craftland-server-performance-test
description: Pre-release server stress test (load test) for Craftland/UGC maps via the Gtop loadTest platform. Verifies the game server stays healthy under load before release. Defines how to get the battlefield-code URL, configure and submit a stress test, and which monitoring metrics (memory, room count, processor load) indicate a healthy vs abnormal server. Use before releasing a map to confirm the server has no performance problems.
type: development-knowledge
domain: craftland-ugc
status: authoritative
version: 1.1.1
last_updated: 2026-10-18
pic: SH-QA
source: "Server Performance Test.pdf (服务器压测基本资料)"
---

# Server Performance Test (Stress Test)

> **Why:** A required pre-release check that the **game server stays healthy
> under load** (stress / pressure test). If monitoring shows abnormal data, the
> server issue must be resolved before release.
> **Owner (PIC):** SH-QA. Corresponds to the **Client & GS Testing** stage in
> [`development_lifecycle_stages.md`](development_lifecycle_stages.md).

Platform: **Gtop loadTest** → https://gtop.gre.garenanow.com/6/area/loadTest

## Step 1 — Get Permission & Battlefield-Code URL

You need **Gtop permission** first.

1. Open the battlefield-code settings command URL for your environment:
   - **Live:**
     `https://sgffgmtplus.ggblueshark.com/command?command_name=AdminGetWorkshopCodeSettingURL&service_name=workshopservice&env=Live_SG`
   - **RCT:**
     `http://test.ff.gmtool.web.garena.cn/command?command_name=AdminGetWorkshopCodeSettingURL&service_name=workshopservice&env=rct01_sg`
2. Enter the **battlefield code** and click **Submit** to obtain the **map URL**
   (used in Step 2).

## Step 2 — Configure & Run the Stress Test

On the Gtop loadTest page, click **Add**. Fill in the new page:

| Field | What to enter |
|---|---|
| **Map Name** | Your map name |
| **End Time** | Generally select the **next day** |
| **Task Template** | Choose your own machine |
| **Test Server Group** | Same as the task template |
| **PUGC stress-test map URL** | The URL obtained in Step 1 |
| **PUGC stress-test mode** | Whether the map **is a Bermuda map** |
| **PUGC stress-test GS version** | The server (GS) version being tested |

Then click **Submit**.

## Step 3 — Check the Data

- After the test starts, the status shows **"running"**.
- Click **"test result"** to view results — **observe after ~1 hour**.
- There are **two core tables** to watch: *Business monitoring grafana* and
  *Basic monitoring grafana*.

### Stress-test validity

- The stress test is valid only when CCU is **> 1,000**.
- CCU **equal to or below 1,000** makes the entire stress test invalid; CCU is a
  validity condition, not a performance pass metric.

### Hard requirements — fail blocks release

| Dashboard / Source | Metric | Release standard |
|---|---|---|
| **Basic monitoring grafana** | Average processor load | **< 60%** |
| **Basic monitoring grafana** | Peak processor load | **< 80%** |
| **Basic monitoring grafana** | Average memory usage | **< 60%** |
| **Basic monitoring grafana** | Peak memory usage | **< 80%** |
| **Business monitoring grafana** | `gameserver_send_traffic_bytes` downlink per player | **< 50 KB/s/user** |

Traffic is a hard requirement for **new projects**. For **existing live
projects**, traffic is temporarily a soft requirement during a grace period;
no deadline is set until one is explicitly provided.

### Soft requirements — do not directly block release

| Dashboard / Source | Metric | Target |
|---|---|---|
| **Business monitoring grafana** | `match_fps` mean | **> 15 FPS** |
| **exportSettingsUrl** download | Map GameBytes file | **< 10 MB** |

Soft failures do not directly block release, but they may affect player
experience and must be recorded.

- Data is most accurate when total duration reaches **2 hours**.
- **If you see abnormal data:** contact **@Zhang Shuaipeng** and **@Tang Ningping**.

### T0/T1/T2 Server Testing Rules

By default, **every update**, including weekly updates, requires a server
performance test. The only exemptions are:

1. The update does not change server-side logic and changes only art
   assets/materials.
2. The update is bug-fix-only, adds no complex computation logic, and has no
   new protocol or modified protocol.

If a bug fix violates any condition above, the exemption is invalid and server
testing is required. These exemptions apply only to server testing; client
testing and the review process are unchanged. The gameplay owner is responsible
for confirming eligibility.

## Server Optimization Checklist

Concrete actions that improve **server** load behavior. Items marked **Both**
also help the [client performance test](client_performance_test.md). Apply these
when monitoring (§Step 3) shows memory/room/processor load out of range.

| Category | Action | Helps | How / Note |
|---|---|---|---|
| Environment | **Static Batching** the map | Fewer draw calls | Combine static meshes. |
| Environment | **Merge child-node models at runtime** | Less render | Group nearby mesh blocks (mostly decoration). |
| Environment | **Bake objects** (lightmaps / occlusion) | Lighting load | Avoid real-time lighting calculation. |
| Navigation | **Remove static Navmesh outside playable area** | CPU / RAM | Keep Navmesh only where players can go. |
| AI/Logic | **Object pooling** | Per-frame CPU spikes | Reuse prefabs instead of create/destroy repeatedly. |
| System | **Disable data-storage reads during stress test** | Stress-test cleanup | Turn off file/DB reads while load testing. |
| Environment (Both) | **Remove unreachable colliders** | Physics CPU | Delete colliders where players can't reach. |
| Environment (Both) | **Restrict Custom Water Zones** | Overall load (per-tick volume, rendering, spikes) | Water zones run swim/glide logic, ripple shaders, constant state toggling. |
| Navigation (Both) | **Disable Navmesh agents when idle** | CPU overhead | Turn agents off until activated. |
| AI/Logic (Both) | **Hard-limit total active entities** (e.g. zombies < 30) | Overall performance | Cap concurrent spawns. |
| AI/Logic (Both) | **Dynamic entity count by player count** | Performance ⇄ UX | Fewer players → fewer spawns. |
| AI/Logic (Both) | **Reduce loops in `Update`** | CPU / FPS | Use Coroutine or Invoke instead of per-frame loops. |
| AI/Logic (Both) | **Don't do heavy work in `OnUpdate()`** | Stable load | Avoid excessive per-frame processing. |
| Memory (Both) | **Reduce texture size** | VRAM | Compress; downscale to 256/128. |
| Memory/UI (Both) | **HUD lifecycle audit** | Memory leak | `Instantiate` without matching `Destroy`. |
| Network (Both) | **Custom attribute data audit** | Packet congestion | Watch for abnormally large List/Array fields. |
| System (Both) | **Remove log writes** | Memory leak | Strip logging from release builds. |

> **Source:** [Craftland] Checklist Performance Test Preparation.xlsx
> (Server Test + Both items). Client-only items are in
> [`client_performance_test.md`](client_performance_test.md).

## Related

- Implementation patterns and before/after diagnosis → [`performance_optimization.md`](performance_optimization.md), especially [network](performance-optimization/02_network.md), [server CPU](performance-optimization/03_server_cpu.md), and [measurement](performance-optimization/07_measurement.md). This page remains the release-test standard.
- Client-side counterpart → [`client_performance_test.md`](client_performance_test.md)
- Stage in the pipeline (Client & GS Testing) → [`development_lifecycle_stages.md`](development_lifecycle_stages.md)
- Pre-release decisions → [`../publishing/release_pipeline_decision_making.md`](../publishing/release_pipeline_decision_making.md)
