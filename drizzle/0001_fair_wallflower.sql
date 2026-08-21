TRUNCATE TABLE "login_attempts";--> statement-breakpoint
ALTER TABLE "login_attempts" ADD COLUMN "tenant_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_attempts_tenant_updated_idx" ON "login_attempts" USING btree ("tenant_id","updated_at");--> statement-breakpoint
DROP POLICY "users_tenant_isolation" ON "users";--> statement-breakpoint
CREATE POLICY "users_tenant_isolation" ON "users"
	USING (
		"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		OR current_user = 'synova_provisioner'
	)
	WITH CHECK (
		"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		OR current_user = 'synova_provisioner'
	);--> statement-breakpoint
DROP POLICY "audit_events_tenant_isolation" ON "audit_events";--> statement-breakpoint
CREATE POLICY "audit_events_tenant_isolation" ON "audit_events"
	USING (
		"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		OR current_user = 'synova_provisioner'
	)
	WITH CHECK (
		"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		OR current_user = 'synova_provisioner'
	);--> statement-breakpoint
DROP POLICY "idempotency_records_tenant_isolation" ON "idempotency_records";--> statement-breakpoint
CREATE POLICY "idempotency_records_tenant_isolation" ON "idempotency_records"
	USING (
		"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		OR current_user = 'synova_provisioner'
	)
	WITH CHECK (
		"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		OR current_user = 'synova_provisioner'
	);--> statement-breakpoint
ALTER TABLE "login_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "login_attempts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "login_attempts_tenant_isolation" ON "login_attempts"
	USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
