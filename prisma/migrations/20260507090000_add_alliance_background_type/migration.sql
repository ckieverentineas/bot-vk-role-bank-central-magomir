-- Add a background kind so one alliance can have separate images for main menu, services, etc.
ALTER TABLE "AllianceBackground" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'main';

DROP INDEX "AllianceBackground_alliance_id_key";

CREATE UNIQUE INDEX "AllianceBackground_alliance_id_type_key" ON "AllianceBackground"("alliance_id", "type");
