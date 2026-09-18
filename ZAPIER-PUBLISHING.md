# Kirimi on Zapier — public app checklist

Goal: get **Kirimi** listed in the [Zapier App Directory](https://zapier.com/apps).

Sources:
- [Publishing requirements](https://docs.zapier.com/integrations/publish/integration-publishing-requirements)
- [Automated check reference](https://docs.zapier.com/integrations/publish/integration-checks-reference)
- [Publishing process](https://docs.zapier.com/integrations/publish/public-integration)
- [Branding guidelines](https://docs.zapier.com/integrations/publish/branding-guidelines)

Legend: `[x]` done in code · `[ ]` needs a Kirimi human · `[~]` partially done

## 1. Account and ownership (needs a Kirimi human)

Zapier only publishes integrations whose owning account clearly belongs to the company behind the
API. This is the part code cannot do.

- [ ] Developer account on [developer.zapier.com](https://developer.zapier.com) registered with a
      **@kirimi.id** email (check `M005`, `7.2`). A personal or agency email will be rejected.
- [ ] Sign the Developer Terms of Service once logged in (check `U001`).
- [ ] Set the owning account role to **Employee** or **Contractor** of Kirimi (check `M003`).
- [ ] Add teammates who will maintain the integration as admins so review questions reach more
      than one person (`zapier-platform team:add`).
- [ ] Confirm the Platform Agreement and that sending WhatsApp through Kirimi complies with Meta
      and local messaging rules. Zapier removes integrations used for spam or unsolicited
      messages (requirement `1.5`), so be ready to state the opt-in policy on request.
- [ ] Note for the submission: this integration deliberately exposes **no** deposit, balance, or
      payment endpoints, so requirement `1.4` (no financial transactions) is not in play.

## 2. Branding and listing (needs a Kirimi human, partly done)

Branding is set in the Zapier UI, not in this repository.

- [ ] App name: **Kirimi** (check `M007`, tier-1 name). Confirm nothing already uses it in the
      [directory](https://zapier.com/apps).
- [x] Description prepared, already in `package.json` (`M002`):
      `Kirimi is a WhatsApp messaging platform for sending messages, broadcasts, WABA templates, and OTP codes.`
- [ ] Description pasted into the integration settings (max 140 characters, no mention of Zapier).
- [ ] Homepage URL: `https://kirimi.id` (check `M006`).
- [ ] Logo: square PNG, at least 512×512, RGBA with transparent background (check `M004`).
      Convert `n8n-nodes-kirimi/nodes/Kirimi/kirimi.svg` or use the official brand export.
- [ ] Category: **Communication → Phone & SMS** (check `M001`). Kirimi is a messaging channel,
      not a team chat tool.
- [ ] Primary color from the brand palette. Not `#FFFFFF`.

## 3. Public app facts Zapier will ask about

- [ ] API documentation URL for the submission (`5.2`). Point at the public API docs on
      kirimi.id; the endpoint contract is summarised in `kirimi-sdk/API-ALIGNMENT.md`.
- [ ] Production API confirmation (`5.4`): `https://api.kirimi.id` is the production host. No
      sandbox or staging host is used anywhere in `lib/constants.js`.
- [ ] Test account for the Zapier support team (`7.1`):
      - Non-expiring account registered to `integration-testing@zapier.com`.
      - Zapier staff must be able to change the password, or the account must be passwordless
        (OTP or magic link).
      - All paid features used by the actions must be enabled, without trial limits. That means a
        funded balance or an active package that covers send-message, WABA, and OTP v2.
      - Supply any extra login credentials and a short demo note for non-obvious features.
      - Once the hook triggers are visible, reviewers must be able to produce a real event: a
        connected device that can receive a WhatsApp message, plus a note explaining that the
        trigger Zaps are switched on with a sample message already delivered.

## 4. Live Zaps (needs testers, this is the long pole)

Zapier requires proof that every visible operation works in production, in the admin accounts:

- [ ] `S001` — at least **3 users** have a live Zap using the integration. Invite them with
      `npx zapier-platform users:add tester@example.com 1.0.0` (email invites cap at 200 users) or
      the public share link from the Sharing tab.
- [ ] `S002` / `T001` — one live Zap **with at least one successful run** for every visible
      operation, built in an admin account so Zap History counts it:

      | # | Visible operation |
      |---|---|
      | 1 | Send Message |
      | 2 | Send Message Fast |
      | 3 | Broadcast Message |
      | 4 | Send WABA Template Message |
      | 5 | Reply WABA Message |
      | 6 | Send OTP |
      | 7 | Verify OTP |
      | 8 | Save Contact |
      | 9 | Find Device Status |

- [ ] When the hook triggers ship (they are written but `display.hidden` until
      `/v1/webhook/subscribe` exists), three more live Zaps are needed, and each one needs a real
      event during review:

      | # | Visible operation |
      |---|---|
      | 10 | New Inbound Message |
      | 11 | Message Status Updated |
      | 12 | New WABA Message |

- [ ] Keep those Zaps and their runs. Do not delete them before or during review; Zapier may ask
      to inspect them.
- [ ] Only then flip the hidden operations on in a `1.1.0` version (Send Message with File, Save
      Contacts in Bulk, Create Reverse OTP, Find Reverse OTP Status, and the three hook triggers
      once the webhook subscription endpoints are live). Each new visible operation needs its own
      live Zap, so unhide them one release at a time.
- [ ] Watch the Monitoring page in the Platform UI for unhandled errors before submitting
      (`5.3`).

## 5. Automated checks already covered by the code

- [x] `A001` — an auth test exists (`authentication.test` calls `POST /v1/user-info`), so a
      connected account can be created from the UI.
- [x] `D001` — no operation input field carries credentials; the secret lives only in
      `authentication.fields`.
- [x] `D002` — every auth field has help text with a link to the Kirimi dashboard.
- [x] `D003` — the connection label uses the account name from `user-info`, falling back to the
      user code, never the secret.
- [x] `D004` — `device_id` fields are dynamic dropdowns backed by `POST /v1/list-devices`.
- [x] `D007` — every request goes to `https://api.kirimi.id`.
- [x] `D008` / `D011` — help texts are full sentences, longer than 20 characters, and never a copy
      of their label. `test/app.test.js` enforces both.
- [x] `D012` / `D023` / `D024` — every visible operation ships a static sample with `id`,
      `success`, and `message` (the fields the integration always returns), no date values.
- [x] `D018` — operation labels are title case. `test/app.test.js` enforces this.
- [x] `D021` — search descriptions start with `Finds ` and trigger descriptions start with
      `Triggers when `. Enforced by the same test.
- [x] `D022` — creates expose static input fields, so Zap templates can be built.
- [x] `D006` — every hook trigger implements `performList`, so a user can pull a live sample while
      setting up a Zap instead of waiting for a real message.
- [x] `D016` / `D017` — no static webhooks: every trigger has both `performSubscribe` and
      `performUnsubscribe`, so it is a real REST Hook.
- [x] `T006` — `test/triggers.test.js` asserts that every key in a polling sample also exists in the
      hook payload, so a Zap cannot map a field that later arrives empty.
- [ ] `T003` / `D023` — depends on the API sending `created_at` in ISO-8601 with an offset. Until
      then the integration converts `datetime_wib` (`+07:00`) itself; once the API ships
      `created_at`, delete the fallback in `lib/events.js`.
- [x] `D027` — the app runs on `zapier-platform-core` 19.1.0, the current release.
- [x] `D028` — `flags.cleanInputData` is `false`, so empty values are handled by the integration
      itself instead of being stripped mid-flight.
- [x] `5.5` — credentials are only collected through the authentication form.
- [x] `5.7` — all user facing copy is English.
- [x] `7.1` (code side) — nothing in the app assumes a sandbox; no test endpoints are referenced.

Run locally before every push:

```bash
npm test                                    # 70 tests, nock stubbed
npx zapier-platform validate --without-style
```

`zapier-platform validate` with the style checks enabled needs a logged-in CLI
(`zapier-platform login`, or `ZAPIER_DEPLOY_KEY` in CI) and covers the server side checks above.
Run it once before submitting:

```bash
npx zapier-platform login          # or: zapier-platform login --sso
npx zapier-platform validate
```

## 6. Submission and after

- [ ] Submit from the Platform UI: **Integration Home → Publish → Submit for Review**.
      Do not submit the same integration repeatedly (requirement `8.1`).
- [ ] Review lands within about a week. Version becomes **Pending**, status stays **Private**.
- [ ] On approval the app goes to **Beta** in the directory for 90 days. Use that window to
      publish a help article, create Zap templates, and embed Zapier where users already work.
- [ ] Beta ends early once a signup is detected from an embed; otherwise it goes public after 90
      days and the account joins the Partner Program.

## 7. Versioning rules to remember

- Versions are sequential: `1.0.0`, then `1.0.1` or `1.1.0`. No gaps, no back-filling.
- Adding operations or optional fields is a **minor** bump; removing or renaming anything, or
  changing auth, is a **major** bump and blocks promotion if done inside the same major.
- Prefer `display.hidden: true` over deleting an operation when phasing something out.
- Users can only be migrated automatically within the same major version.

## 8. Out of scope, and waiting on the backend

- **Triggers.** Implemented (`triggers/`) but hidden in v1.0.0 because they need
  `POST /v1/webhook/subscribe`, `/unsubscribe`, and `/events` on the Kirimi API. Zapier forbids
  static webhooks in public integrations (`D016`, `D017`). Contract:
  `docs/WEBHOOK-SUBSCRIPTIONS-API.md`, work in `kirimi-mono-v2` and `kirimi-webhook`. Ship as
  `1.1.0` and unhide.
- **Signature enforcement.** Subscription deliveries are verified against
  `X-Kirimi-Signature`, but the check is skipped when Zapier does not expose `bundle.rawRequest`.
  Confirm the real field on the first live hook and, if it is missing, ask Zapier support or fall
  back to a shared-secret query parameter.
- **Device lifecycle, packages, deposits.** Creating, renewing, and funding devices from a Zap
  invites accidental spend, and Zapier restricts integrations that move money (`1.4`). Add them
  later only if there is real user demand, in a minor version.
- **OTP v1 (legacy).** `v1/generate-otp` and `v1/validate-otp` stay out; users should be on
  `v2/otp/send` and `v2/otp/verify`.
