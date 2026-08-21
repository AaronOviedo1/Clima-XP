-- CreateEnum
CREATE TYPE "EstadoAccionCopiloto" AS ENUM ('PROPUESTA', 'CONFIRMADA', 'EJECUTADA', 'FALLIDA', 'CANCELADA', 'EXPIRADA');

-- CreateTable
CREATE TABLE "AccionCopiloto" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "consultaId" TEXT,
    "tipo" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "resumen" JSONB NOT NULL,
    "entidadId" TEXT,
    "huella" TEXT,
    "estado" "EstadoAccionCopiloto" NOT NULL DEFAULT 'PROPUESTA',
    "resultado" TEXT,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "decididoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccionCopiloto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccionCopiloto_userId_estado_createdAt_idx" ON "AccionCopiloto"("userId", "estado", "createdAt");

-- CreateIndex
CREATE INDEX "AccionCopiloto_userId_decididoEn_idx" ON "AccionCopiloto"("userId", "decididoEn");

-- AddForeignKey
ALTER TABLE "AccionCopiloto" ADD CONSTRAINT "AccionCopiloto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccionCopiloto" ADD CONSTRAINT "AccionCopiloto_consultaId_fkey" FOREIGN KEY ("consultaId") REFERENCES "ConsultaCopiloto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
