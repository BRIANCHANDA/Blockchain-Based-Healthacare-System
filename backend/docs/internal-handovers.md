# Internal doctor handovers

`POST /api/appointments/handovers` transfers the existing active visit to another active, verified doctor at the same hospital. It does not create an appointment, discharge the patient, overwrite the diagnosis, or duplicate clinical records.

The request contains `visitId`, `patientId`, `doctorId`, `reason`, and `priority`. Only the currently assigned doctor can submit it; self-referral is rejected. The assignment update and an `internal_handover` audit entry commit together. Audit metadata stores the receiving doctor and reason; the audit user is the referring doctor. No schema migration is needed.

`GET /api/appointments/handovers` returns the calling doctor's incoming/outgoing history, scoped to their current hospital (up to 200 latest matching audit events, deduplicated per visit per direction). An incoming visit handed onward to another doctor is no longer returned as assigned to the earlier receiver. Legacy scheduled referrals remain available through the existing appointments workflow; they are not automatically converted.

## Write protection

The server locks the visit row while authorizing and executing consultation, diagnosis, vitals, lab ordering, imaging ordering, prescribing, admission, discharge, and encounter-linked referral/appointment writes. Doctor writes require the assigned doctor, a matching non-null institution, and an active visit. Nursing vitals, radiology reporting and dispensing workflows are not converted into doctor-only actions.

Handlers protected by `clinicalWriteGuard` must use `clinicalDb(c)` for their database operations. This keeps ownership checks and writes in the same transaction and prevents a form opened before handover from writing after ownership changes. Notifications for the handover run only after commit. Failed transfers leave ownership unchanged. Historical records remain readable subject to existing access permissions.

The doctor UI consumes `visit.canEditClinical` rather than treating a transferred visit as completed. New handovers lock the sending screen immediately, then refresh the summary. The receiving doctor sees the same visit ID in their queue and internal-referrals list. Real-time notification delivery uses the existing connected-session mechanism; an offline doctor can retrieve the handover from their queue/history later.

## Verification

Unit tests in `tests/visit-ownership.test.ts` cover ownership, post-handover write rejection, institution/status boundaries, mismatched patients, rollback and post-commit notification ordering using a mocked transaction adapter. They do not prove PostgreSQL locking behavior end to end.

Before production rollout, test with two doctors at one hospital and another at a different hospital:

1. Open the same active visit in two sessions; keep a consultation draft open for the sender.
2. Hand over to the same-hospital receiver. Confirm the visit ID, notes, diagnoses, orders and results are unchanged.
3. Confirm the sender becomes read-only and a direct/stale consultation request is rejected. Confirm the receiver can write and sees the notification/queue entry without manually refreshing.
4. Attempt self-handover, a different-hospital receiver, an inactive/unverified receiver and a repeated handover from the former owner; all must fail.
5. Race a clinical save with handover. The save must either commit before handover or be rejected afterward, never succeed under stale ownership.
6. Simulate an audit-insert failure and verify that assignment remains unchanged and no handover notification is sent.
7. Book a normal future appointment and confirm that it does not transfer the current visit.

The online database was not modified during implementation. Real-database/two-browser verification is still required.
