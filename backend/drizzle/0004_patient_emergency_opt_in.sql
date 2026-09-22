ALTER TABLE "patients" ADD COLUMN "emergency_override_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Legacy overrides were not patient-approved. Do not resurrect them on opt-in.
UPDATE "cross_institution_access" SET "status" = 'revoked', "updated_at" = now()
WHERE "access_type" = 'emergency' AND "status" = 'active';
