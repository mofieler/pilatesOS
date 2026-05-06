-- Migration: Expand credit types to support all class types and add validityWeeks column
-- Adds new credit types: duo_group, general_group, online_class, sound_healing
-- Adds sound_healing class type
-- Adds validityWeeks column to credit_packages table

-- Step 1: Add sound_healing to class_type enum
ALTER TYPE "public"."class_type" ADD VALUE 'sound_healing';

-- Step 2: Expand credit_type enum with new types
ALTER TYPE "public"."credit_type" ADD VALUE 'duo_group';
ALTER TYPE "public"."credit_type" ADD VALUE 'general_group';  
ALTER TYPE "public"."credit_type" ADD VALUE 'online_class';
ALTER TYPE "public"."credit_type" ADD VALUE 'sound_healing';

-- Step 3: Add validityWeeks column to credit_packages
ALTER TABLE "credit_packages" 
ADD COLUMN "validity_weeks" integer NOT NULL DEFAULT 52;

-- Step 4: Update existing packages to have default validityWeeks
UPDATE "credit_packages" 
SET "validity_weeks" = 52 
WHERE "validity_weeks" IS NULL;

-- Step 5: Update credit_packages_credit_type_idx index to include new types
DROP INDEX IF EXISTS "credit_packages_credit_type_idx";
CREATE INDEX "credit_packages_credit_type_idx" ON "credit_packages" USING btree ("credit_type");
