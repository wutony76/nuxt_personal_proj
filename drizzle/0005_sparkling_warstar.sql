CREATE TABLE "chat_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"hour" integer NOT NULL,
	"minute" integer NOT NULL,
	"repeat" text NOT NULL,
	"interval_seconds" integer,
	"enabled" boolean NOT NULL,
	"created_by" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
