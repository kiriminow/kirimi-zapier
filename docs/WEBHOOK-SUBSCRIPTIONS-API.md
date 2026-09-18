# Webhook subscriptions API — implementation spec

Target: `kirimi-mono-v2` (endpoints, tables, docs) and `kirimi-webhook` (fan-out, payload,
signature). Consumer: `kirimi-zapier` REST Hook triggers (`docs/TRIGGERS-1.1.0.md`).

Decisions already taken:

- **Fan-out**: new `tbl_webhook_subscriptions`. The existing per-device/per-WABA webhook URL and
  its delivery path stay untouched; subscription deliveries are added as extra targets.
- **performList source**: new append-only `tbl_webhook_events`, not `tbl_webhook_logs`.
- Existing payload fields are never renamed. New fields are additive.

## 1. Data model

### 1.1 `tbl_webhook_subscriptions`

```sql
CREATE TABLE tbl_webhook_subscriptions (
  id            VARCHAR(36)  NOT NULL,
  user_code     VARCHAR(100) NOT NULL,
  device_id     VARCHAR(100) NULL,
  waba_id       VARCHAR(100) NULL,
  target_url    VARCHAR(500) NOT NULL,
  events        JSON         NOT NULL,
  secret        VARCHAR(64)  NOT NULL,
  label         VARCHAR(100) NULL,
  status        ENUM('active','revoked') NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at    TIMESTAMP    NULL,
  last_event_at TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_webhook_sub_device (device_id, status),
  KEY idx_webhook_sub_waba (waba_id, status),
  KEY idx_webhook_sub_user (user_code, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Semantics:

- Exactly one of `device_id` / `waba_id` is set. Enforced in the controller, matching the existing
  FK-less style of `tbl_devices`.
- `id` is a UUID v4, the repo standard (`uuid` v4 is used everywhere else). Ordering comes from
  `created_at`, not from the id.
- `events` is a JSON array of allow-listed event names (section 4).
- `secret` is 32 random bytes, hex encoded (64 chars). Returned **once** in the subscribe response
  and used as the HMAC key (section 5.3).
- `status = 'revoked'` + `revoked_at` implements unsubscribe. Rows are kept for audit.
- Cap: at most **25 active subscriptions per `user_code`** (config value, not hardcoded).
- Idempotent subscribe: if an active row already exists for the same `(user_code, device_id,
  waba_id, target_url)`, return it instead of inserting. Zapier retries `performSubscribe`, and
  duplicates would double every event. Enforced in the service, not by a unique index, because
  MySQL treats `NULL`s in a unique index as distinct and one scope column is always `NULL`.

**Two id spaces, do not mix them.** The public API and `tbl_webhook_subscriptions.waba_id` use the
Meta `waba_id` column (`tbl_waba_accounts.waba_id`), because that is what SDK users pass. The event
forwarder in `kirimi-webhook` receives `waba:<tbl_waba_accounts.id>`, the internal PK. Resolution
happens in the forwarder (`resolvePublicWabaId`), and the receiver cache key keeps the internal form
(`webhookSubscriptionsCache_waba:<account.id>`), which is why unsubscribe looks the account up again
before invalidating.

Drizzle placement: `apps/api/src/schema/webhooks.ts` already exists (stale, wrong columns). Add the
new table to a new `apps/api/src/schema/webhook-subscriptions.ts` and leave the old file alone, or
fix the stale model in the same PR if it is safe — decide when implementing.

### 1.2 `tbl_webhook_events`

```sql
CREATE TABLE tbl_webhook_events (
  id         VARCHAR(36) NOT NULL,
  user_code  VARCHAR(100) NOT NULL,
  device_id  VARCHAR(100) NULL,
  waba_id    VARCHAR(100) NULL,
  event      VARCHAR(64) NOT NULL,
  payload    JSON        NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_webhook_events_device (device_id, created_at),
  KEY idx_webhook_events_waba (waba_id, created_at),
  KEY idx_webhook_events_user (user_code, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- Append-only, one row per emitted event, written whether or not any subscription exists. This is
  what makes `performList` deterministic.
- `payload` is the exact envelope that was delivered (section 5.1), so a polling sample has the same
  keys as a hook delivery (`T006`).
- Retention 30 days, same as webhook logs: register in `workers/log-cleanup.worker.ts:25` and in the
  cascade map `shared/services/cascade-registry.ts:94`.

## 2. Endpoints

All three sit in the public `/v1` stack with body auth and the standard envelope:

```ts
// apps/api/src/routes/api.routes.ts
api.post('/v1/webhook/subscribe',   securityCheck, rateLimit('WEBHOOK_SUBSCRIBE'),   authenticate, requireActiveUserSubscription, webhookSubscriptionController.subscribe)
api.post('/v1/webhook/unsubscribe', securityCheck, rateLimit('WEBHOOK_UNSUBSCRIBE'), authenticate, requireActiveUserSubscription, webhookSubscriptionController.unsubscribe)
api.post('/v1/webhook/events',      securityCheck, rateLimit('WEBHOOK_EVENTS'),      authenticate, requireActiveUserSubscription, webhookSubscriptionController.events)
```

Controller: `apps/api/src/controllers/api/webhook-subscription.controller.ts`. Validation stays
manual (`if (!x) return c.json(resFormat(false, null, '...'), 400)`) to match
`controllers/api/deposit.controller.ts:6`. Envelope helpers from `shared/utils/response.ts:46-66`.

New rate limit keys in `apps/api/src/config/security.ts` (unknown keys silently no-op, see
`shared/middleware/rate-limit.ts:12`):

```ts
WEBHOOK_SUBSCRIBE:   { max: 60,  window: 600 },
WEBHOOK_UNSUBSCRIBE: { max: 60,  window: 600 },
WEBHOOK_EVENTS:      { max: 300, window: 600 },
```

### 2.1 `POST /v1/webhook/subscribe`

```json
{
  "user_code": "U-XXXX",
  "secret": "....",
  "target_url": "https://hooks.zapier.com/hooks/catch/123456/abcdef/",
  "device_id": "D-2J3IG",
  "events": ["message", "message.sent"],
  "label": "zapier"
}
```

Validation matrix:

| Condition | Response |
|---|---|
| `target_url` missing, not a string, not starting with `https://`, or longer than 500 | 400 `target_url must be an https URL of at most 500 characters.` |
| `events` missing, not an array, empty, longer than 20, or contains an unknown name | 400 `events must be a non-empty array of known event names.` |
| both `device_id` and `waba_id`, or neither | 400 `Provide exactly one of device_id or waba_id.` |
| `device_id` not owned by `user_code` (or not found) | 403 `device_id is not available for this account.` |
| `waba_id` not owned by `user_code` | 403 `waba_id is not available for this account.` |
| 25 active subscriptions already exist | 400 `Subscription limit reached. Remove an existing subscription first.` |

Success (`200`):

```json
{
  "success": true,
  "data": {
    "id": "8f14e45f-ceea-4d1a-9a1e-2f5c6b7d8e90",
    "device_id": "D-2J3IG",
    "waba_id": null,
    "target_url": "https://hooks.zapier.com/hooks/catch/123456/abcdef/",
    "events": ["message", "message.sent"],
    "secret": "9f2c...64hexchars",
    "created_at": "2026-01-31T08:15:42.000Z"
  },
  "message": "OK"
}
```

Zapier stores this object as `bundle.subscribeData` and sends it back on unsubscribe, so keep the
field names stable. `secret` is the only place the HMAC key is handed out.

### 2.2 `POST /v1/webhook/unsubscribe`

```json
{ "user_code": "U-XXXX", "secret": "....", "id": "8f14e45f-ceea-4d1a-9a1e-2f5c6b7d8e90" }
```

| Condition | Response |
|---|---|
| `id` missing | 400 `id is required.` |
| subscription not found for this `user_code` | 404 `Subscription not found.` |
| already revoked | 200, idempotent |

Success (`200`): `{ "success": true, "data": { "id": "...", "status": "revoked" }, "message": "OK" }`

Also revoke when a delivery returns `410 Gone`, which is what Zapier answers if the Zap or its
subscription no longer exists. Treat it as terminal: mark revoked, stop delivering.

### 2.3 `POST /v1/webhook/events`

Source for Zapier's `performList` (sample data while a user sets up a Zap).

```json
{
  "user_code": "U-XXXX",
  "secret": "....",
  "device_id": "D-2J3IG",
  "events": ["message"],
  "limit": 20
}
```

- `events` optional; when omitted return every event for the scope.
- `limit` optional, default 20, max 100.
- Exactly one of `device_id` / `waba_id`, same rule as subscribe.
- Newest first.

Success (`200`):

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "8f14e45f-ceea-4d1a-9a1e-2f5c6b7d8e90",
        "event": "message",
        "created_at": "2026-01-31T08:15:42+07:00",
        "deviceId": "D-2J3IG",
        "from": "6281234567890",
        "message": "Halo",
        "datetime_wib": "2026-01-31 08:15:42"
      }
    ]
  },
  "message": "OK"
}
```

Each item is the stored payload verbatim, so its keys match what the hook delivers.

## 3. Delivery (fan-out)

### 3.1 What changes in `kirimi-webhook`

`WebhookForwarder.forwardEvent` (`src/services/webhook-forwarder.ts:17`) keeps doing exactly what it
does today for the dashboard URL, then additionally enqueues one job per active subscription.

Suggested shape:

```
forwardEvent(event, deviceId, payload)
  ├── existing: resolve dashboard url -> filter events -> POST (unchanged)
  ├── write tbl_webhook_events row (once, regardless of subscriptions)
  └── for each active subscription of deviceId where events includes event:
        enqueue subscription delivery job
```

- Load subscriptions with a short Redis cache next to the existing ones
  (`webhookUrlCache_<deviceId>` / `webhookEventsCache_<deviceId>` pattern,
  `apps/api/src/controllers/member/device.controller.ts:794,842`): key
  `webhookSubscriptionsCache_<deviceId>` (for WABA the deviceId is `waba:<tbl_waba_accounts.id>`),
  TTL 3600, read-through, and an explicit `DEL` from mono-v2 on subscribe/unsubscribe so a change
  takes effect immediately instead of after the TTL.
- Deliver subscription targets with a direct `POST` in `Promise.allSettled`, 10s timeout per target,
  no retries. Rationale: Zapier does not deduplicate hook deliveries, so a retry can produce a
  duplicate automation run, and the dashboard delivery path has no retries today either. Accepted
  risk: a transient receiver outage loses that one event. If that ever matters more than duplicates,
  retry only on connection errors and 5xx (where the receiver certainly did not accept the body) and
  keep 4xx terminal.
- A failing or slow subscription target must never delay or fail the dashboard delivery, and never
  fail the request that produced the event. Fire-and-forget, as today.
- On `410 Gone`, mark the subscription revoked (section 2.2).
- Update `last_event_at` on a successful delivery.

### 3.2 Payload envelope (additive)

```json
{
  "event": "message",
  "id": "8f14e45f-ceea-4d1a-9a1e-2f5c6b7d8e90",
  "created_at": "2026-01-31T08:15:42+07:00",
  "datetime_wib": "2026-01-31 08:15:42",
  "deviceId": "D-2J3IG"
}
```

- `id` — UUID v4, unique per emitted event. Same value as the `tbl_webhook_events` row for that event.
- `created_at` — ISO-8601 with `+07:00` offset, required by Zapier (`D023`, `T003`).
- `datetime_wib` — unchanged; existing consumers depend on it.
- Emitted for every delivery, dashboard included. A flag that only applies to subscriptions would be
  a branch nobody tests.

### 3.3 Headers and signature

Dashboard deliveries keep today's headers. Subscription deliveries add:

```
X-Kirimi-Event: message
X-Kirimi-Timestamp: 1769834142
X-Kirimi-Signature: sha256=<hex>
```

Signature definition (Stripe style, so it is familiar and replay resistant):

```
signed_payload = `${timestamp}.${rawBody}`      // rawBody = exact bytes sent
signature      = hex(HMAC-SHA256(signed_payload, subscription.secret))
```

- `secret` is the hex string from subscribe, used as UTF-8 bytes.
- Zapier verifies with a timing-safe compare and rejects when `|now - timestamp| > 300s`.
- This is what stops a leaked hook URL from injecting fake events into a Zap, so it is required for
  subscription deliveries. The WABA worker already sends `X-Kirimi-Event`
  (`apps/api/src/workers/waba-webhook-forward.worker.ts:105`) — add the same header to device
  deliveries for consistency.

### 3.4 Events the integration will actually subscribe to

Allow-lists stay exactly as they are today; the new endpoints only validate against them:

- Device (20 names, `apps/api/src/controllers/member/device.controller.ts:817-823`):
  `message`, `message.outgoing`, `message.history`, `message.sent`, `message.failed`,
  `message.ack`, `connection.connected`, `connection.disconnected`, `logged_out`, `qr`,
  `group.join`, `group.leave`, `group.update`, `presence.update`, `call.offer`, `device.created`,
  `device.connected`, `device.status_changed`, `device.last_active`, `device.reconnected`
- WABA (10 names, `apps/api/src/shared/utils/waba-webhook-events.ts:1-12`):
  `message`, `message.sent`, `message.ack`, `message.failed`, `template.status_update`,
  `template.quality_update`, `account.review_update`, `account.alerts`, `account.banned`,
  `phone_number.quality_update`

Known upstream limitation: `message.ack` is commented out for device events
(`kirimi-webhook/src/handlers/message-ack.ts:55`), so a device subscription to `message.ack` is
accepted but never fires. Either enable it or document it; do not ship a trigger that silently does
nothing.

## 4. Zapier side contract

Trigger ↔ event ↔ required payload keys. `normalizeEvent` in the integration maps both hook
deliveries and `performList` items through the same function, so keys always match.

| Trigger key | Label | Events | Scope |
|---|---|---|---|
| `new_message` | New Inbound Message | `message` | device |
| `message_status` | Message Status Updated | `message.sent`, `message.failed` | device |
| `new_waba_message` | New WABA Message | `message` | waba |

Output fields the integration exposes (all present in the payload, so `T005`/`T006` pass):

| Field | Source |
|---|---|
| `id` | envelope `id` |
| `event` | envelope `event` |
| `created_at` | envelope `created_at` (falls back to converting `datetime_wib` to `+07:00`) |
| `device_id` / `waba_id` | envelope `deviceId` / subscription scope |
| `from`, `to` | event payload |
| `message` | event payload text, when present |
| `message_id` | event payload `msgId`, when present |
| `status` | `message.sent` / `message.failed` payload status, when present |

Fallback rule: if the backend ships without `id`/`created_at`, `normalizeEvent` synthesizes them
(`msgId` or a hash of the raw body for the id, `datetime_wib + "+07:00"` for the timestamp). That
keeps the Zapier side shippable and testable before the backend work lands, with no payload
contract change later.

## 5. Work checklists

### 5.1 `kirimi-mono-v2`

- [x] Migration: `tbl_webhook_subscriptions`, `tbl_webhook_events` + indexes
      (`apps/api/drizzle/0080_webhook_subscriptions.sql`)
- [x] Drizzle schema for both tables (`apps/api/src/schema/webhook-subscriptions.ts`, barrel updated)
- [x] `webhook-subscription.controller.ts` with `subscribe`, `unsubscribe`, `events`
- [x] Routes in `api.routes.ts` with the stack above
- [x] Three `RateLimitKey` entries in `config/security.ts`
- [x] Subscription cap + idempotent subscribe
- [x] Ownership checks for `device_id` / `waba_id`
- [x] Event name validation against both allow-lists (`shared/utils/device-webhook-events.ts` is the
      single source now, the member controller imports it instead of keeping a copy)
- [x] Retention + cascade registration for the new tables
- [x] Redis cache invalidation on subscribe/unsubscribe
- [ ] `ApiDocsPage.tsx` cards and `api-docs-llm.ts` entries — still to do, these are hand maintained
- [x] Controller validator tests (`webhook-subscription.controller.test.ts`, 24 cases via `bun test`)
- [ ] End-to-end test of `/v1/webhook/events` against a real delivery (needs a database)

### 5.2 `kirimi-webhook`

- [x] Load active subscriptions per device/WABA (cached, invalidated from mono-v2)
- [x] Fan-out in `Promise.allSettled` with per-target timeout, no retries (see 3.1)
- [x] Write `tbl_webhook_events` for every emitted event
- [x] Add `id` (UUID v4) and `created_at` (`+07:00`) to the envelope
- [x] `X-Kirimi-Event`, `X-Kirimi-Timestamp`, `X-Kirimi-Signature` on subscription deliveries
- [x] Revoke on `410`, update `last_event_at` on success
- [x] Dashboard delivery path unchanged except for the two additive envelope fields
- [ ] Decide on `message.ack` for device events (enable or document) — still open
- [x] Unit tests for the new module (`webhook-subscription-forwarder.service.test.ts`, 19 cases)

### 5.3 `kirimi-zapier`

- [x] Three hook triggers with `type: 'hook'`, `performSubscribe`, `performUnsubscribe`, `perform`,
      `performList`
- [x] `normalizeEvent` used by both `perform` and `performList`, with signature verification
- [x] `device_id` / `waba_id` dynamic dropdowns reused from `lib/devices.js`
- [x] Help text that states the duplicate-run caveat and the `message.ack` limitation
- [x] Tests with nock: subscribe body and stored `subscribeData`, unsubscribe body, `performList`
      mapping, signature accept/reject/stale, key parity between `perform` and `performList`
- [x] `display.hidden: true` until the backend is deployed
- [x] `ZAPIER-PUBLISHING.md` updated (9 → 12 visible operations, new live Zaps)
- [ ] Unhide and release as 1.1.0 once both services are live

## 6. Rollout order

1. mono-v2 tables + endpoints, deployed. Nothing consumes them yet.
2. kirimi-webhook fan-out + payload + signature, deployed. Dashboard path unchanged.
3. kirimi-zapier triggers implemented and tested locally, `display.hidden: true`, pushed as 1.1.0.
4. Live test Zaps for the three triggers, then unhide, then submit the next review.

Rollback: revoking all subscriptions (`status='revoked'`) returns the system to today's behaviour,
because the dashboard path was never modified.

## 7. Acceptance criteria

- [ ] A customer's existing dashboard webhook keeps receiving events, unchanged, while a Zapier
      subscription is active.
- [ ] Subscribing twice with the same `(user, scope, target_url)` yields one subscription.
- [ ] A Zap that fires 50 events in a minute receives 50 deliveries exactly once (no duplicate runs
      unless a retry was actually needed).
- [ ] `performList` returns items whose keys are a superset of the hook payload keys.
- [ ] A delivery with a broken signature is rejected in the Zapier trigger with a user-facing error.
- [ ] A dead target URL (404/500/timeout) never delays the dashboard delivery and never fails the
      API call that produced the event.
- [ ] Unsubscribing frees a subscription slot and stops deliveries within the cache TTL.
- [ ] `zapier-platform validate` stays clean and `npm test` covers every new trigger path.
