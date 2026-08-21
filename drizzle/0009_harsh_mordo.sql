CREATE TYPE "public"."allocation_status" AS ENUM('active', 'ended');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('active', 'ended');--> statement-breakpoint
CREATE TABLE "allocations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"manager_user_id" uuid NOT NULL,
	"role_title" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"status" "allocation_status" DEFAULT 'active' NOT NULL,
	"observations" text,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "allocations_valid_period_check" CHECK ("allocations"."end_date" is null or "allocations"."end_date" >= "allocations"."start_date")
);
--> statement-breakpoint
CREATE TABLE "commercial_conditions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"allocation_id" uuid NOT NULL,
	"hourly_rate_cents" integer NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"observations" text,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commercial_conditions_rate_positive_check" CHECK ("commercial_conditions"."hourly_rate_cents" > 0),
	CONSTRAINT "commercial_conditions_valid_period_check" CHECK ("commercial_conditions"."effective_to" is null or "commercial_conditions"."effective_to" >= "commercial_conditions"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"document_id" uuid,
	"contract_type" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"status" "contract_status" DEFAULT 'active' NOT NULL,
	"observations" text,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "contracts_valid_period_check" CHECK ("contracts"."end_date" is null or "contracts"."end_date" >= "contracts"."start_date")
);
--> statement-breakpoint
CREATE TABLE "financial_conditions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"hourly_rate_cents" integer NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"observations" text,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_conditions_rate_positive_check" CHECK ("financial_conditions"."hourly_rate_cents" > 0),
	CONSTRAINT "financial_conditions_valid_period_check" CHECK ("financial_conditions"."effective_to" is null or "financial_conditions"."effective_to" >= "financial_conditions"."effective_from")
);
--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_tenant_employee_fk" FOREIGN KEY ("tenant_id","employee_id") REFERENCES "public"."employees"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_tenant_client_fk" FOREIGN KEY ("tenant_id","client_id") REFERENCES "public"."clients"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_tenant_manager_fk" FOREIGN KEY ("tenant_id","manager_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_tenant_creator_fk" FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "allocations_tenant_id_id_unique" ON "allocations" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "commercial_conditions" ADD CONSTRAINT "commercial_conditions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_conditions" ADD CONSTRAINT "commercial_conditions_tenant_allocation_fk" FOREIGN KEY ("tenant_id","allocation_id") REFERENCES "public"."allocations"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_conditions" ADD CONSTRAINT "commercial_conditions_tenant_creator_fk" FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_tenant_id_id_unique" ON "documents" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tenant_employee_fk" FOREIGN KEY ("tenant_id","employee_id") REFERENCES "public"."employees"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tenant_document_fk" FOREIGN KEY ("tenant_id","document_id") REFERENCES "public"."documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tenant_creator_fk" FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_conditions" ADD CONSTRAINT "financial_conditions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_conditions" ADD CONSTRAINT "financial_conditions_tenant_employee_fk" FOREIGN KEY ("tenant_id","employee_id") REFERENCES "public"."employees"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_conditions" ADD CONSTRAINT "financial_conditions_tenant_creator_fk" FOREIGN KEY ("tenant_id","created_by_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "allocations_tenant_employee_start_idx" ON "allocations" USING btree ("tenant_id","employee_id","start_date");--> statement-breakpoint
CREATE INDEX "allocations_tenant_client_status_idx" ON "allocations" USING btree ("tenant_id","client_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "commercial_conditions_tenant_id_id_unique" ON "commercial_conditions" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "commercial_conditions_version_unique" ON "commercial_conditions" USING btree ("tenant_id","allocation_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "commercial_conditions_open_unique" ON "commercial_conditions" USING btree ("tenant_id","allocation_id") WHERE "commercial_conditions"."effective_to" is null;--> statement-breakpoint
CREATE INDEX "commercial_conditions_tenant_allocation_effective_idx" ON "commercial_conditions" USING btree ("tenant_id","allocation_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_tenant_id_id_unique" ON "contracts" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "contracts_tenant_employee_start_idx" ON "contracts" USING btree ("tenant_id","employee_id","start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_conditions_tenant_id_id_unique" ON "financial_conditions" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_conditions_version_unique" ON "financial_conditions" USING btree ("tenant_id","employee_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_conditions_open_unique" ON "financial_conditions" USING btree ("tenant_id","employee_id") WHERE "financial_conditions"."effective_to" is null;--> statement-breakpoint
CREATE INDEX "financial_conditions_tenant_employee_effective_idx" ON "financial_conditions" USING btree ("tenant_id","employee_id","effective_from");--> statement-breakpoint
ALTER TABLE "contracts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contracts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "contracts_tenant_isolation" ON "contracts" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "allocations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "allocations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "allocations_tenant_isolation" ON "allocations" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "financial_conditions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "financial_conditions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "financial_conditions_tenant_isolation" ON "financial_conditions" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "commercial_conditions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "commercial_conditions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "commercial_conditions_tenant_isolation" ON "commercial_conditions" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
