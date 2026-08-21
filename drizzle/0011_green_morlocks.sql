CREATE TABLE "competence_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"competence_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"event_type" text NOT NULL,
	"from_status" "competence_status" NOT NULL,
	"to_status" "competence_status" NOT NULL,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"competence_id" uuid,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"deduplication_key" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competencies" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "competencies" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "competencies" ADD COLUMN "approved_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "competencies" ADD COLUMN "approved_minutes" integer;--> statement-breakpoint
ALTER TABLE "competencies" ADD COLUMN "hourly_rate_cents" integer;--> statement-breakpoint
ALTER TABLE "competencies" ADD COLUMN "approved_amount_cents" integer;--> statement-breakpoint
ALTER TABLE "competencies" ADD COLUMN "adjustment_reason" text;--> statement-breakpoint
ALTER TABLE "competence_events" ADD CONSTRAINT "competence_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competence_events" ADD CONSTRAINT "competence_events_tenant_competence_fk" FOREIGN KEY ("tenant_id","competence_id") REFERENCES "public"."competencies"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competence_events" ADD CONSTRAINT "competence_events_tenant_actor_fk" FOREIGN KEY ("tenant_id","actor_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_recipient_fk" FOREIGN KEY ("tenant_id","recipient_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_competence_fk" FOREIGN KEY ("tenant_id","competence_id") REFERENCES "public"."competencies"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "competence_events_tenant_competence_occurred_idx" ON "competence_events" USING btree ("tenant_id","competence_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_tenant_deduplication_unique" ON "notifications" USING btree ("tenant_id","deduplication_key");--> statement-breakpoint
CREATE INDEX "notifications_tenant_recipient_created_idx" ON "notifications" USING btree ("tenant_id","recipient_user_id","created_at");--> statement-breakpoint
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_tenant_approver_fk" FOREIGN KEY ("tenant_id","approved_by_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competence_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "competence_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "competence_events_tenant_isolation" ON "competence_events" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "notifications_tenant_isolation" ON "notifications" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
