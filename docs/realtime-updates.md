# Dashboard updates and notifications

The web dashboard uses one authenticated SSE connection per open dashboard tab.
The notification bell and popups consume the same in-memory inbox, so read and
dismiss actions stay in sync. Clicking a notification marks that item read;
closing its popup does not discard it from the bell. Logout/account changes clear
the inbox. Normal popups dismiss after 12 seconds; critical alerts require action.

Supported alerts:

- Nurse/doctor assignment, including appointment arrival and referral conversion.
- Internal referrals addressed to a doctor.
- External referrals: the receiving doctor (or eligible doctors when unspecified)
  plus active, verified reception/admin staff at the destination hospital.
- Lab results, imaging reports, and inpatient admission alerts for nurses.

Successful authenticated record mutations emit a `data_changed` event to staff
connected at the acting hospital. These events contain no patient identifiers or
clinical data. External referral creation also invalidates the receiving hospital.
The client re-fetches through the existing permission-checked APIs; SSE does not
bypass those permissions. Connections are cleaned up on disconnect and their
session/institution is rechecked every 25 seconds.

`useLiveRefresh` keeps queues, overview counts, referrals, patient lists/history,
ward/bed lists, dispensing, reports and the doctor's open visit current. It also
refreshes on reconnect, returning to a visible tab, window focus and network
recovery, with a 30-second fallback while visible. In-flight refreshes coalesce.
Edits are not implemented with `location.reload()` or component remounts: refresh
callbacks update server-owned read data, not clinical drafts. Editable registration
and triage details defer their background refresh while in edit mode.

## Current limits

- The inbox is live-only, capped at 50 items, and is not persisted. Alerts sent
  while disconnected/logged out are not replayed. Reconnect refreshes current
  queues and lists, but does not reconstruct missed notifications.
- SSE fan-out is in-process. Multiple API processes need shared pub/sub for
  immediate cross-process events; the 30-second polling fallback still updates
  visible data. This change does not add a database migration or a message broker.
- Reverse proxies must allow long-running SSE requests without response buffering.
  The route supplies `X-Accel-Buffering: no` and a heartbeat. Serve over HTTPS and
  redact the SSE `token` query parameter from proxy/access logs.
- This covers the web staff dashboards, not mobile patient-screen subscriptions.

## Verification

From `web`:

```sh
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --test --test-isolation=none tests/live-updates.test.cjs
```

From `backend`:

```sh
node --test --test-isolation=none tests/realtime.test.mjs
```

Manual integration check (requires the running API/database and hospital accounts):
open reception and doctor/nurse dashboards in separate browser sessions; create
and assign a visit, check in an appointment, send an internal/external referral,
submit lab/imaging results, and dispense a prescription. Check that the correct
recipient sees the alert and relevant lists change without a browser refresh.
Keep an unsaved clinical draft open during these actions and verify it remains.
Use a different hospital account to confirm isolation. Disconnect/reconnect the
network and verify current queues recover, then log out to verify inbox cleanup.

AI discharge/diagnostic draft generation has been removed from the active
discharge form, and `/api/ai` is no longer mounted. Clinician-entered diagnosis,
summary and instructions remain required; saved summaries remain readable.
