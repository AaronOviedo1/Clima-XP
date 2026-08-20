-- CreateTable
CREATE TABLE "ConsultaCopiloto" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "pregunta" TEXT NOT NULL,
    "toolsLlamadas" TEXT[],
    "tokensEntrada" INTEGER NOT NULL DEFAULT 0,
    "tokensSalida" INTEGER NOT NULL DEFAULT 0,
    "latenciaMs" INTEGER NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultaCopiloto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsultaCopiloto_userId_createdAt_idx" ON "ConsultaCopiloto"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ConsultaCopiloto" ADD CONSTRAINT "ConsultaCopiloto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
