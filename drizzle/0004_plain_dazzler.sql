CREATE TABLE "pacman_maze_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"rows" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retro_game_rates" (
	"game_key" text PRIMARY KEY NOT NULL,
	"coin_rate" numeric NOT NULL,
	"coin_cap_per_run" integer NOT NULL,
	"coin_daily_cap" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "toy_shop_games" (
	"slug" text PRIMARY KEY NOT NULL,
	"multiplier" numeric NOT NULL,
	"difficulty" numeric NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "toy_shop_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"enabled" boolean NOT NULL
);
