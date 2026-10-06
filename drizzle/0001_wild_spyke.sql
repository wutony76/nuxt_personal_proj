CREATE TABLE "game_orders" (
	"order_id" text PRIMARY KEY NOT NULL,
	"game_key" text NOT NULL,
	"issue" text NOT NULL,
	"user_id" text NOT NULL,
	"tab_id" text,
	"play_key" text,
	"coin" numeric NOT NULL,
	"bet_code" jsonb NOT NULL,
	"odds" numeric,
	"tiers" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pool_audit_overpay" (
	"id" text PRIMARY KEY NOT NULL,
	"lottery_key" text NOT NULL,
	"issue" text NOT NULL,
	"overpay" numeric NOT NULL,
	"happened_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pool_audit_reseed" (
	"id" text PRIMARY KEY NOT NULL,
	"lottery_key" text NOT NULL,
	"issue" text NOT NULL,
	"before" numeric NOT NULL,
	"after" numeric NOT NULL,
	"happened_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retro_daily_grants" (
	"user_id" text NOT NULL,
	"game_key" text NOT NULL,
	"date_key" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retro_daily_grants_user_id_game_key_date_key_pk" PRIMARY KEY("user_id","game_key","date_key")
);
--> statement-breakpoint
CREATE TABLE "retro_game_history" (
	"id" text PRIMARY KEY NOT NULL,
	"game_key" text NOT NULL,
	"user_id" text NOT NULL,
	"score" integer NOT NULL,
	"level" integer,
	"meta" jsonb,
	"played_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_game_orders_game_issue" ON "game_orders" USING btree ("game_key","issue");--> statement-breakpoint
CREATE INDEX "idx_game_orders_user_month" ON "game_orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_retro_history_user_month" ON "retro_game_history" USING btree ("user_id","played_at");