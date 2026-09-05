-- Adds device_tokens: Expo push tokens per device, so the backend can reach a
-- patient's phone when the app is closed (see services/notifications.ts).
--
-- NOTE ON SCOPE. drizzle-kit generated this file against an empty migration
-- history and therefore also emitted CREATE TABLE for patient_guardians,
-- patient_sensitive_records and ward_beds, plus the patients.is_minor /
-- temporary_patient_id / must_change_password columns. All of those already
-- exist in the live database — they were applied with `drizzle-kit push`, which
-- never wrote a __drizzle_migrations table — so running them would fail on
-- "relation already exists". They have been removed; only the genuinely new
-- table remains. The full generated output is kept in the session scratchpad.

CREATE TABLE IF NOT EXISTS "device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_type" "user_type" NOT NULL,
	"token" text NOT NULL,
	"platform" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "device_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_device_tokens_user_id" ON "device_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_device_tokens_token" ON "device_tokens" USING btree ("token");
