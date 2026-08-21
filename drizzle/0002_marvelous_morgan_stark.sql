CREATE TYPE "public"."employee_status" AS ENUM('pre_registration', 'active', 'inactive');--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"full_name" text NOT NULL,
	"email" text,
	"document" text,
	"status" "employee_status" DEFAULT 'pre_registration' NOT NULL,
	"onboarding_pending" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"inactivated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "employees_tenant_user_unique" ON "employees" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "employees_tenant_status_idx" ON "employees" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "employees_tenant_name_idx" ON "employees" USING btree ("tenant_id","full_name");
--> statement-breakpoint
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "employees" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "employees_tenant_isolation" ON "employees"
	USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
