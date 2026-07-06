-- CreateEnum
CREATE TYPE "TipoEquipo" AS ENUM ('AEROCOOLER', 'CALENTON');

-- CreateEnum
CREATE TYPE "EstadoUnidad" AS ENUM ('DISPONIBLE', 'RENTADA', 'MANTENIMIENTO', 'BAJA');

-- CreateEnum
CREATE TYPE "EstadoRenta" AS ENUM ('COTIZADA', 'CONFIRMADA', 'EN_RUTA', 'ENTREGADA', 'RECOGIDA', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'LINK_MERCADO_PAGO', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoPago" AS ENUM ('ANTICIPO', 'LIQUIDACION', 'REEMBOLSO');

-- CreateEnum
CREATE TYPE "CanalOrigen" AS ENUM ('MESSENGER', 'WHATSAPP', 'RECOMENDACION', 'RECURRENTE', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoAccesorio" AS ENUM ('MANGUERA', 'EXTENSION', 'TAMBO_GAS');

-- CreateEnum
CREATE TYPE "EstadoTambo" AS ENUM ('LLENO', 'VACIO', 'EN_CLIENTE');

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "canalOrigen" "CanalOrigen" NOT NULL DEFAULT 'WHATSAPP',
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeloEquipo" (
    "id" TEXT NOT NULL,
    "tipo" "TipoEquipo" NOT NULL,
    "nombre" TEXT NOT NULL,
    "precioDia" INTEGER NOT NULL,
    "precioDia3Mas" INTEGER,
    "specs" JSONB,

    CONSTRAINT "ModeloEquipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unidad" (
    "id" TEXT NOT NULL,
    "modeloId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "estado" "EstadoUnidad" NOT NULL DEFAULT 'DISPONIBLE',
    "notas" TEXT,

    CONSTRAINT "Unidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mantenimiento" (
    "id" TEXT NOT NULL,
    "unidadId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "costo" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resuelto" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Mantenimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accesorio" (
    "id" TEXT NOT NULL,
    "tipo" "TipoAccesorio" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "codigo" TEXT,
    "estadoTambo" "EstadoTambo",

    CONSTRAINT "Accesorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZonaEnvio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "kmMax" DOUBLE PRECISION NOT NULL,
    "costo" INTEGER NOT NULL,

    CONSTRAINT "ZonaEnvio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Renta" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "estado" "EstadoRenta" NOT NULL DEFAULT 'COTIZADA',
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "ventanaEntrega" TEXT,
    "direccion" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "linkMaps" TEXT,
    "codigoAcceso" TEXT,
    "distanciaKm" DOUBLE PRECISION,
    "costoDomicilio" INTEGER NOT NULL DEFAULT 0,
    "domicilioSobrescrito" BOOLEAN NOT NULL DEFAULT false,
    "descuentoMonto" INTEGER NOT NULL DEFAULT 0,
    "descuentoNota" TEXT,
    "requiereFactura" BOOLEAN NOT NULL DEFAULT false,
    "facturada" BOOLEAN NOT NULL DEFAULT false,
    "cfdiUuid" TEXT,
    "repartidorId" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Renta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentaUnidad" (
    "id" TEXT NOT NULL,
    "rentaId" TEXT NOT NULL,
    "unidadId" TEXT NOT NULL,
    "precioDia" INTEGER NOT NULL,

    CONSTRAINT "RentaUnidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentaAccesorio" (
    "id" TEXT NOT NULL,
    "rentaId" TEXT NOT NULL,
    "accesorioId" TEXT NOT NULL,
    "cargo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RentaAccesorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "rentaId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "tipo" "TipoPago" NOT NULL DEFAULT 'LIQUIDACION',
    "mpPaymentId" TEXT,
    "mpLinkUrl" TEXT,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensajeWhatsApp" (
    "id" TEXT NOT NULL,
    "rentaId" TEXT NOT NULL,
    "plantilla" TEXT NOT NULL,
    "waMessageId" TEXT,
    "estado" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensajeWhatsApp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cliente_telefono_idx" ON "Cliente"("telefono");

-- CreateIndex
CREATE UNIQUE INDEX "ModeloEquipo_nombre_key" ON "ModeloEquipo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Unidad_codigo_key" ON "Unidad"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Accesorio_codigo_key" ON "Accesorio"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ZonaEnvio_nombre_key" ON "ZonaEnvio"("nombre");

-- CreateIndex
CREATE INDEX "Renta_fechaInicio_fechaFin_idx" ON "Renta"("fechaInicio", "fechaFin");

-- CreateIndex
CREATE INDEX "Renta_estado_idx" ON "Renta"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "RentaUnidad_rentaId_unidadId_key" ON "RentaUnidad"("rentaId", "unidadId");

-- AddForeignKey
ALTER TABLE "Unidad" ADD CONSTRAINT "Unidad_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "ModeloEquipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mantenimiento" ADD CONSTRAINT "Mantenimiento_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "Unidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Renta" ADD CONSTRAINT "Renta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Renta" ADD CONSTRAINT "Renta_repartidorId_fkey" FOREIGN KEY ("repartidorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentaUnidad" ADD CONSTRAINT "RentaUnidad_rentaId_fkey" FOREIGN KEY ("rentaId") REFERENCES "Renta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentaUnidad" ADD CONSTRAINT "RentaUnidad_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "Unidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentaAccesorio" ADD CONSTRAINT "RentaAccesorio_rentaId_fkey" FOREIGN KEY ("rentaId") REFERENCES "Renta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentaAccesorio" ADD CONSTRAINT "RentaAccesorio_accesorioId_fkey" FOREIGN KEY ("accesorioId") REFERENCES "Accesorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_rentaId_fkey" FOREIGN KEY ("rentaId") REFERENCES "Renta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensajeWhatsApp" ADD CONSTRAINT "MensajeWhatsApp_rentaId_fkey" FOREIGN KEY ("rentaId") REFERENCES "Renta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
