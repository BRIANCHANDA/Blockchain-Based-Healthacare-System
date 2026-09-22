# Mobile improvements and follow-up review

## Implemented

- Expired authenticated requests clear the UI session as well as stored credentials and dependent context. Late 401 responses from a previous login cannot remove a newer session.
- A fresh login or app restart starts in **Self** context; dependent selection is not silently restored without a patient name.
- Records and access requests refresh on screen focus, app foreground, and received/tapped notifications. Only the latest response for the current session/patient can update the screen.
- Refresh failures preserve previously loaded data and show an error. Failed initial loads no longer display a reassuring empty state. Access requests include an explicit Retry button.
- A delayed refresh cannot restore a consent request after a successful approval/rejection. Custom consent duration must be a whole number of hours.
- Notification taps target the requests screen, including when the Access tab was displaying another screen. Cold-start responses are checked after session hydration.
- Profile and return-to-self controls have screen-reader labels. The central appointment button repositions when window dimensions change.

## Flagged for the next UI/UX pass (not implemented)

| Priority | Area | Finding / proposed change |
| --- | --- | --- |
| High | `src/screens/access/WhoHasAccessScreen.tsx` | Fetch failures currently replace permissions with an empty list, and loading is mount-based. Apply the same explicit error/retry and focus-refresh pattern so an outage cannot imply nobody has access. |
| High | `src/screens/appointments/Appointmentsscreen.tsx`, `src/screens/referrals/ReferralsScreen.tsx` | Both still clear lists on fetch errors and primarily load on mount. Extend guarded automatic refresh and distinguish unavailable data from genuinely empty lists. |
| High | Patient context | Records shows the selected dependent, but other tabs need an equally prominent, consistent “Viewing for …” indicator. Review which operations are guardian-wide versus dependent-specific before extending switching across the app. |
| Medium | `src/navigation/MainNavigator.tsx` | The central unlabeled plus opens the appointment list, while its accessibility label says “Book Appointment”. Add a visible Appointments label and align the spoken label with the destination. |
| Medium | Notifications | Add a notification-status/settings entry with guidance when permission is denied, and define the unread/badge lifecycle. Opening the app alone no longer clears the badge, but a complete read-count synchronization flow is still needed. |
| Medium | Records refresh | Preserve the patient switcher/header during initial loading; add an inline retry button like the consent inbox instead of relying only on pull-to-refresh. |
| Medium | Accessibility | Audit remaining icon-only actions, dynamic text sizing, contrast, and touch targets on a physical device with TalkBack/VoiceOver. The labels added here are not a complete accessibility audit. |

These changes do not provide a live connection for every mobile screen: the two updated lists refresh on the events above, and updates without a push still need focus, foreground, or pull-to-refresh.

## Verification

- Typecheck: `node node_modules/typescript/bin/tsc --noEmit --incremental false`
- Regression tests: `node --test --test-isolation=none tests/session-resource.test.cjs`
- Tests use mocked storage, navigation lifecycle, and notification events; they do not contact a database or push service.
- Still requires a development-build device check: slow-network patient switching, expired-session routing, foreground/background/cold-start push taps, offline retry, rotation, and screen-reader navigation. Native push delivery has not been verified by these unit tests.
