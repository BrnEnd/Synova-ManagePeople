CREATE TABLE "competence_rate_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"competence_id" uuid NOT NULL,
	"time_entry_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"minutes" integer NOT NULL,
	"financial_rate_cents" integer NOT NULL,
	"commercial_rate_cents" integer NOT NULL,
	"cost_amount_cents" integer NOT NULL,
	"revenue_amount_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competence_rate_snapshots_minutes_check" CHECK ("competence_rate_snapshots"."minutes" > 0 and "competence_rate_snapshots"."minutes" <= 1440)
);
--> statement-breakpoint
ALTER TABLE "competencies" ADD COLUMN "approved_revenue_cents" integer;--> statement-breakpoint
ALTER TABLE "competence_rate_snapshots" ADD CONSTRAINT "competence_rate_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competence_rate_snapshots" ADD CONSTRAINT "competence_rate_snapshots_tenant_competence_fk" FOREIGN KEY ("tenant_id","competence_id") REFERENCES "public"."competencies"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competence_rate_snapshots" ADD CONSTRAINT "competence_rate_snapshots_tenant_entry_fk" FOREIGN KEY ("tenant_id","time_entry_id") REFERENCES "public"."time_entries"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "competence_rate_snapshots_entry_unique" ON "competence_rate_snapshots" USING btree ("tenant_id","competence_id","time_entry_id");--> statement-breakpoint
CREATE INDEX "competence_rate_snapshots_competence_idx" ON "competence_rate_snapshots" USING btree ("tenant_id","competence_id");--> statement-breakpoint
INSERT INTO "competence_rate_snapshots" ("id", "tenant_id", "competence_id", "time_entry_id", "work_date", "minutes", "financial_rate_cents", "commercial_rate_cents", "cost_amount_cents", "revenue_amount_cents", "created_at")
SELECT gen_random_uuid(), te."tenant_id", te."competence_id", te."id", te."work_date", te."minutes",
  financial."hourly_rate_cents", commercial."hourly_rate_cents",
  round(te."minutes" * financial."hourly_rate_cents"::numeric / 60)::integer,
  round(te."minutes" * commercial."hourly_rate_cents"::numeric / 60)::integer,
  coalesce(c."approved_at", now())
FROM "time_entries" te
JOIN "competencies" c ON c."tenant_id" = te."tenant_id" AND c."id" = te."competence_id"
JOIN LATERAL (SELECT fc."hourly_rate_cents" FROM "financial_conditions" fc WHERE fc."tenant_id" = te."tenant_id" AND fc."employee_id" = te."employee_id" AND fc."effective_from" <= te."work_date" AND (fc."effective_to" IS NULL OR fc."effective_to" >= te."work_date") ORDER BY fc."effective_from" DESC LIMIT 1) financial ON true
JOIN LATERAL (SELECT cc."hourly_rate_cents" FROM "commercial_conditions" cc WHERE cc."tenant_id" = te."tenant_id" AND cc."allocation_id" = te."allocation_id" AND cc."effective_from" <= te."work_date" AND (cc."effective_to" IS NULL OR cc."effective_to" >= te."work_date") ORDER BY cc."effective_from" DESC LIMIT 1) commercial ON true
WHERE c."status" IN ('awaiting_invoice', 'awaiting_payment', 'paid')
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "competencies" c SET "approved_revenue_cents" = totals.revenue
FROM (SELECT "tenant_id", "competence_id", sum("revenue_amount_cents")::integer AS revenue FROM "competence_rate_snapshots" GROUP BY "tenant_id", "competence_id") totals
WHERE c."tenant_id" = totals."tenant_id" AND c."id" = totals."competence_id";--> statement-breakpoint
ALTER TABLE "competence_rate_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "competence_rate_snapshots" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "competence_rate_snapshots_tenant_isolation" ON "competence_rate_snapshots" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
