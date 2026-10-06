CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role_id" text DEFAULT 'user' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "role_defs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"builtin" boolean DEFAULT false NOT NULL,
	"test_mode" boolean DEFAULT false NOT NULL,
	"npc_mode" boolean DEFAULT false NOT NULL,
	"demo_mode" boolean DEFAULT false NOT NULL,
	"daily_coin_reward_enabled" boolean DEFAULT false NOT NULL,
	"daily_coin_reward_amount" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_role_id_role_defs_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role_defs"("id") ON DELETE set default ON UPDATE no action;