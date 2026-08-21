CREATE TYPE "public"."competence_status" AS ENUM('filling', 'awaiting_approval', 'adjustments_requested', 'awaiting_invoice', 'awaiting_payment', 'paid');--> statement-breakpoint
CREATE TABLE "competencies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"allocation_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"manager_user_id" uuid NOT NULL,
	"reference_month" date NOT NULL,
	"status" "competence_status" DEFAULT 'filling' NOT NULL,
	"total_minutes" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competencies_month_first_day_check" CHECK (extract(day from "competencies"."reference_month") = 1),
	CONSTRAINT "competencies_total_nonnegative_check" CHECK ("competencies"."total_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"competence_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"allocation_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"minutes" integer NOT NULL,
	"observation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "time_entries_minutes_check" CHECK ("time_entries"."minutes" > 0 and "time_entries"."minutes" <= 1440)
);
--> statement-breakpoint
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_tenant_employee_fk" FOREIGN KEY ("tenant_id","employee_id") REFERENCES "public"."employees"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_tenant_allocation_fk" FOREIGN KEY ("tenant_id","allocation_id") REFERENCES "public"."allocations"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_tenant_client_fk" FOREIGN KEY ("tenant_id","client_id") REFERENCES "public"."clients"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_tenant_manager_fk" FOREIGN KEY ("tenant_id","manager_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "competencies_tenant_id_id_unique" ON "competencies" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_tenant_competence_fk" FOREIGN KEY ("tenant_id","competence_id") REFERENCES "public"."competencies"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_tenant_employee_fk" FOREIGN KEY ("tenant_id","employee_id") REFERENCES "public"."employees"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_tenant_allocation_fk" FOREIGN KEY ("tenant_id","allocation_id") REFERENCES "public"."allocations"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "competencies_employee_month_unique" ON "competencies" USING btree ("tenant_id","employee_id","reference_month");--> statement-breakpoint
CREATE INDEX "competencies_tenant_status_month_idx" ON "competencies" USING btree ("tenant_id","status","reference_month");--> statement-breakpoint
CREATE UNIQUE INDEX "time_entries_tenant_id_id_unique" ON "time_entries" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "time_entries_competence_date_unique" ON "time_entries" USING btree ("tenant_id","competence_id","work_date");--> statement-breakpoint
CREATE INDEX "time_entries_tenant_employee_date_idx" ON "time_entries" USING btree ("tenant_id","employee_id","work_date");--> statement-breakpoint
ALTER TABLE "competencies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "competencies" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "competencies_tenant_isolation" ON "competencies" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "time_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "time_entries" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "time_entries_tenant_isolation" ON "time_entries" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
