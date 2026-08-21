ALTER TABLE "documents" DROP CONSTRAINT "documents_uploaded_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "employee_notes" DROP CONSTRAINT "employee_notes_author_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_uploader_fk" FOREIGN KEY ("tenant_id","uploaded_by_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_notes" ADD CONSTRAINT "employee_notes_tenant_author_fk" FOREIGN KEY ("tenant_id","author_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;