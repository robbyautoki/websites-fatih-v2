-- CreateTable
CREATE TABLE "ImportedDomain" (
    "id" TEXT NOT NULL,
    "originalDomain" TEXT NOT NULL,
    "purchasedDomain" TEXT,
    "price" DOUBLE PRECISION,
    "forwardUrl" TEXT,
    "emailPrefix" TEXT,
    "emailForwardTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "ImportedDomain_pkey" PRIMARY KEY ("id")
);
