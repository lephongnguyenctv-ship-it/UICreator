# Reconnect Action-Spam Rules

## NET-001 — Server-authoritative acceptance

- **Violation:** A value-changing action can be accepted because of client-supplied cost, reward, ownership, cooldown, pending state, or completion state, or it relies only on a client/HUD guard.
- **Check:** Trace the server entry point and confirm it derives or verifies all security-relevant values from authoritative server state.
- **Severity:** Critical when it can grant currency/items or bypass payment; High otherwise.
- **Valid exception:** None for persistent value changes.

## NET-002 — Atomic pay-to-earn state transition

- **Violation:** The same action can interleave with itself, or reconnect can observe an intermediate state, between eligibility check, debit, reward grant, and completion record.
- **Check:** Identify yields, callbacks, `start`, database operations, or event dispatches between those steps. Confirm a server-side reservation/lock/state machine closes the window and is released safely.
- **Severity:** Critical for one-pay/many-earn or reward-without-pay; High for duplicate non-economic effects.
- **Valid exception:** The target runtime documents a single-threaded atomic execution boundary that covers the entire mutation and no operation yields within it. Record the cited proof.

## NET-003 — Replay and idempotency control

- **Violation:** A retry, duplicate delivery, reconnect, or repeated client request can create more than one successful outcome for one logical action.
- **Check:** Confirm the server uses a unique action identity or a durable state transition to return/reject the prior result without granting again. Logs alone do not satisfy this rule.
- **Severity:** Critical for paid actions, claim rewards, item creation, currency exchange, or transfers; High for limited progression actions.
- **Valid exception:** A one-time server-owned resource is consumed atomically before any reward can be granted.

## NET-004 — Disconnect/reconnect session isolation

- **Violation:** A delayed callback or async continuation from a disconnected session can mutate state after the player reconnects, or old locks/pending state are silently reset so the same work is accepted again.
- **Check:** Trace `OnUserQuitOrUserMatchEnd`, `OnPlayerJoin`, map cleanup, reload, and every delayed continuation. Confirm cancellation or a server-validated session/action generation check.
- **Severity:** Critical if it duplicates value; High if it corrupts state or bypasses cooldown.
- **Valid exception:** The action is durably completed/cancelled before session cleanup and later continuations are provably no-ops.

## NET-005 — Payment/reward conservation

- **Violation:** Source code allows `successful rewards > successful corresponding payments`, or grants a reward after payment failure/cancellation.
- **Check:** For each logical action, enumerate all debit and grant branches, including error, timeout, quit, retry, and reconnect branches. Verify one accepted payment produces one bounded reward and failed/rejected work produces none.
- **Severity:** Critical for any persistent currency, item, entitlement, or trade value.
- **Valid exception:** A documented promotion explicitly grants extra value; it must be server-authenticated and separately auditable.

## NET-006 — Durable recovery for incomplete actions

- **Violation:** The process depends solely on volatile in-memory state to distinguish pending, paid, granted, or completed actions across reconnect/save failure.
- **Check:** Determine what survives disconnect and restart. Verify recovery resolves each operation to one of: not accepted, refunded/compensated, or completed exactly once.
- **Severity:** High; Critical when a crash/reconnect can duplicate value.
- **Assumption:** Durable operation state is required when the action crosses an async or persistence boundary. TODO: Verify the target platform's disconnect and persistence guarantees.

## NET-007 — Trigger-reward single-consumption

- **Violation:** A trigger-driven currency, item, entitlement, or progression grant that is intended to be limited per player, run, checkpoint, or trigger lifecycle can execute more than once because it relies on teleporting, moving, or disabling presentation instead of a server-side consumption/completion state.
- **Check:** Trace trigger entry, event dispatch, grant, teleport/despawn/disablement, reconnect, and duplicate event delivery. Confirm the server atomically consumes a one-time source or records the claim before granting. If source cannot verify trigger platform authority or runtime duplicate-delivery behavior, report this as a potential issue under `Unknowns / Assumptions` unless another source proves exploitability.
- **Severity:** Critical for persistent currency, items, or entitlements; High for limited progression or session-scoped rewards.
- **Valid exception:** The reward is intentionally repeatable and server-authoritative, with a documented repeat policy and any required rate/eligibility controls.
