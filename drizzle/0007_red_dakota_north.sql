ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_actor_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_actor_fk" FOREIGN KEY ("tenant_id","actor_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;