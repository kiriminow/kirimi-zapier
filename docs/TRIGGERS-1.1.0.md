# Kirimi triggers on Zapier — design for 1.1.0

Status: **design approved.** The fan-out and `performList` decisions are locked
(new `tbl_webhook_subscriptions` + new `tbl_webhook_events`). The implementation-ready contract is
[WEBHOOK-SUBSCRIPTIONS-API.md](./WEBHOOK-SUBSCRIPTIONS-API.md); this document explains why the work
is needed and what was found in the existing pipeline.

The Zapier side is already written (`triggers/`, `lib/events.js`, `test/triggers.test.js`) and ships
as `display.hidden: true` until the endpoints below exist.

Goal: give Zaps an instant event source (inbound WhatsApp message, delivery status, WABA message)
so users can react to conversations instead of only sending into them.

## 1. Why this is not a small change

Zapier rejects static webhook triggers in public integrations (`D016`, `D017`). A trigger must
therefore be a **REST Hook**: the integration registers a URL with Kirimi
(`performSubscribe`), receives real events, and can deregister (`performUnsubscribe`). Zapier also
requires a **`performList`** fallback so a user can pull a sample in the editor without waiting for
a live event (`D006`), and the polling sample keys must match the hook payload keys (`T006`).

That means the Kirimi API must be able to:

1. store N hook subscriptions per account, without touching the customer's existing dashboard
   webhook configuration,
2. deliver events to all of them,
3. expose the recent events of a subscription for the `performList` call,
4. hand back a subscription handle that Zapier sends to `performUnsubscribe`.

## 2. What exists today (verified against source)

| Fact | Where |
|---|---|
| Device webhook config is a single URL + event toggles on the device row | `kirimi-mono-v2/apps/api/src/schema/devices.ts:30-31` (`webhook_url`, `webhook_events`) |
| WABA webhook config is a single URL on the WABA row, events in a JSON column | `apps/api/src/schema/waba.ts:21`, `migrations/2026-05-09-waba-webhook-events.sql:3` |
| User level fallback URL exists for channel accounts | `apps/api/src/schema/users.ts:43` |
| Delivery to device/WABA URLs happens in a **sibling repo**, not mono-v2 | `kirimi-webhook/src/services/webhook-forwarder.ts:17`, `kirimi-webhook/src/models/DeviceModel.ts:55` |
| Payload envelope is `{ event, ...eventFields, datetime_wib }`, camelCase fields, `datetime_wib` = `YYYY-MM-DD HH:mm:ss` in WIB, **no timezone, no unique id** | `kirimi-webhook/src/services/webhook-forwarder.ts:86-94` |
| Headers: `Content-Type`, `User-Agent`; WABA adds `X-Kirimi-Event`; **no signature anywhere** | `webhook-forwarder.ts:100-103`, `apps/api/src/workers/waba-webhook-forward.worker.ts:105-109` |
| Device events filtered by the per-device JSON toggles (`NULL` = all enabled) | `kirimi-webhook/src/services/webhook-events.service.ts:15,106,133` |
| `message.ack` forwarding is **commented out** for device events | `kirimi-webhook/src/handlers/message-ack.ts:55` |
| Outbound deliveries are logged, but the table has two divergent writers (`event` vs `event_name`, `http_status` vs `status_code`) | `kirimi-webhook/migrations/add_webhook_logs_table.sql:4`, `apps/api/src/shared/services/device-webhook-log.service.ts:17`, `kirimi-webhook/src/services/webhook-logger.ts:27` |
| Public `/v1/*` auth reads `user_code` + `secret` from the body, sets `c.get('user')` | `apps/api/src/shared/middleware/auth.ts:14,59` |
| Public routes declare `securityCheck, rateLimit('KEY'), authenticate, requireActiveUserSubscription` | `apps/api/src/routes/api.routes.ts:48` |
| `rateLimit` silently no-ops for unknown keys, so a new endpoint needs a new key | `apps/api/src/config/security.ts:14-36,78`, `shared/middleware/rate-limit.ts:12-16` |
| No webhook management is exposed publicly today; all of it is member/JWT only | `apps/api/src/routes/member.routes.ts:147-150,567-577` |
| API docs are hand maintained in two places | `apps/web/src/pages/ApiDocsPage.tsx:398`, `apps/web/src/lib/api-docs-llm.ts:74` |

## 3. The four blockers

1. **One URL per device.** A Zapier subscription cannot be stored in `tbl_devices.webhook_url`
   without clobbering whatever the customer already configured in the dashboard, and only one Zap
   could ever subscribe. This is the blocker that forces real work.
2. **No unique id and no timezone-aware timestamp.** `performList` results are matched against hook
   payloads (`T006`) and Zapier wants ISO-8601 with an offset (`D023`), so an item-level id and an
   ISO timestamp are needed.
3. **No signature.** Zapier's hook URL is a bearer secret in practice; a returned
   `X-Kirimi-Signature` lets the integration reject forged deliveries.
4. **`message.ack` never fires for device events** (commented out), so a "Message Status Updated"
   trigger only sees `message.sent` and `message.failed` on the unofficial channel.

## 4. Proposed backend design

### 4.1 New table `tbl_webhook_subscriptions`

Additive. Nothing existing is modified, so dashboard webhooks keep working untouched.

| column | type | notes |
|---|---|---|
| `id` | varchar(36) PK | ULID or UUID, returned to Zapier and used by unsubscribe |
| `user_code` | varchar(100) notNull | owner, indexed |
| `device_id` | varchar(100) null | scope, indexed, mutually exclusive with `waba_id` |
| `waba_id` | varchar(100) null | scope, indexed |
| `target_url` | varchar(500) notNull | must be `https://` (Zapier sends https hook URLs) |
| `events` | json notNull | array of event names, e.g. `["message","message.sent"]` |
| `secret` | varchar(64) notNull | per-subscription HMAC key, returned once on subscribe |
| `label` | varchar(100) null | optional caller label, e.g. `zapier` |
| `status` | enum('active','revoked') default 'active' | unsubscribe flips it; revocation is idempotent |
| `created_at` | timestamp default now | |
| `revoked_at` | timestamp null | |
| `last_event_at` | timestamp null | cheap health signal, optional |

Indexes: `(device_id, status)`, `(waba_id, status)`, `(user_code, status)`.

### 4.2 Delivery fan-out

`kirimi-webhook` currently resolves one URL per device (`DeviceModel.getWebhookUrl`). Extend that
path to also load active subscriptions for the device/WABA and deliver to each, in parallel, with a
per-target timeout. Order of operations must stay non-blocking: the existing dashboard delivery
must not fail or slow down because a Zapier endpoint is slow or dead.

Rules:

- keep the existing single-URL delivery exactly as it is,
- add subscription deliveries as additional targets,
- filter by `events`, reusing `WebhookEventsService.shouldSendEvent`,
- record each attempt so `performList` and support have data (section 4.4),
- never let a subscription 4xx/5xx affect the primary delivery or the request that triggered it.

### 4.3 Enriched payload

Additive fields on the envelope, so existing consumers keep working:

```json
{
  "event": "message",
  "id": "01J8Z2W4K6Z8Q5R1V0M3N7P2TB",
  "created_at": "2026-01-31T08:15:42+07:00",
  "datetime_wib": "2026-01-31 08:15:42",
  "deviceId": "D-2J3IG",
  "...": "unchanged event specific fields"
}
```

- `id` — unique per delivered event, ULID preferred so it sorts by time.
- `created_at` — ISO-8601 with the `+07:00` offset (`D023`, `T003`).
- `datetime_wib` — untouched, existing consumers depend on it.
- Both new fields enabled for every delivery (not only Zapier), because a flag adds a branch that
  nobody would test.

`X-Kirimi-Signature: sha256=<hex hmac of the raw body using the subscription secret>` for
subscription deliveries only. The Zapier trigger verifies it in `perform` with
`bundle.rawRequest.content` and rejects a mismatch. The primary dashboard delivery is left
unsigned so nothing existing has to change.

### 4.4 Recent events for `performList`

The log table cannot be trusted as-is (divergent columns, 30 day retention, only written when a
delivery happens). **Decision: `tbl_webhook_events`**, described in the spec:

- Append-only `tbl_webhook_events`: `id`, `user_code`, `device_id`, `waba_id`, `event`, `payload`
  json, `created_at`, retention 30 days via the existing `workers/log-cleanup.worker.ts`. Written by
  the same code path that fans out, for every emitted event, whether or not a subscription exists.
  This makes `performList` deterministic and gives the subscription path its own audit trail.

### 4.5 Public API endpoints

All three follow the existing public route stack and envelope.

```
POST /v1/webhook/subscribe
  body: user_code, secret, target_url, events[], device_id | waba_id, label?
  200 : { success: true, data: { id, target_url, events, secret, created_at }, message: "OK" }
  400 : invalid target_url (not https), empty events, both or neither scope, unknown event name
  403 : device_id / waba_id not owned by the account
  429

POST /v1/webhook/unsubscribe
  body: user_code, secret, id
  200 : { success: true, data: { id, status: "revoked" }, message: "OK" }
  404 : unknown subscription for this account
  revoked subscriptions are idempotent: unsubscribing twice still returns 200

POST /v1/webhook/events
  body: user_code, secret, device_id | waba_id, events[]?, limit? (default 20, max 100)
  200 : { success: true, data: { items: [ { id, event, created_at, deviceId, ...payload } ] }, message: "OK" }
```

Notes:

- New `RateLimitKey` entries in `config/security.ts`, otherwise `rateLimit('...')` silently no-ops.
- Validation stays manual (`if (!x) return c.json(resFormat(false, ...), 400)`) to match
  `controllers/api/*` conventions.
- Subscription cap per account (suggest 25) so a runaway Zap cannot create thousands of rows.
- `events` must be validated against the allow-list `controllers/member/device.controller.ts:817`
  (device) and `shared/utils/waba-webhook-events.ts:1` (WABA), otherwise a typo silently produces a
  dead subscription.

### 4.6 Docs to update for consistency

- `apps/web/src/pages/ApiDocsPage.tsx` (endpoint cards)
- `apps/web/src/lib/api-docs-llm.ts` (LLM doc)
- the repo's `API-ALIGNMENT.md` in `kirimi-sdk`, which is the contract all SDKs are built against —
  three new public endpoints change "30 public endpoints"

## 5. Zapier side: trigger design

A hook trigger in `zapier-platform-core` has this shape (field names to be re-verified against
`zapier-platform-schema` when implementing):

```js
module.exports = {
  key: 'new_message',
  noun: 'Message',
  display: {
    label: 'New Inbound Message',
    description: 'Triggers when a WhatsApp message arrives on a device.',
  },
  operation: {
    type: 'hook',
    inputFields: [deviceField(), {
      key: 'include_from_me',
      label: 'Include messages you sent',
      type: 'boolean',
      required: false,
      helpText: 'Leave this off to trigger only on messages customers send to you.',
    }],
    performSubscribe: async (z, bundle) => {
      const response = await z.request({
        url: `${BASE_URL}/v1/webhook/subscribe`,
        method: 'POST',
        body: {
          target_url: bundle.targetUrl,
          device_id: bundle.inputData.device_id,
          events: ['message'],
          label: 'zapier',
        },
      });
      return response.data.data; // stored as bundle.subscribeData
    },
    performUnsubscribe: async (z, bundle) => {
      await z.request({
        url: `${BASE_URL}/v1/webhook/unsubscribe`,
        method: 'POST',
        body: { id: bundle.subscribeData.id },
      });
      return {};
    },
    perform: (z, bundle) => [normalizeEvent(z, bundle)],
    performList: async (z, bundle) => {
      const response = await z.request({
        url: `${BASE_URL}/v1/webhook/events`,
        method: 'POST',
        body: { device_id: bundle.inputData.device_id, events: ['message'], limit: 20 },
      });
      return response.data.data.items.map((item) => normalizeEvent(z, item));
    },
    sample: { id: '01J8Z2W4K6Z8Q5R1V0M3N7P2TB', event: 'message', from: '6281234567890', message: 'Halo', created_at: '2026-01-31T08:15:42+07:00' },
  },
};
```

`normalizeEvent` is important: it maps the payload into a stable shape, converts `datetime_wib`
into ISO when `created_at` is missing, synthesizes an id from `msgId` when the backend has not
shipped `id` yet, and verifies `X-Kirimi-Signature` when `bundle.subscribeData.secret` exists.
Both `performList` and `perform` must run through it so the polling sample keys match the hook
keys (`T006`).

Proposed visible triggers for 1.1.0, kept small on purpose because every visible trigger needs a
live Zap with a successful run before review (`S002`, `T001`):

| Trigger | Events | Scope |
|---|---|---|
| New Inbound Message | `message` | device |
| Message Status Updated | `message.sent`, `message.failed` (plus `message.ack` for WABA) | device, waba |
| New WABA Message | `message` | waba |

Candidates left for a later version: connection state, group events, presence, call offers,
template status updates.

## 6. Versioning and review impact

- 1.1.0 is an **additive minor version**: new triggers, no removals, existing Zaps unaffected.
- Three new visible operations raise the live Zap requirement from 9 to 12. Build them in a test
  account first, unhide one at a time if the review load becomes a problem (`display.hidden`).
- If the subscription table or `id` field ships later than the triggers, ship the triggers with
  `display.hidden: true` and normalize payloads defensively until the backend catches up.

## 7. Work breakdown

| Repo | Work | Blocking? |
|---|---|---|
| `kirimi-mono-v2` | migration for `tbl_webhook_subscriptions` (+ `tbl_webhook_events` if option A), 3 controllers in `controllers/api/`, routes in `api.routes.ts`, `RateLimitKey` entries, docs pages | yes |
| `kirimi-webhook` | load subscriptions in `DeviceModel`, fan-out with per-target timeout and logging, add `id` + `created_at` to the envelope, HMAC header for subscription targets | yes |
| `kirimi-sdk` | `API-ALIGNMENT.md` update (30 → 33 endpoints), SDK methods optional | no |
| `kirimi-zapier` | three hook triggers + `normalizeEvent`, tests with nock (subscribe/unsubscribe/list/perform), `display.hidden` until backend is live | no |

Rough order: mono-v2 endpoints and table first (a trigger can be tested against them with a real
`push`), then the forwarder, then the Zapier triggers, then unhide.

## 8. Risks

- **Delivery amplification**: a Zap hooked to `message` plus a customer's existing dashboard webhook
  doubles outbound traffic per event. The fan-out must be bounded (subscription cap) and must not
  block the triggering request.
- **Zapier hook URLs are public endpoints**; without signature verification anyone who learns the
  URL can inject fake events into a Zap. Signature is therefore part of the design, not a nice to
  have.
- **`performList` data source** is the weakest part: option B depends on a table with two
  inconsistent writers. Option A costs one more table and removes the ambiguity.
- **Ack events on the unofficial channel** are disabled upstream; advertising a status trigger that
  silently never fires for device events would generate support tickets. Either enable forwarding or
  restrict the status trigger to `message.sent` / `message.failed` and say so in the help text.
- **Zapier review timing**: reviewers ask for a demo of every trigger; a hook trigger needs a live
  WhatsApp message during review, which is fine but must be documented for the test account in
  `ZAPIER-PUBLISHING.md`.

## 9. Resolved and remaining questions

Resolved:

- Fan-out: new `tbl_webhook_subscriptions`, dashboard delivery path untouched.
- `performList` source: new `tbl_webhook_events`.
- Retention and cleanup: 30 days, reusing `workers/log-cleanup.worker.ts` and the cascade map.

Remaining, to settle while implementing:

1. Should a subscription be scoped to the whole account instead of one device? The forwarder
   resolves targets per device, so account scope needs a join or an internal per-device fan-out.
2. `events` as a hard allow-list (chosen in the spec) means a typo is a 400 instead of a silent dead
   subscription. Confirm that is the wanted behaviour for third-party callers.
3. Do we want WABA `template.status_update` and account alerts available to Zaps in the first
   release, or messages only?
