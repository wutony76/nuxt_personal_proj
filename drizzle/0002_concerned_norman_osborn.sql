CREATE TABLE "game_global_disabled" (
	"category" text NOT NULL,
	"key" text NOT NULL,
	CONSTRAINT "game_global_disabled_category_key_pk" PRIMARY KEY("category","key")
);
--> statement-breakpoint
CREATE TABLE "role_game_perms" (
	"role_id" text NOT NULL,
	"category" text NOT NULL,
	"key" text NOT NULL,
	CONSTRAINT "role_game_perms_role_id_category_key_pk" PRIMARY KEY("role_id","category","key")
);
--> statement-breakpoint
ALTER TABLE "role_game_perms" ADD CONSTRAINT "role_game_perms_role_id_role_defs_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role_defs"("id") ON DELETE cascade ON UPDATE no action;