CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"competence_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"notes" text,
	"receipt_document_id" uuid NOT NULL,
	"recorded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive_check" CHECK ("payments"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "competencies" ADD COLUMN "forecast_document_id" uuid;--> statement-breakpoint
ALTER TABLE "competencies" ADD COLUMN "invoice_document_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_competence_fk" FOREIGN KEY ("tenant_id","competence_id") REFERENCES "public"."competencies"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_employee_fk" FOREIGN KEY ("tenant_id","employee_id") REFERENCES "public"."employees"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_receipt_document_fk" FOREIGN KEY ("tenant_id","receipt_document_id") REFERENCES "public"."documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_recorder_fk" FOREIGN KEY ("tenant_id","recorded_by_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_tenant_id_id_unique" ON "payments" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_competence_unique" ON "payments" USING btree ("tenant_id","competence_id");--> statement-breakpoint
CREATE INDEX "payments_tenant_paid_at_idx" ON "payments" USING btree ("tenant_id","paid_at");--> statement-breakpoint
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_tenant_forecast_document_fk" FOREIGN KEY ("tenant_id","forecast_document_id") REFERENCES "public"."documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_tenant_invoice_document_fk" FOREIGN KEY ("tenant_id","invoice_document_id") REFERENCES "public"."documents"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "payments_tenant_isolation" ON "payments" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
