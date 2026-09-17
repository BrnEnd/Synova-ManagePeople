ALTER TABLE "competence_rate_snapshots" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "competence_rate_snapshots" ADD COLUMN "pricing_complete" boolean DEFAULT true NOT NULL;--> statement-breakpoint
INSERT INTO "competence_rate_snapshots" ("id", "tenant_id", "competence_id", "time_entry_id", "work_date", "minutes", "financial_rate_cents", "commercial_rate_cents", "cost_amount_cents", "revenue_amount_cents", "pricing_complete", "created_at")
SELECT gen_random_uuid(), te."tenant_id", te."competence_id", te."id", te."work_date", te."minutes",
  coalesce(financial."hourly_rate_cents", 0), coalesce(commercial."hourly_rate_cents", 0),
  coalesce(round(te."minutes" * financial."hourly_rate_cents"::numeric / 60)::integer, 0),
  coalesce(round(te."minutes" * commercial."hourly_rate_cents"::numeric / 60)::integer, 0),
  financial."hourly_rate_cents" IS NOT NULL AND commercial."hourly_rate_cents" IS NOT NULL,
  coalesce(c."approved_at", now())
FROM "time_entries" te
JOIN "competencies" c ON c."tenant_id" = te."tenant_id" AND c."id" = te."competence_id"
LEFT JOIN LATERAL (SELECT fc."hourly_rate_cents" FROM "financial_conditions" fc WHERE fc."tenant_id" = te."tenant_id" AND fc."employee_id" = te."employee_id" AND fc."effective_from" <= te."work_date" AND (fc."effective_to" IS NULL OR fc."effective_to" >= te."work_date") ORDER BY fc."effective_from" DESC LIMIT 1) financial ON true
LEFT JOIN LATERAL (SELECT cc."hourly_rate_cents" FROM "commercial_conditions" cc WHERE cc."tenant_id" = te."tenant_id" AND cc."allocation_id" = te."allocation_id" AND cc."effective_from" <= te."work_date" AND (cc."effective_to" IS NULL OR cc."effective_to" >= te."work_date") ORDER BY cc."effective_from" DESC LIMIT 1) commercial ON true
WHERE c."status" IN ('awaiting_invoice', 'awaiting_payment', 'paid')
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "competencies" c SET "approved_revenue_cents" = totals.revenue
FROM (
  SELECT "tenant_id", "competence_id", sum("revenue_amount_cents")::integer AS revenue
  FROM "competence_rate_snapshots"
  GROUP BY "tenant_id", "competence_id"
  HAVING bool_and("pricing_complete")
) totals
WHERE c."tenant_id" = totals."tenant_id" AND c."id" = totals."competence_id";--> statement-breakpoint
ALTER TABLE "competence_rate_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "competence_rate_snapshots" FORCE ROW LEVEL SECURITY;
