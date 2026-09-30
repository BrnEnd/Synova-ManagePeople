ALTER TYPE "public"."document_type" ADD VALUE 'voter_registration' BEFORE 'contract';--> statement-breakpoint
ALTER TYPE "public"."document_type" ADD VALUE 'dependent_certificate' BEFORE 'contract';--> statement-breakpoint
ALTER TYPE "public"."document_type" ADD VALUE 'military_certificate' BEFORE 'contract';--> statement-breakpoint
ALTER TYPE "public"."document_type" ADD VALUE 'marriage_certificate' BEFORE 'contract';--> statement-breakpoint
ALTER TYPE "public"."document_type" ADD VALUE 'medical_admission' BEFORE 'contract';--> statement-breakpoint
ALTER TYPE "public"."document_type" ADD VALUE 'work_card' BEFORE 'contract';--> statement-breakpoint
ALTER TYPE "public"."document_type" ADD VALUE 'photo' BEFORE 'contract';--> statement-breakpoint
ALTER TYPE "public"."document_type" ADD VALUE 'pis_proof' BEFORE 'contract';--> statement-breakpoint
ALTER TYPE "public"."document_type" ADD VALUE 'cnpj_card' BEFORE 'contract';--> statement-breakpoint
CREATE TABLE "document_onboarding_files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_onboarding_files_version_check" CHECK ("document_onboarding_files"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "document_onboarding_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_onboarding_items_status_check" CHECK ("document_onboarding_items"."status" in ('pending', 'uploaded', 'approved', 'rejected', 'not_applicable'))
);
--> statement-breakpoint
CREATE TABLE "document_onboarding_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"employment_type" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"has_uploads" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_onboarding_requests_employment_type_check" CHECK ("document_onboarding_requests"."employment_type" in ('clt', 'pj')),
	CONSTRAINT "document_onboarding_requests_status_check" CHECK ("document_onboarding_requests"."status" in ('in_progress', 'submitted', 'changes_requested', 'approved', 'expired', 'cancelled')),
	CONSTRAINT "document_onboarding_requests_revision_check" CHECK ("document_onboarding_requests"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "race_color" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "documentation_mode" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "documentation_status" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "employee_id" uuid;--> statement-breakpoint
ALTER TABLE "document_onboarding_files" ADD CONSTRAINT "document_onboarding_files_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_onboarding_files" ADD CONSTRAINT "document_onboarding_files_request_fk" FOREIGN KEY ("tenant_id","request_id") REFERENCES "public"."document_onboarding_requests"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_onboarding_files" ADD CONSTRAINT "document_onboarding_files_item_fk" FOREIGN KEY ("tenant_id","item_id") REFERENCES "public"."document_onboarding_items"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_onboarding_files" ADD CONSTRAINT "document_onboarding_files_document_fk" FOREIGN KEY ("tenant_id","document_id") REFERENCES "public"."documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_onboarding_items" ADD CONSTRAINT "document_onboarding_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_onboarding_items" ADD CONSTRAINT "document_onboarding_items_request_fk" FOREIGN KEY ("tenant_id","request_id") REFERENCES "public"."document_onboarding_requests"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_onboarding_items" ADD CONSTRAINT "document_onboarding_items_reviewer_fk" FOREIGN KEY ("tenant_id","reviewed_by_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_onboarding_requests" ADD CONSTRAINT "document_onboarding_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_onboarding_requests" ADD CONSTRAINT "document_onboarding_requests_employee_fk" FOREIGN KEY ("tenant_id","employee_id") REFERENCES "public"."employees"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_onboarding_requests" ADD CONSTRAINT "document_onboarding_requests_creator_fk" FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_onboarding_files_tenant_id_unique" ON "document_onboarding_files" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_onboarding_files_document_unique" ON "document_onboarding_files" USING btree ("tenant_id","document_id");--> statement-breakpoint
CREATE INDEX "document_onboarding_files_item_version_idx" ON "document_onboarding_files" USING btree ("tenant_id","item_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "document_onboarding_items_tenant_id_unique" ON "document_onboarding_items" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_onboarding_items_request_key_unique" ON "document_onboarding_items" USING btree ("tenant_id","request_id","key");--> statement-breakpoint
CREATE INDEX "document_onboarding_items_request_position_idx" ON "document_onboarding_items" USING btree ("tenant_id","request_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "document_onboarding_requests_tenant_id_unique" ON "document_onboarding_requests" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_onboarding_requests_employee_unique" ON "document_onboarding_requests" USING btree ("tenant_id","employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_onboarding_requests_token_hash_unique" ON "document_onboarding_requests" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "document_onboarding_requests_status_expiry_idx" ON "document_onboarding_requests" USING btree ("tenant_id","status","expires_at");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_employee_fk" FOREIGN KEY ("tenant_id","employee_id") REFERENCES "public"."employees"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_documentation_mode_check" CHECK ("employees"."documentation_mode" in ('legacy', 'self_service'));--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_documentation_status_check" CHECK ("employees"."documentation_status" in ('legacy', 'in_progress', 'submitted', 'changes_requested', 'approved', 'expired', 'cancelled'));--> statement-breakpoint
ALTER TABLE "document_onboarding_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_onboarding_requests" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "document_onboarding_requests_tenant_isolation" ON "document_onboarding_requests"
	USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "document_onboarding_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_onboarding_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "document_onboarding_items_tenant_isolation" ON "document_onboarding_items"
	USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "document_onboarding_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_onboarding_files" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "document_onboarding_files_tenant_isolation" ON "document_onboarding_files"
	USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'synova_app_prod') THEN
		GRANT SELECT, INSERT, UPDATE, DELETE ON
			"document_onboarding_requests",
			"document_onboarding_items",
			"document_onboarding_files"
		TO synova_app_prod;
	END IF;
END
$$;
