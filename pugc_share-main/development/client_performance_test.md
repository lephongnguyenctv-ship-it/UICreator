---
name: craftland-client-performance-test
description: Pre-release client performance test for Craftland/UGC maps. Verifies the game runs smoothly on a low-end device (benchmark Samsung J7) across normal and weak networks, using PerfDog. Defines setup, test steps, test cases, pass/fail metrics (FPS, Jank, Stutter, Temperature, Crash, Memory), and optimization directions. Use before releasing a map to confirm it performs well on low-spec phones.
type: development-knowledge
domain: craftland-ugc
status: authoritative
version: 1.1.1
last_updated: 2026-10-18
pic: SH-QA
source: "Client Performance Test.xlsx (PUGC 客户端性能)"
---

# Client Performance Test

> **Why:** A required pre-release check that the game runs **efficiently on the
> benchmark device** and under poor network conditions. Performance
> criteria are measured on a **full-load build**. A failure of any hard
> requirement blocks release; a soft-requirement failure does not directly
> block release but must be recorded and addressed appropriately.
> **Owner (PIC):** SH-QA. Corresponds to the **Client & GS Testing** stage in
> [`development_lifecycle_stages.md`](development_lifecycle_stages.md).

## 1. Test Environment

### Benchmark Device (mid-range)
- **Samsung J7** — **2 GB RAM**, CPU **Exynos 5**, GPU **ARM Mali-T830**.
- This is the mid-range reference device for the client performance test.

### Network Conditions (test all)
- **Wi-Fi** (5 GHz / 2.4 GHz)
- **4G / 5G**
- **Weak network** — simulate packet loss / latency via a proxy tool.
  - Example weak-network tool: **NEW**.
  - Config reference: https://wiki.garena.com/pages/viewpage.action?pageId=3836133

## 2. Tooling — PerfDog

PerfDog captures real-time client performance (generally **Android only**).

**Setup:**
1. Download & install the PerfDog client (Windows/Mac). Connect the device via
   USB or Wi-Fi — **developer mode must be enabled**.
2. **Android:** choose **"Installation Mode"** for real-time data
   (requires floating-window permission).
3. **iOS:** trust the computer and **disable "Guided Access"** to avoid data
   interference.

Report example: https://perfdog.qq.com/case_detail/6564809

## 3. Test Steps

1. Confirm PerfDog is successfully connected to the phone.
2. Confirm PerfDog shows the phone's performance data in real time.
3. **Start** performance recording right after the test device enters the map.
4. **Stop** recording after game settlement (end of match).
5. Upload the performance report to the cloud document.
6. Analyze the report against the metrics in §5.

## 4. Test Cases (coverage)

- Cover **as many scenes in the map as possible**.
- Use **every interactive button** in the gameplay at least once.
- Run the **entire gameplay flow**, covering as much gameplay logic as possible.

## 5. Pass/Fail Metrics

The criteria below are measured on a **full-load build**.

### Hard requirements — fail blocks release

| Metric | Meaning | Pass Standard |
|---|---|---|
| **FPS** | Average screen refreshes per second (frame rate) | **Average > 25** |
| **Jank / BigJank** | Lag / severe lag events | **BigJank < 50** |
| **Stutter** | Stutter rate = stutter duration / total duration | **Stutter rate < 3%** |
| **Temperature** | Device heat during play | **No overheating / burning** |
| **Crash** | Client crash / force-close | **0 crashes** |

Hard requirements are release gates: failing any one means the map must not be
released. Soft requirements do not directly block release, but failures must
be recorded. In addition to the table above, the hard requirements include no
severe noticeable stuttering and no prolonged freezes.

### Soft requirement — does not directly block release

- **Memory:** Usage **< 700 MB**. If the map is featured on the Mode
  Selection page, exceeding **700 MB** significantly increases crash risk.

## 6. Optimization Directions (if it fails)

High-level levers:

- **Code layer:** load data asynchronously, reduce overdraw, optimize caching.
  E.g. when many entities are created within one frame (HUD + scene objects),
  spread creation across multiple frames.
- **Resource layer:** reduce resource loading/instantiation; compress map
  resources. E.g. control face count of custom assets; avoid dense use of
  high-poly objects.
- **Architecture layer:** enable **dynamic batching**; use **merged child nodes**.

### Client Optimization Checklist

Concrete actions that improve **client** performance. Items marked **Both**
also help the [server stress test](server_performance_test.md). Work through
these when a metric in §5 fails — match the failing metric to the relevant
category.

| Category | Action | Helps | How / Note |
|---|---|---|---|
| Environment | **Self-create particle effects** (cap ~30–50 max particles) instead of reusing a heavy existing Effect entity | FPS | Avoid rendering too many entities in the player's view. |
| AI/Logic | **Add an LOD script** for distant objects | FPS | Render distant objects at lower detail; avoid rendering too many entities in view. |
| UI | **Unify the depth** of all UI files to the same value | Render | Reduces render passes/overdraw on the UI. |
| UI | **Use low-resolution textures** (≤128×128), or **one shared high-res texture** for many models | Memory / package size | Lowers device burden and reduces package size. |
| Environment (Both) | **Remove unreachable colliders** | Physics CPU | Delete colliders in areas the player cannot reach. |
| Environment (Both) | **Restrict Custom Water Zones** | Overall load (per-tick volume, rendering, spikes) | Water zones run swim/glide logic, ripple shaders, and constant player-state toggling — expensive. |
| Navigation (Both) | **Disable Navmesh agents when idle** | CPU overhead | Turn agents off until the entity (e.g. zombie) is activated. |
| AI/Logic (Both) | **Hard-limit total active entities** (e.g. zombies < 30) | Overall performance | Cap concurrent spawns. |
| AI/Logic (Both) | **Dynamic entity count by player count** | Performance ⇄ UX balance | Fewer players → fewer spawns. |
| AI/Logic (Both) | **Reduce loops in `Update`** | FPS | Move work to Coroutine or Invoke instead of per-frame loops. |
| AI/Logic (Both) | **Don't do heavy work in `OnUpdate()`** | Stable FPS | Avoid excessive per-frame processing. |
| Memory (Both) | **Reduce texture size** | VRAM | Compress textures; downscale to 256/128. |
| Memory/UI (Both) | **HUD lifecycle audit** | Memory leak | Check for `Instantiate` without a matching `Destroy` on HUD. |
| Network (Both) | **Custom attribute data audit** | Packet congestion | Watch for abnormally large List/Array fields. |
| System (Both) | **Remove log writes** | Memory leak | Strip logging from release builds. |

> **Source:** [Craftland] Checklist Performance Test Preparation.xlsx
> (Client Test + Both items). Server-only items are documented in
> [`server_performance_test.md`](server_performance_test.md).

## 7. Related

- Implementation patterns and before/after measurement method → [`performance_optimization.md`](performance_optimization.md) and its [client rendering](performance-optimization/05_client_rendering.md), [UI/HUD](performance-optimization/06_ui_hud.md), and [measurement](performance-optimization/07_measurement.md) guides. This page remains the release-test standard.
- Server-side counterpart → [`server_performance_test.md`](server_performance_test.md)
- Stage in the pipeline (Client & GS Testing) → [`development_lifecycle_stages.md`](development_lifecycle_stages.md)
- Pre-release decisions → [`../publishing/release_pipeline_decision_making.md`](../publishing/release_pipeline_decision_making.md)
