CREATE TABLE "npc_daily_spent" (
	"user_id" text PRIMARY KEY NOT NULL,
	"date_key" text NOT NULL,
	"amount" numeric NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "npc_game_presets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"allowed_games" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "npc_member_games" (
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"key" text NOT NULL,
	CONSTRAINT "npc_member_games_user_id_category_key_pk" PRIMARY KEY("user_id","category","key")
);
--> statement-breakpoint
CREATE TABLE "npc_member_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"daily_max_spend" numeric NOT NULL,
	"top_up_amount" numeric NOT NULL,
	"retro_score_min_pct" numeric NOT NULL,
	"retro_score_max_pct" numeric NOT NULL,
	"bg_weight" numeric NOT NULL,
	"retro_weight" numeric NOT NULL,
	"tw_weight" numeric NOT NULL,
	"toys_weight" numeric NOT NULL,
	"bg_bet_amount_min" numeric NOT NULL,
	"bg_bet_amount_max" numeric NOT NULL,
	"active_time_slots" jsonb NOT NULL,
	"action_interval_sec" integer NOT NULL,
	"action_jitter_chance_pct" numeric NOT NULL,
	"action_jitter_max_sec" numeric NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "npc_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"enabled" boolean NOT NULL,
	"tick_interval_sec" integer NOT NULL,
	"retro_score_min_pct" numeric NOT NULL,
	"retro_score_max_pct" numeric NOT NULL,
	"bg_weight" numeric NOT NULL,
	"retro_weight" numeric NOT NULL,
	"tw_weight" numeric NOT NULL,
	"toys_weight" numeric NOT NULL,
	"bg_bet_amount_min" numeric NOT NULL,
	"bg_bet_amount_max" numeric NOT NULL,
	"name_words" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "npc_daily_spent" ADD CONSTRAINT "npc_daily_spent_user_id_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "npc_member_games" ADD CONSTRAINT "npc_member_games_user_id_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "npc_member_settings" ADD CONSTRAINT "npc_member_settings_user_id_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;