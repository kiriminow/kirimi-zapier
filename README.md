# kirimi-zapier

Zapier integration for [Kirimi](https://kirimi.id) — send WhatsApp messages, broadcasts, WhatsApp
Business API templates, and OTP codes from any of Zapier's 9,000+ apps, and react to inbound
messages as they arrive.

Built with Zapier Platform CLI (`zapier-platform-core` 19.x, Node 22, CommonJS).

## What this integration does

### Triggers (instant, REST Hook)

| Trigger | Events | Scope | Visible |
|---|---|---|---|
| New Inbound Message | `message` | device | hidden |
| Message Status Updated | `message.sent`, `message.failed` | device | hidden |
| New WABA Message | `message` | waba | hidden |

The triggers are implemented and tested but hidden because they depend on public API endpoints that
do not exist yet: `POST /v1/webhook/subscribe`, `/v1/webhook/unsubscribe`, and `/v1/webhook/events`.
Zapier forbids static webhook triggers in public integrations (`D016`, `D017`), so these cannot ship
without the backend. The contract is specified in
[`docs/WEBHOOK-SUBSCRIPTIONS-API.md`](docs/WEBHOOK-SUBSCRIPTIONS-API.md).

### Actions

| Action | Endpoint | Visible |
|---|---|---|
| Send Message | `POST /v1/send-message` | yes |
| Send Message Fast | `POST /v1/send-message-fast` | yes |
| Broadcast Message | `POST /v1/broadcast-message` | yes |
| Send WABA Template Message | `POST /v1/waba/send-message` | yes |
| Reply WABA Message | `POST /v1/waba/messages/reply` | yes |
| Send OTP | `POST /v2/otp/send` | yes |
| Verify OTP | `POST /v2/otp/verify` | yes |
| Save Contact | `POST /v1/save-contact` | yes |
| Send Message with File | `POST /v1/send-message-file` (multipart) | hidden |
| Save Contacts in Bulk | `POST /v1/save-contacts-bulk` | hidden |
| Create Reverse OTP | `POST /v2/otp-reverse/create` | hidden |

### Searches

| Search | Endpoint | Visible |
|---|---|---|
| Find Device Status | `POST /v1/device-status-enhanced` | yes |
| Find Reverse OTP Status | `POST /v2/otp-reverse/status` | hidden |

Operations marked **hidden** are implemented and tested but not selectable in the Zap editor yet.
Zapier requires one live Zap with a successful run for every visible operation before an
integration can be published, so the hidden ones are flipped on in a later minor version once
their test Zaps exist. See `test/app.test.js` for the guard that keeps this list honest.

## Authentication

Every Kirimi request carries `user_code` and `secret` **in the JSON body**, not in a header.
This integration collects both once through Zapier's custom authentication form
(`authentication.js`) and injects them with `requestTemplate`:

```js
requestTemplate: {
  body: {
    user_code: '{{bundle.authData.user_code}}',
    secret: '{{bundle.authData.secret}}',
  },
},
```

No action ever asks for credentials, which is what Zapier check `D001` demands. The connection is
verified against `POST /v1/user-info`, and the connection label prefers the account name returned
by that call.

## Development

```bash
npm install
npm test                     # node --test, nock stubs the Kirimi API
npm run validate             # zapier-platform validate --without-style (offline)
npm run push                 # zapier-platform push (needs zapier-platform login)
```

Link the local folder to the registered integration once:

```bash
npx zapier-platform register "Kirimi"   # first time only
npx zapier-platform link                # picks the integration and writes .zapierapprc
npx zapier-platform users:add dev@kirimi.id 1.0.0
```

`.zapierapprc` is committed on purpose: CI uses it to push releases. Branding (name, logo,
category, description) lives in the Zapier UI, not in this repository.

### Placeholders in OTP messages

Zapier strips `{{...}}` from any value that flows through a Zap, so users cannot type
`{{otp}}`/`{{token}}`/`{{phone}}` themselves. Send OTP and Create Reverse OTP accept square
brackets instead and translate them before the request:

| User writes | Kirimi receives |
|---|---|
| `[otp]` | `{{otp}}` |
| `[token]` | `{{token}}` |
| `[phone]` | `{{phone}}` |

Those two operations send a pre-stringified JSON body because Zapier also cleans `{{...}}` out of
plain object bodies. Everything else uses the shared `requestTemplate`.

## Layout

```
index.js                 app definition: auth, requestTemplate, errors, triggers, creates, searches
authentication.js        custom auth (user_code + secret) and connection label
lib/constants.js         API base URL
lib/util.js              body shaping, envelope unwrapping, placeholder translation
lib/devices.js           device dynamic dropdown shared by six operations
lib/events.js            event normalization, HMAC signature verification, trigger output fields
lib/errors.js            Kirimi error envelope and HTTP status to Zapier error mapping
triggers/                REST Hook triggers, one file per trigger, aggregated in triggers/index.js
creates/                 one file per action, aggregated in creates/index.js
searches/                one file per search, aggregated in searches/index.js
test/                    node:test suites with nock stubs
docs/                    trigger design and the backend contract it depends on
```

## Trigger delivery rules

A hook subscription registers `bundle.targetUrl` with Kirimi and stores whatever the API returns in
`bundle.subscribeData`; unsubscribe sends the subscription `id` back. Two rules shaped the code:

- **Signature**: subscription deliveries carry `X-Kirimi-Signature`, an HMAC-SHA256 over
  `<timestamp>.<raw body>`, verified with a timing-safe compare and a 5 minute freshness window. The
  check only runs when Zapier exposes `bundle.rawRequest` and the subscription has a secret; if the
  platform does not hand over the raw request there is nothing to verify against, so the event is
  accepted. `test/triggers.test.js` covers accept, reject, unsigned, and stale.
- **Stable ids and timestamps**: Zapier needs ISO-8601 with an offset (`D023`) and a stable id per
  event. `lib/events.js` takes `created_at` when the API sends it and otherwise converts
  `datetime_wib` to `+07:00`, and falls back to `msgId` or a payload fingerprint for the id, so the
  triggers work before the backend changes land and keep working after.

## Error handling

`lib/errors.js` maps Kirimi's response envelope and status codes onto Zapier errors so users see
the reason instead of a generic failure:

| Status | Zapier error |
|---|---|
| 400 | `Error` with the API message, user fixable |
| 401 | `Error` asking the user to reconnect |
| 402 | `Error`, insufficient balance |
| 403 | `Error`, feature missing from the package |
| 404 | `Error`, resource not found |
| 429 | `ThrottledError`, retried by Zapier |
| 500, 503 | left to Zapier, retried |
| 502 | `Error`, undeliverable number |
| 2xx with `success: false` | `Error` with the API message |

## Publishing

`ZAPIER-PUBLISHING.md` is the checklist for the public app review, mapped to Zapier's automated
checks and publishing requirements.

## Links

- Kirimi: https://kirimi.id
- API base URL: `https://api.kirimi.id`
- Zapier CLI docs: https://docs.zapier.com/integrations/build-cli/overview
- Zapier checks reference: https://docs.zapier.com/integrations/publish/integration-checks-reference
