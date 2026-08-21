CREATE TYPE "public"."document_origin" AS ENUM('manager', 'employee', 'integration', 'generated');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('identification', 'address_proof', 'contract', 'payment_forecast', 'invoice', 'payment_receipt', 'other');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"type" "document_type" NOT NULL,
	"origin" "document_origin" NOT NULL,
	"original_name" text NOT NULL,
	"pathname" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"uploaded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "employee_notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "corporate_email" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "address" jsonb;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "entry_date" date;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "professional_title" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "employment_type" text DEFAULT 'pj' NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "missing_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_employee_fk" FOREIGN KEY ("tenant_id","employee_id") REFERENCES "public"."employees"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_notes" ADD CONSTRAINT "employee_notes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_notes" ADD CONSTRAINT "employee_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_notes" ADD CONSTRAINT "employee_notes_tenant_employee_fk" FOREIGN KEY ("tenant_id","employee_id") REFERENCES "public"."employees"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_pathname_unique" ON "documents" USING btree ("pathname");--> statement-breakpoint
CREATE INDEX "documents_tenant_employee_created_idx" ON "documents" USING btree ("tenant_id","employee_id","created_at");--> statement-breakpoint
CREATE INDEX "employee_notes_tenant_employee_created_idx" ON "employee_notes" USING btree ("tenant_id","employee_id","created_at");
--> statement-breakpoint
UPDATE "employees"
SET "missing_fields" = jsonb_build_array(
	'phone',
	'corporateEmail',
	'address',
	'entryDate',
	'professionalTitle',
	'identificationDocumentFile'
)
	|| CASE WHEN "email" IS NULL THEN jsonb_build_array('personalEmail') ELSE '[]'::jsonb END
	|| CASE WHEN "document" IS NULL THEN jsonb_build_array('identificationDocument') ELSE '[]'::jsonb END,
	"onboarding_pending" = true
WHERE "status" <> 'inactive';
--> statement-breakpoint
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "documents" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "documents_tenant_isolation" ON "documents"
	USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "employee_notes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "employee_notes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "employee_notes_tenant_isolation" ON "employee_notes"
	USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
