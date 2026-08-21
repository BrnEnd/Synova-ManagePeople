ALTER TABLE "employees" DROP CONSTRAINT "employees_user_id_users_id_fk";
--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_id_id_unique" ON "users" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;
