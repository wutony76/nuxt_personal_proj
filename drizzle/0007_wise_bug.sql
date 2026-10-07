CREATE TABLE "tw_payout_events" (
	"source" text NOT NULL,
	"order_id" text NOT NULL,
	"user_id" text NOT NULL,
	"issue" text NOT NULL,
	"amount" numeric NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "tw_payout_events_source_order_id_pk" PRIMARY KEY("source","order_id")
);
--> statement-breakpoint
CREATE TABLE "wallet_balance_changes" (
	"source" text NOT NULL,
	"id" text NOT NULL,
	"user_id" text NOT NULL,
	"issue" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric NOT NULL,
	"before" numeric NOT NULL,
	"after" numeric NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"note" text NOT NULL,
	CONSTRAINT "wallet_balance_changes_source_id_pk" PRIMARY KEY("source","id")
);
--> statement-breakpoint
CREATE TABLE "wallet_coin" (
	"user_id" text PRIMARY KEY NOT NULL,
	"coin" numeric NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tw_payout_events" ADD CONSTRAINT "tw_payout_events_user_id_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_balance_changes" ADD CONSTRAINT "wallet_balance_changes_user_id_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_coin" ADD CONSTRAINT "wallet_coin_user_id_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tw_payout_events_user_month" ON "tw_payout_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_wallet_balance_changes_user_month" ON "wallet_balance_changes" USING btree ("user_id","created_at");