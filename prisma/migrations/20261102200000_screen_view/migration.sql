-- CreateTable
CREATE TABLE "ScreenView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pantalla" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreenView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScreenView_createdAt_idx" ON "ScreenView"("createdAt");

-- CreateIndex
CREATE INDEX "ScreenView_userId_pantalla_createdAt_idx" ON "ScreenView"("userId", "pantalla", "createdAt");

-- AddForeignKey
ALTER TABLE "ScreenView" ADD CONSTRAINT "ScreenView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nadie entra a esta tabla por PostgREST: la app escribe con Prisma, que entra
-- como dueño y no pasa por RLS.
ALTER TABLE "ScreenView" ENABLE ROW LEVEL SECURITY;
