ALTER TABLE "hazard_incidents"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "observed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contact_info" TEXT;