# FCG Custom-Event Network API

FCG means **Free Fire Code for Graph**. FCC means **Free Fire Code Common**; `.fcc` files provide common declarations such as the standard library APIs below.

## Network Model

Review the project as a **custom-event/RPC-style client-server network**, not as a direct REST, WebSocket, TCP, or UDP integration.

The application sends a custom `EventID` to an entity target and selects the execution side with `PlatformType`. The FCG runtime owns the transport; its underlying protocol, delivery guarantee, ordering, duplicate-delivery behavior, acknowledgement behavior, and reconnect replay behavior are not declared by these APIs. Do not infer any of those guarantees.

**Verified sources:** the installed FCC standard libraries `StdLibrary.fcc` and `Player.fcc`. Project-defined custom event signatures are generated in `Temp/UGCLanguage/editorGen/EditorGenLib.fcc` and must be checked in the project being reviewed.

## Event Dispatch APIs

### `DispatchEventToEntity`

```fcg
func DispatchEventToEntity(eventID EventID, target entity, platform PlatformType, params List<object>)
```

Sends a custom event to one target entity. Treat every call with `PlatformType.Server` as a client-reachable server-action candidate when it originates in a `[platform_client]` graph, a client UI/input handler, or client-side async flow.

Review the receiving event handler, not only the dispatcher. Its `params` list is application data and must not be trusted for price, reward, ownership, action completion, or identity without server-side verification.

### `BroadcastCustomEvent`

```fcg
func BroadcastCustomEvent(eventID EventID, platform PlatformType, params List<object>)
```

Broadcasts a custom event to listening entities. Treat a broadcast to `Server` or `Both` that can mutate persistent value as an equally important entry point; a broadcast is not an idempotency mechanism.

### `PlatformType`

```fcg
enum PlatformType {
    Local = 0
    Client = 1
    Server = 2
    Both = 3
}
```

- `Local`: local execution only; never use it as a persistent-value authority boundary.
- `Client`: client-side delivery; use for presentation or client state only unless the receiving path re-enters server logic.
- `Server`: server-side delivery; audit the receiving handler as an untrusted action request.
- `Both`: dispatches to both sides. Audit the server receiver independently and ensure client delivery cannot cause a second server action.

## Event Declaration and Platform Patterns

- Declare event handlers as `event EventName(...)`.
- Use `[platform_client]` and `[platform_server]` graph declarations to identify side-specific code.
- Check each project custom event in `EditorGenLib.fcc` for its exact parameter signature and supported platform annotations before tracing it.
- Do not treat a client-side `_IsPending` flag, cooldown, button disablement, or local token as server-side replay protection.

## Player Session Lifecycle

### `OnPlayerJoin`

```fcg
event OnPlayerJoin(player entity<Player>)
```

Runs when a player joins the game. Review initialization, state loading, and any reset of per-player pending actions, locks, or completion markers.

### `OnUserQuitOrUserMatchEnd`

```fcg
event OnUserQuitOrUserMatchEnd(player entity<Player>)
```

Runs when a user quits mid-game or the match ends. Review cancellation, persistence, cleanup, and whether delayed work can still mutate data after this event.

`OnUserQuitOrUserMacthEnd` is deprecated. Flag new use of it.

## Identity, Async, and Persistence Review Patterns

- Key persistent player state by the stable player identifier used by the project (commonly `player<Player>.UserUID` / `UUID`); do not use an entity reference or connection-scoped state as the sole durable identity.
- Treat `async func`, `start`, `wait`, timers, and database callbacks as re-entrancy boundaries. Recheck action state after each boundary before debiting or granting.
- Trace generated event IDs, target entities, and handler graphs through `EditorGenLib.fcc`, then trace all `DispatchEventToEntity` and `BroadcastCustomEvent` calls in source.
- Trace `OnPlayerJoin` and `OnUserQuitOrUserMatchEnd` together with the same UUID-keyed maps so reconnect cannot reset a reservation while old work remains executable.

## Required Evidence for a Safe Pay-to-Earn Action

- A server-owned reservation or state transition before an asynchronous boundary.
- Server-derived or server-verified price, reward, ownership, and eligibility.
- A durable completed/claimed/reserved marker when the action can survive disconnect or reconnect.
- A replay-safe action identity or equivalent atomically consumed one-time source.
- A terminal outcome for quit, retry, save failure, and old-session continuation.

## Unsupported Assumptions

Do not claim that `DispatchEventToEntity`, `BroadcastCustomEvent`, `PlatformType.Server`, or a transaction/event log alone provides:

- exactly-once delivery or execution;
- deduplication or idempotency;
- ordering across events or reconnects;
- atomic debit-and-grant behavior;
- automatic cancellation of delayed work after disconnect; or
- durable recovery after save failure.

TODO: Verify these guarantees only from the installed runtime version's official documentation or a reproducible targeted test before relying on them in a finding or recommendation.
