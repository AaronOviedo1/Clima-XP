-- Cargo por día festivo (snapshot) y promo 3+ calentones opcional por renta.
ALTER TABLE "Renta" ADD COLUMN "cargoFestivo" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Renta" ADD COLUMN "promo3Mas" BOOLEAN NOT NULL DEFAULT false;
