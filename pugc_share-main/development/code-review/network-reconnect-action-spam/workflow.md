# Network Reconnect Action-Spam Review Workflow

Use this workflow only when the user explicitly requests a network review,
reconnect-spam review, duplicate-reward review, one-pay/many-earn analysis,
transaction-race review, or disconnect/reconnect exploit review. Automatic pack
selection is handled by the shared contract when no pack is explicit.

## 1. Import the Project

Use the shared project-root and read-only rules in
[`../../code_review.md`](../../code_review.md). The caller must provide a readable
local project path. Reuse an existing local clone when available. Cloning,
fetching, or checking out a repository writes to disk and requires explicit
approval before it is attempted.

Analyze the project read-only. Do not modify the reviewed source, create fixes,
or write output anywhere except the single Vietnamese report required by the
shared contract at the project root.

## 2. Review References

Read these pack files before drawing conclusions:

- [`api.md`](api.md) for network, lifecycle, persistent-value, and action detection patterns.
- [`rule.md`](rule.md) for violation criteria and severity.
- [`standard.md`](standard.md) for remediation guidance and test scenarios.

## 3. Analyze the Project

First identify the target project's network stack and authority model from its
dependencies, configuration, transport/bootstrap code, RPC/event handlers, and
lifecycle hooks. Record only APIs and guarantees verified in the target
project's source or official documentation.

Build an action ledger for every server-reachable action that can spend, grant,
consume, create, claim, exchange, or transfer persistent value. Trace each flow
from client input/event through server validation and state mutation to
save/cleanup.

For trigger-driven rewards, trace the trigger callback, any event dispatch, the
reward grant, and any subsequent teleport, despawn, or disablement. If the
reward is intended to be collected at most once per player, run, checkpoint, or
trigger lifecycle, verify that the server atomically consumes or records that
eligibility before the grant. Do not assume that teleporting the player away
prevents duplicate trigger delivery; report missing runtime guarantees as a
potential issue rather than a confirmed exploit.

For each action, extract: caller/platform, player UUID and session identity,
action or transaction identifier, request payload, authoritative cost, reward,
mutation order, asynchronous boundaries, pending/lock state, database-ready
state, persistence boundary, and join/quit cleanup.

Treat client flags, HUD cooldowns, UI button disabling, and client-side request
tokens as defense-in-depth only. Verify that the server independently rejects
duplicate, stale, unauthenticated, or already-completed work after reconnect.

Specifically simulate this sequence in the code path: submit action -> disconnect
before all callbacks/save/cleanup finish -> reconnect with the same UUID ->
resend or spam the action -> delayed work from the old session completes. Check
that exactly one accepted payment maps to exactly one durable reward and that a
rejected or failed payment maps to no reward.

## 4. Output

Use the shared report naming, collision, inline fallback, and Vietnamese report
format in [`../../code_review.md`](../../code_review.md). Do not create the legacy
pair of English and Vietnamese network reports. Create exactly one shared
report at the project root.

Only report findings with IDs `NET-001` through `NET-007` defined in
[`rule.md`](rule.md). Include the network/action map, root-cause grouping,
attack timelines, recommendations, unknowns, and test results required by the
shared report contract.

The network report must use the shared skeleton and add these concrete
network-specific sections:

- `Finding Overview`: a compact table with ID, severity, affected pay/reward
  pair, root cause, exploit precondition, and fix priority.
- `Network and Action Map`: the network stack and authority model, every
  server-reachable value-changing action, caller/platform, UUID/session
  identity, action or transaction ID, request payload, authoritative cost and
  reward, mutation order, async boundaries, pending/lock state, persistence
  boundary, and join/quit cleanup.
- `Potential Issues`: group findings that share one root cause and remediation
  pattern. Give each distinct affected flow a concise finding card, while
  keeping complete evidence and locations.
- For Critical or High findings, include a numbered attack timeline and state
  the exact server-side reject/reservation boundary and invariant it must
  preserve.
- `Recommendations`: provide one shared remediation pattern per root-cause
  group, then list only flow-specific exceptions.

Use this network finding-card shape inside `Potential Issues`:

```markdown
### NET-001 — Daily-login reward replay

- **Severity:** Critical
- **Violated rules:** NET-001, NET-003, NET-005
- **Impact:** One daily-login eligibility -> unlimited reward grants.
- **Root cause:** The server records a claimed state but does not reject it before granting.
- **Affected pair:** Daily-login eligibility -> coin, item, or currency reward.

| Location | Evidence |
|---|---|
| `path/file.fcg:line` | Short fact proving the condition or grant path. |

**Attack timeline**

1. Claim the reward once; the server marks the eligibility claimed.
2. Resend or spam the same action, including after reconnect.
3. The server reaches the grant path without rejecting the completed state.
4. The same eligibility grants another reward.

**Server-side fix:** Reject the completed state before every grant. Do not apply the fix during review.

**Invariant:** One accepted eligibility/payment produces exactly one durable reward.
```
