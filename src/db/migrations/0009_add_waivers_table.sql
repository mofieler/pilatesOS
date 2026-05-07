-- Migration: Add waivers table for legal liability records
-- Description: persist signed-waiver evidence (typed name, version, IP, UA)
-- as immutable rows. The boolean users.has_signed_waiver remains the fast
-- lookup for the booking gate.

CREATE TABLE IF NOT EXISTS "waivers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "waiver_version" varchar(32) NOT NULL,
  "signed_name" varchar(255) NOT NULL,
  "signed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ip_address" varchar(64),
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "waivers_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "waivers_user_id_idx" ON "waivers" ("user_id");
CREATE INDEX IF NOT EXISTS "waivers_signed_at_idx" ON "waivers" ("signed_at");
