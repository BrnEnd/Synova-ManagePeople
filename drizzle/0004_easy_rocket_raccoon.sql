CREATE TABLE "external_hiring_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"external_hiring_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"employee_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"missing_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_keys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "external_hiring_records" ADD CONSTRAINT "external_hiring_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "employees_tenant_id_id_unique" ON "employees" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "external_hiring_records" ADD CONSTRAINT "external_hiring_tenant_employee_fk" FOREIGN KEY ("tenant_id","employee_id") REFERENCES "public"."employees"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_keys" ADD CONSTRAINT "service_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "external_hiring_tenant_external_unique" ON "external_hiring_records" USING btree ("tenant_id","external_hiring_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_hiring_tenant_idempotency_unique" ON "external_hiring_records" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "external_hiring_tenant_created_idx" ON "external_hiring_records" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "service_keys_hash_unique" ON "service_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "service_keys_tenant_created_idx" ON "service_keys" USING btree ("tenant_id","created_at");--> statement-breakpoint
ALTER TABLE "external_hiring_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "external_hiring_records" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "external_hiring_records_tenant_isolation" ON "external_hiring_records"
	USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "service_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "service_keys" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "service_keys_tenant_isolation" ON "service_keys"
	USING (
		"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		OR current_user = 'synova_provisioner'
	)
	WITH CHECK (
		"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		OR current_user = 'synova_provisioner'
	);--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'synova_provisioner') THEN
		GRANT SELECT, INSERT, UPDATE, DELETE ON "service_keys" TO synova_provisioner;
	END IF;
END
$$;
