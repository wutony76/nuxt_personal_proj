CREATE TABLE "login_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"ip" text NOT NULL,
	"user_agent" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_login_history_user" ON "login_history" USING btree ("user_id","created_at");