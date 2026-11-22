-- AlterTable
ALTER TABLE "AllianceShopCategory" ADD COLUMN "salePercent" INTEGER;
ALTER TABLE "AllianceShopCategory" ADD COLUMN "saleStartedAt" DATETIME;

-- CreateIndex
CREATE INDEX "AllianceShopCategory_id_alliance_shop_idx" ON "AllianceShopCategory"("id_alliance_shop");

-- CreateIndex
CREATE INDEX "AllianceShopCategory_salePercent_idx" ON "AllianceShopCategory"("salePercent");
