# Performance Review Workflow

Use this pack for an explicit `performance review`, `tối ưu performance`, `lag`, `FPS`, `network traffic`, `broadcast`, `dirty flag`, `pooling`, or `stress test` request, or when the shared selector detects registered source signals. It covers multiplayer Craftland implementation paths, not release-gate grading.

## 1. Import and references

Follow the shared project-root, read-only selection and single-report contract in [`../../code_review.md`](../../code_review.md). Read [`api.md`](api.md), [`rule.md`](rule.md), and [`standard.md`](standard.md) before drawing conclusions. Do not edit reviewed source or create a second report.

## 2. Build a Performance Path Map

For each reachable hot path, record caller/platform, trigger/frequency from source or config, owner/player count, loops, payload or object work, async waits, state cache, lifecycle exit, and affected client/server side. Separate measured observations from source-only inferences. Inspect receivers and queue/remove paths for proposed network changes. Inspect all mutation sites for cache findings. Treat signal matches as leads, not findings.

Do not issue persistence quota/safety findings under this pack; select the registered database pack when applicable. Do not assert a speedup, network-copy guarantee, frame impact or threshold failure without evidence.

## 3. Output

Use exactly one Vietnamese report with the shared naming/collision/inline-fallback behavior in [`../../code_review.md`](../../code_review.md). Only `PERF-001` through `PERF-011` from [`rule.md`](rule.md) may appear as this pack's findings. Include the Performance Path Map with concrete locations and a separate Evidence and Tests description of any profile or stress data supplied. Keep uncertain runtime behavior and absent measurements under `Unknowns / Assumptions`.

Use the shared Vietnamese finding template, with this pack-specific affected-flow field:

```markdown
### PERF-003 — Vòng lặp còn chạy sau khi người chơi rời

- **Mức độ:** High
- **Quy tắc vi phạm:** PERF-003
- **Tác động:** Coroutine tiếp tục tiêu tốn CPU sau mỗi lần rời/vào.
- **Luồng bị ảnh hưởng:** cập nhật dữ liệu theo người chơi.

| Vị trí | Bằng chứng |
|---|---|
| `path/file.fcg:line` | Vòng lặp tạo cho mỗi người chơi không có điều kiện dừng; đường quit chỉ xoá map. |

**Khuyến nghị:** Gắn điều kiện dừng với owner và kiểm tra cancellation sau wait; không tự sửa mã khi review.
```
