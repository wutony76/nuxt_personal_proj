CREATE TABLE "sixhccd_issue_spent" (
	"user_id" text NOT NULL,
	"issue" text NOT NULL,
	"amount" numeric DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sixhccd_issue_spent_user_id_issue_pk" PRIMARY KEY("user_id","issue")
);
--> statement-breakpoint
CREATE TABLE "sixhccd_member_quota" (
	"user_id" text PRIMARY KEY NOT NULL,
	"cross_tab_issue_max" numeric NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sixhccd_quota_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"cross_tab_issue_max" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sixhccd_tab_issue_spent" (
	"user_id" text NOT NULL,
	"tab_id" integer NOT NULL,
	"issue" text NOT NULL,
	"amount" numeric DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sixhccd_tab_issue_spent_user_id_tab_id_issue_pk" PRIMARY KEY("user_id","tab_id","issue")
);
--> statement-breakpoint
ALTER TABLE "sixhccd_issue_spent" ADD CONSTRAINT "sixhccd_issue_spent_user_id_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sixhccd_member_quota" ADD CONSTRAINT "sixhccd_member_quota_user_id_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sixhccd_tab_issue_spent" ADD CONSTRAINT "sixhccd_tab_issue_spent_user_id_members_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;