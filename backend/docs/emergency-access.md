# Patient-controlled emergency access

Apply migration `0004_patient_emergency_opt_in.sql` before deploying this backend.
All patients default to OFF, including existing accounts. The migration does not
enable anyone automatically. Existing active emergency grants are revoked so
opting in later cannot revive a legacy override. Ordinary grants are untouched.
It has not been applied to the online database.

Patients can change their own preference in the mobile Profile screen. The
authenticated patient-only GET/PATCH `/api/patients/me/emergency-access` endpoint
ignores acting-as-patient headers; this does not enable guardian-managed opt-in.
PATCH accepts only `{ "enabled": true|false }`.

Doctor history exposes the Emergency button only when the preference is true.
Both emergency endpoints enforce this through shared services. Patient row locks
serialize emergency grants against disabling the preference. Disabling revokes
active emergency grants, while preserving ordinary consent, referrals, home
access and audit history. Re-enabling does not restore revoked grants.

Record-reading queries also require the current opt-in for emergency grants.
Emergency audit logs are not independent access permissions.

Verify against a disposable database: default-off rejects both emergency POSTs;
patient opt-in permits a reasoned, time-limited grant; opt-out blocks that grant
immediately; re-enabling requires a new override. Confirm staff cannot change the
preference and normal consent/home access still work. Never run verification
scripts against the live patient database.
