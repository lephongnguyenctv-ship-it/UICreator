---
name: craftland-performance-optimization
description: Optimize server CPU, network traffic, client rendering, and HUD work in multiplayer Craftland maps; use for lag, low FPS, excessive broadcast, dirty-flag caching, pooling, or stress-test diagnosis.
type: development-knowledge
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-10-18
source: "Internal optimization lessons from a Craftland multiplayer map (server/client performance), 2025-12 to 2026-10"
---

# Craftland Multiplayer Performance Optimization

Use the [topic index](performance-optimization/README.md) for implementation patterns, failure modes, and measurement. This is an optimization guide for existing code paths. Release gates remain in the [client](client_performance_test.md) and [server](server_performance_test.md) performance tests; persistence correctness and quota rules remain in the [database review pack](code-review/database/rule.md).

For a read-only code review, select the registered [performance pack](code-review/performance/workflow.md) through the [shared review workflow](code_review.md). Its rules require source evidence and do not claim a numerical gain without measurement.
