CREATE TYPE "public"."action_type" AS ENUM('view', 'create', 'update', 'delete', 'permission_grant', 'permission_revoke', 'emergency_override');--> statement-breakpoint
CREATE TYPE "public"."allergy_severity" AS ENUM('mild', 'moderate', 'severe', 'life_threatening');--> statement-breakpoint
CREATE TYPE "public"."allergy_type" AS ENUM('drug', 'food', 'environmental', 'other');--> statement-breakpoint
CREATE TYPE "public"."blood_type" AS ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."diagnosis_status" AS ENUM('provisional', 'confirmed', 'ruled_out', 'differential');--> statement-breakpoint
CREATE TYPE "public"."dosage_form" AS ENUM('tablet', 'capsule', 'syrup', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'suppository');--> statement-breakpoint
CREATE TYPE "public"."encounter_status" AS ENUM('scheduled', 'in-progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."frequency" AS ENUM('once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'every_4_hours', 'every_6_hours', 'every_8_hours', 'as_needed', 'stat');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TYPE "public"."imaging_modality" AS ENUM('x-ray', 'ct_scan', 'mri', 'ultrasound', 'pet_scan', 'mammogram', 'fluoroscopy');--> statement-breakpoint
CREATE TYPE "public"."imaging_status" AS ENUM('ordered', 'scheduled', 'in_progress', 'completed', 'reported', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."lab_test_status" AS ENUM('ordered', 'sample_collected', 'in_progress', 'completed', 'resulted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."marital_status" AS ENUM('single', 'married', 'divorced', 'widowed');--> statement-breakpoint
CREATE TYPE "public"."medication_route" AS ENUM('oral', 'intravenous', 'intramuscular', 'subcutaneous', 'topical', 'inhalation', 'rectal', 'sublingual');--> statement-breakpoint
CREATE TYPE "public"."permission_type" AS ENUM('read', 'write', 'full');--> statement-breakpoint
CREATE TYPE "public"."prescription_status" AS ENUM('prescribed', 'dispensing', 'dispensed', 'administered', 'discontinued', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."priority_level" AS ENUM('routine', 'urgent', 'emergency', 'critical');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."specimen_type" AS ENUM('blood', 'urine', 'stool', 'sputum', 'csf', 'tissue', 'swab', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_type" AS ENUM('patient', 'practitioner', 'nurse', 'lab_technician', 'radiologist', 'pharmacist', 'admin', 'receptionist');--> statement-breakpoint
CREATE TYPE "public"."visit_type" AS ENUM('outpatient', 'inpatient', 'emergency', 'consultation');--> statement-breakpoint
CREATE TABLE "access_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"granted_to_user_id" uuid NOT NULL,
	"granted_to_user_type" "user_type" NOT NULL,
	"permission_type" "permission_type" NOT NULL,
	"allowed_record_types" jsonb NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"blockchain_transaction_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_emergency_override" boolean DEFAULT false NOT NULL,
	"emergency_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"requested_by_user_type" "user_type" NOT NULL,
	"patient_id" uuid NOT NULL,
	"visit_id" uuid,
	"requested_permissions" jsonb NOT NULL,
	"reason" text NOT NULL,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"response_note" text
);
--> statement-breakpoint
CREATE TABLE "allergies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"allergen" text NOT NULL,
	"allergy_type" "allergy_type" NOT NULL,
	"severity" "allergy_severity" NOT NULL,
	"reaction" text NOT NULL,
	"onset_date" date,
	"notes" text,
	"recorded_by_practitioner_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"blockchain_hash" text NOT NULL,
	"blockchain_transaction_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_type" "user_type" NOT NULL,
	"patient_id" uuid NOT NULL,
	"action_type" "action_type" NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"blockchain_transaction_id" text NOT NULL,
	"is_emergency_override" boolean DEFAULT false NOT NULL,
	"access_reason" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_type" "user_type" NOT NULL,
	"jwt_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"two_fa_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"ip_address" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "consultations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"chief_complaint" text NOT NULL,
	"history_of_present_illness" text,
	"review_of_systems" text,
	"physical_examination" text,
	"clinical_findings" text,
	"assessment" text,
	"plan" text,
	"follow_up_instructions" text,
	"next_appointment_date" timestamp,
	"consultation_date" timestamp DEFAULT now() NOT NULL,
	"blockchain_hash" text NOT NULL,
	"blockchain_transaction_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cross_institution_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"source_institution_id" uuid NOT NULL,
	"target_institution_id" uuid NOT NULL,
	"access_type" text NOT NULL,
	"granted_by" uuid NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"reason" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"blockchain_hash" text NOT NULL,
	"blockchain_transaction_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_cross_access" UNIQUE("patient_id","source_institution_id","target_institution_id")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"department_code" text NOT NULL,
	"department_name" text NOT NULL,
	"department_type" text,
	"location" text,
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_dept_code" UNIQUE("institution_id","department_code")
);
--> statement-breakpoint
CREATE TABLE "diagnoses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"practitioner_id" uuid NOT NULL,
	"icd_code" text,
	"diagnosis_name" text NOT NULL,
	"diagnosis_type" "diagnosis_status" NOT NULL,
	"severity" text,
	"notes" text,
	"diagnosed_at" timestamp DEFAULT now() NOT NULL,
	"blockchain_hash" text NOT NULL,
	"blockchain_transaction_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emergency_access_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"accessed_by" uuid NOT NULL,
	"accessed_by_institution_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"accessed_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"blockchain_hash" text NOT NULL,
	"blockchain_transaction_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_medical_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"relationship" text NOT NULL,
	"condition" text NOT NULL,
	"age_at_diagnosis" integer,
	"is_deceased" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imaging_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"ordered_by_practitioner_id" uuid NOT NULL,
	"modality" "imaging_modality" NOT NULL,
	"body_part" text NOT NULL,
	"indication" text NOT NULL,
	"urgency" "priority_level" DEFAULT 'routine' NOT NULL,
	"status" "imaging_status" DEFAULT 'ordered' NOT NULL,
	"scheduled_date_time" timestamp,
	"ordered_at" timestamp DEFAULT now() NOT NULL,
	"assigned_to" uuid,
	"blockchain_hash" text NOT NULL,
	"blockchain_transaction_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "imaging_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "imaging_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"imaging_order_id" uuid NOT NULL,
	"performed_by_radiologist_id" uuid NOT NULL,
	"findings" text NOT NULL,
	"impression" text NOT NULL,
	"recommendations" text,
	"image_urls" jsonb NOT NULL,
	"performed_at" timestamp DEFAULT now() NOT NULL,
	"reported_at" timestamp DEFAULT now() NOT NULL,
	"blockchain_hash" text NOT NULL,
	"blockchain_transaction_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_code" text NOT NULL,
	"institution_name" text NOT NULL,
	"institution_type" text NOT NULL,
	"blockchain_address" text NOT NULL,
	"address_encrypted" text NOT NULL,
	"phone_encrypted" text NOT NULL,
	"email_encrypted" text,
	"license_number" text NOT NULL,
	"accreditation_status" text,
	"accreditation_expiry" date,
	"bed_capacity" integer,
	"specialties" jsonb,
	"services" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"admin_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "institutions_institution_code_unique" UNIQUE("institution_code"),
	CONSTRAINT "institutions_blockchain_address_unique" UNIQUE("blockchain_address"),
	CONSTRAINT "institutions_license_number_unique" UNIQUE("license_number")
);
--> statement-breakpoint
CREATE TABLE "lab_test_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"ordered_by_practitioner_id" uuid NOT NULL,
	"test_name" text NOT NULL,
	"test_code" text,
	"test_category" text,
	"specimen_type" "specimen_type" NOT NULL,
	"clinical_notes" text,
	"urgency" "priority_level" DEFAULT 'routine' NOT NULL,
	"status" "lab_test_status" DEFAULT 'ordered' NOT NULL,
	"ordered_at" timestamp DEFAULT now() NOT NULL,
	"sample_collected_at" timestamp,
	"collected_by_nurse_id" uuid,
	"assigned_to" uuid,
	"blockchain_hash" text NOT NULL,
	"blockchain_transaction_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lab_test_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "lab_test_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lab_test_order_id" uuid NOT NULL,
	"performed_by_lab_tech_id" uuid NOT NULL,
	"results_data" jsonb NOT NULL,
	"interpretation" text,
	"abnormal_findings" text,
	"reference_ranges" jsonb,
	"attachment_urls" jsonb,
	"resulted_at" timestamp DEFAULT now() NOT NULL,
	"verified_at" timestamp,
	"blockchain_hash" text NOT NULL,
	"blockchain_transaction_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"condition" text NOT NULL,
	"diagnosed_date" date,
	"status" text NOT NULL,
	"notes" text,
	"recorded_by_practitioner_id" uuid,
	"blockchain_hash" text NOT NULL,
	"blockchain_transaction_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medication_administration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prescription_item_id" uuid NOT NULL,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"administered_by_nurse_id" uuid NOT NULL,
	"dose_given" text NOT NULL,
	"route" "medication_route" NOT NULL,
	"scheduled_time" timestamp NOT NULL,
	"administered_time" timestamp NOT NULL,
	"notes" text,
	"adverse_reaction" text,
	"blockchain_hash" text NOT NULL,
	"blockchain_transaction_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_institution_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"institution_id" uuid NOT NULL,
	"hospital_patient_number" text NOT NULL,
	"registered_at" timestamp DEFAULT now() NOT NULL,
	"last_visit_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_home_institution" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_patient_institution" UNIQUE("patient_id","institution_id"),
	CONSTRAINT "unique_institution_number" UNIQUE("institution_id","hospital_patient_number")
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blockchain_address" text NOT NULL,
	"first_name_encrypted" text NOT NULL,
	"last_name_encrypted" text NOT NULL,
	"middle_name_encrypted" text,
	"date_of_birth_encrypted" text NOT NULL,
	"gender" "gender" NOT NULL,
	"blood_type" "blood_type" DEFAULT 'unknown',
	"phone_number_encrypted" text NOT NULL,
	"email_encrypted" text,
	"address_encrypted" text NOT NULL,
	"emergency_contact_encrypted" text NOT NULL,
	"national_id_encrypted" text NOT NULL,
	"marital_status" "marital_status",
	"occupation" text,
	"password_hash" text NOT NULL,
	"profile_photo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_deceased" boolean DEFAULT false NOT NULL,
	"deceased_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "patients_blockchain_address_unique" UNIQUE("blockchain_address"),
	CONSTRAINT "patients_national_id_encrypted_unique" UNIQUE("national_id_encrypted")
);
--> statement-breakpoint
CREATE TABLE "practitioners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blockchain_address" text NOT NULL,
	"institution_id" uuid,
	"first_name_encrypted" text NOT NULL,
	"last_name_encrypted" text NOT NULL,
	"license_number" text NOT NULL,
	"institutional_id" text NOT NULL,
	"specialization" text,
	"department" text,
	"shift" text,
	"phone_number_encrypted" text NOT NULL,
	"email_encrypted" text NOT NULL,
	"credentials_encrypted" text,
	"qualifications" text,
	"role" "user_type" NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "practitioners_blockchain_address_unique" UNIQUE("blockchain_address"),
	CONSTRAINT "practitioners_license_number_unique" UNIQUE("license_number")
);
--> statement-breakpoint
CREATE TABLE "prescription_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prescription_id" uuid NOT NULL,
	"medication_name" text NOT NULL,
	"generic_name" text,
	"strength" text NOT NULL,
	"dosage_form" "dosage_form" NOT NULL,
	"dose" text NOT NULL,
	"frequency" "frequency" NOT NULL,
	"route" "medication_route" NOT NULL,
	"duration" text NOT NULL,
	"quantity" integer NOT NULL,
	"refills_allowed" integer DEFAULT 0,
	"instructions" text,
	"is_dispensed" boolean DEFAULT false NOT NULL,
	"dispensed_by_pharmacist_id" uuid,
	"dispensed_at" timestamp,
	"dispensed_quantity" integer,
	"blockchain_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prescription_number" text NOT NULL,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"prescribed_by_practitioner_id" uuid NOT NULL,
	"status" "prescription_status" DEFAULT 'prescribed' NOT NULL,
	"prescribed_at" timestamp DEFAULT now() NOT NULL,
	"blockchain_hash" text NOT NULL,
	"blockchain_transaction_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "prescriptions_prescription_number_unique" UNIQUE("prescription_number")
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_number" text NOT NULL,
	"patient_id" uuid NOT NULL,
	"visit_id" uuid,
	"referring_institution_id" uuid NOT NULL,
	"referring_practitioner_id" uuid NOT NULL,
	"receiving_institution_id" uuid NOT NULL,
	"receiving_department_id" uuid,
	"receiving_practitioner_id" uuid,
	"reason" text NOT NULL,
	"clinical_summary" text NOT NULL,
	"urgency" "priority_level" DEFAULT 'routine' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"referred_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"completed_at" timestamp,
	"response_notes" text,
	"blockchain_hash" text NOT NULL,
	"blockchain_transaction_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_referral_number_unique" UNIQUE("referral_number")
);
--> statement-breakpoint
CREATE TABLE "two_fa_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_type" "user_type" NOT NULL,
	"secret_encrypted" text NOT NULL,
	"backup_codes_encrypted" text NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"institution_id" uuid,
	"department_id" uuid,
	"ward_id" uuid,
	"visit_number" text NOT NULL,
	"visit_type" "visit_type" NOT NULL,
	"admission_date" timestamp NOT NULL,
	"discharge_date" timestamp,
	"chief_complaint" text,
	"admitting_diagnosis" text,
	"discharge_diagnosis" text,
	"ward_or_room" text,
	"bed_number" text,
	"status" "encounter_status" DEFAULT 'in-progress' NOT NULL,
	"priority" "priority_level" DEFAULT 'routine' NOT NULL,
	"discharge_summary" text,
	"discharge_instructions" text,
	"follow_up_date" timestamp,
	"blockchain_hash" text NOT NULL,
	"discharge_blockchain_hash" text,
	"assigned_nurse_id" uuid,
	"assigned_doctor_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "visits_visit_number_unique" UNIQUE("visit_number")
);
--> statement-breakpoint
CREATE TABLE "vital_signs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"recorded_by_nurse_id" uuid NOT NULL,
	"temperature" numeric(4, 1),
	"blood_pressure_systolic" integer,
	"blood_pressure_diastolic" integer,
	"pulse_rate" integer,
	"respiratory_rate" integer,
	"oxygen_saturation" integer,
	"weight" numeric(5, 2),
	"height" numeric(5, 2),
	"bmi" numeric(4, 1),
	"pain_level" integer,
	"nurse_notes" text,
	"blockchain_hash" text NOT NULL,
	"blockchain_transaction_id" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"institution_id" uuid NOT NULL,
	"ward_code" text NOT NULL,
	"ward_name" text NOT NULL,
	"ward_type" text,
	"bed_count" integer NOT NULL,
	"available_beds" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_ward_code" UNIQUE("institution_id","ward_code")
);
--> statement-breakpoint
ALTER TABLE "access_permissions" ADD CONSTRAINT "access_permissions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_recorded_by_practitioner_id_practitioners_id_fk" FOREIGN KEY ("recorded_by_practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_practitioner_id_practitioners_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_institution_access" ADD CONSTRAINT "cross_institution_access_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_institution_access" ADD CONSTRAINT "cross_institution_access_source_institution_id_institutions_id_fk" FOREIGN KEY ("source_institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_institution_access" ADD CONSTRAINT "cross_institution_access_target_institution_id_institutions_id_fk" FOREIGN KEY ("target_institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_practitioner_id_practitioners_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_access_logs" ADD CONSTRAINT "emergency_access_logs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_access_logs" ADD CONSTRAINT "emergency_access_logs_accessed_by_institution_id_institutions_id_fk" FOREIGN KEY ("accessed_by_institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_medical_history" ADD CONSTRAINT "family_medical_history_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_orders" ADD CONSTRAINT "imaging_orders_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_orders" ADD CONSTRAINT "imaging_orders_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_orders" ADD CONSTRAINT "imaging_orders_ordered_by_practitioner_id_practitioners_id_fk" FOREIGN KEY ("ordered_by_practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_orders" ADD CONSTRAINT "imaging_orders_assigned_to_practitioners_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_reports" ADD CONSTRAINT "imaging_reports_imaging_order_id_imaging_orders_id_fk" FOREIGN KEY ("imaging_order_id") REFERENCES "public"."imaging_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_reports" ADD CONSTRAINT "imaging_reports_performed_by_radiologist_id_practitioners_id_fk" FOREIGN KEY ("performed_by_radiologist_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_test_orders" ADD CONSTRAINT "lab_test_orders_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_test_orders" ADD CONSTRAINT "lab_test_orders_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_test_orders" ADD CONSTRAINT "lab_test_orders_ordered_by_practitioner_id_practitioners_id_fk" FOREIGN KEY ("ordered_by_practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_test_orders" ADD CONSTRAINT "lab_test_orders_collected_by_nurse_id_practitioners_id_fk" FOREIGN KEY ("collected_by_nurse_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_test_orders" ADD CONSTRAINT "lab_test_orders_assigned_to_practitioners_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_test_results" ADD CONSTRAINT "lab_test_results_lab_test_order_id_lab_test_orders_id_fk" FOREIGN KEY ("lab_test_order_id") REFERENCES "public"."lab_test_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_test_results" ADD CONSTRAINT "lab_test_results_performed_by_lab_tech_id_practitioners_id_fk" FOREIGN KEY ("performed_by_lab_tech_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_history" ADD CONSTRAINT "medical_history_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_history" ADD CONSTRAINT "medical_history_recorded_by_practitioner_id_practitioners_id_fk" FOREIGN KEY ("recorded_by_practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_administration" ADD CONSTRAINT "medication_administration_prescription_item_id_prescription_items_id_fk" FOREIGN KEY ("prescription_item_id") REFERENCES "public"."prescription_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_administration" ADD CONSTRAINT "medication_administration_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_administration" ADD CONSTRAINT "medication_administration_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_administration" ADD CONSTRAINT "medication_administration_administered_by_nurse_id_practitioners_id_fk" FOREIGN KEY ("administered_by_nurse_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_institution_registrations" ADD CONSTRAINT "patient_institution_registrations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_institution_registrations" ADD CONSTRAINT "patient_institution_registrations_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practitioners" ADD CONSTRAINT "practitioners_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_prescriptions_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_dispensed_by_pharmacist_id_practitioners_id_fk" FOREIGN KEY ("dispensed_by_pharmacist_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_prescribed_by_practitioner_id_practitioners_id_fk" FOREIGN KEY ("prescribed_by_practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referring_institution_id_institutions_id_fk" FOREIGN KEY ("referring_institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referring_practitioner_id_practitioners_id_fk" FOREIGN KEY ("referring_practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_receiving_institution_id_institutions_id_fk" FOREIGN KEY ("receiving_institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_receiving_department_id_departments_id_fk" FOREIGN KEY ("receiving_department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_receiving_practitioner_id_practitioners_id_fk" FOREIGN KEY ("receiving_practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_assigned_nurse_id_practitioners_id_fk" FOREIGN KEY ("assigned_nurse_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_assigned_doctor_id_practitioners_id_fk" FOREIGN KEY ("assigned_doctor_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_recorded_by_nurse_id_practitioners_id_fk" FOREIGN KEY ("recorded_by_nurse_id") REFERENCES "public"."practitioners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wards" ADD CONSTRAINT "wards_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wards" ADD CONSTRAINT "wards_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_access_permissions_patient_id" ON "access_permissions" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_access_permissions_granted_to" ON "access_permissions" USING btree ("granted_to_user_id");--> statement-breakpoint
CREATE INDEX "idx_access_permissions_expires_at" ON "access_permissions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_access_permissions_is_active" ON "access_permissions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_access_requests_patient_id" ON "access_requests" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_access_requests_requested_by" ON "access_requests" USING btree ("requested_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_access_requests_status" ON "access_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_access_requests_visit_id" ON "access_requests" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "idx_allergies_patient_id" ON "allergies" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_allergies_is_active" ON "allergies" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_patient_id" ON "audit_logs" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_timestamp" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action_type" ON "audit_logs" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "idx_auth_sessions_user_id" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_auth_sessions_is_active" ON "auth_sessions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_auth_sessions_jwt_token" ON "auth_sessions" USING btree ("jwt_token");--> statement-breakpoint
CREATE INDEX "idx_consultations_visit_id" ON "consultations" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "idx_consultations_patient_id" ON "consultations" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_consultations_practitioner_id" ON "consultations" USING btree ("practitioner_id");--> statement-breakpoint
CREATE INDEX "idx_consultations_consultation_date" ON "consultations" USING btree ("consultation_date");--> statement-breakpoint
CREATE INDEX "idx_cross_access_patient" ON "cross_institution_access" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_cross_access_source" ON "cross_institution_access" USING btree ("source_institution_id");--> statement-breakpoint
CREATE INDEX "idx_cross_access_target" ON "cross_institution_access" USING btree ("target_institution_id");--> statement-breakpoint
CREATE INDEX "idx_cross_access_status" ON "cross_institution_access" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_departments_institution_id" ON "departments" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "idx_diagnoses_consultation_id" ON "diagnoses" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "idx_diagnoses_visit_id" ON "diagnoses" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "idx_diagnoses_patient_id" ON "diagnoses" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_emergency_patient" ON "emergency_access_logs" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_emergency_accessed_by" ON "emergency_access_logs" USING btree ("accessed_by");--> statement-breakpoint
CREATE INDEX "idx_family_medical_history_patient_id" ON "family_medical_history" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_imaging_orders_order_number" ON "imaging_orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "idx_imaging_orders_visit_id" ON "imaging_orders" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "idx_imaging_orders_patient_id" ON "imaging_orders" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_imaging_orders_status" ON "imaging_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_imaging_reports_order_id" ON "imaging_reports" USING btree ("imaging_order_id");--> statement-breakpoint
CREATE INDEX "idx_institutions_code" ON "institutions" USING btree ("institution_code");--> statement-breakpoint
CREATE INDEX "idx_institutions_blockchain_address" ON "institutions" USING btree ("blockchain_address");--> statement-breakpoint
CREATE INDEX "idx_institutions_is_active" ON "institutions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_lab_test_orders_order_number" ON "lab_test_orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "idx_lab_test_orders_visit_id" ON "lab_test_orders" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "idx_lab_test_orders_patient_id" ON "lab_test_orders" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_lab_test_orders_status" ON "lab_test_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_lab_test_results_order_id" ON "lab_test_results" USING btree ("lab_test_order_id");--> statement-breakpoint
CREATE INDEX "idx_medical_history_patient_id" ON "medical_history" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_medication_administration_visit_id" ON "medication_administration" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "idx_medication_administration_patient_id" ON "medication_administration" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_patient_inst_reg_patient_id" ON "patient_institution_registrations" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_patient_inst_reg_institution_id" ON "patient_institution_registrations" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "idx_patient_inst_reg_hospital_number" ON "patient_institution_registrations" USING btree ("hospital_patient_number");--> statement-breakpoint
CREATE INDEX "idx_patient_inst_reg_is_home" ON "patient_institution_registrations" USING btree ("patient_id","is_home_institution");--> statement-breakpoint
CREATE INDEX "idx_patients_blockchain_address" ON "patients" USING btree ("blockchain_address");--> statement-breakpoint
CREATE INDEX "idx_patients_national_id" ON "patients" USING btree ("national_id_encrypted");--> statement-breakpoint
CREATE INDEX "idx_patients_is_active" ON "patients" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_practitioners_blockchain_address" ON "practitioners" USING btree ("blockchain_address");--> statement-breakpoint
CREATE INDEX "idx_practitioners_license_number" ON "practitioners" USING btree ("license_number");--> statement-breakpoint
CREATE INDEX "idx_practitioners_institution_id" ON "practitioners" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "idx_practitioners_department" ON "practitioners" USING btree ("department");--> statement-breakpoint
CREATE INDEX "idx_practitioners_is_active" ON "practitioners" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_practitioners_role" ON "practitioners" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_prescription_items_prescription_id" ON "prescription_items" USING btree ("prescription_id");--> statement-breakpoint
CREATE INDEX "idx_prescription_items_is_dispensed" ON "prescription_items" USING btree ("is_dispensed");--> statement-breakpoint
CREATE INDEX "idx_prescriptions_number" ON "prescriptions" USING btree ("prescription_number");--> statement-breakpoint
CREATE INDEX "idx_prescriptions_visit_id" ON "prescriptions" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "idx_prescriptions_patient_id" ON "prescriptions" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_prescriptions_status" ON "prescriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_referrals_patient_id" ON "referrals" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_referrals_referring_inst" ON "referrals" USING btree ("referring_institution_id");--> statement-breakpoint
CREATE INDEX "idx_referrals_receiving_inst" ON "referrals" USING btree ("receiving_institution_id");--> statement-breakpoint
CREATE INDEX "idx_referrals_status" ON "referrals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_two_fa_secrets_user_id" ON "two_fa_secrets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_visits_patient_id" ON "visits" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_visits_institution_id" ON "visits" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "idx_visits_visit_number" ON "visits" USING btree ("visit_number");--> statement-breakpoint
CREATE INDEX "idx_visits_status" ON "visits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_visits_admission_date" ON "visits" USING btree ("admission_date");--> statement-breakpoint
CREATE INDEX "idx_visits_assigned_nurse" ON "visits" USING btree ("assigned_nurse_id");--> statement-breakpoint
CREATE INDEX "idx_visits_assigned_doctor" ON "visits" USING btree ("assigned_doctor_id");--> statement-breakpoint
CREATE INDEX "idx_vital_signs_visit_id" ON "vital_signs" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "idx_vital_signs_patient_id" ON "vital_signs" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_vital_signs_recorded_at" ON "vital_signs" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "idx_wards_department_id" ON "wards" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "idx_wards_institution_id" ON "wards" USING btree ("institution_id");