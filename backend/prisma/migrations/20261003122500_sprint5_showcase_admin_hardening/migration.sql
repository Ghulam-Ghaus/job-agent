-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "slug" TEXT,
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorSecret" TEXT;

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'AI_AUTOMATION',
    "features" JSONB NOT NULL DEFAULT '[]',
    "priceUsd" INTEGER,
    "priceModel" TEXT NOT NULL DEFAULT 'FIXED',
    "demoUrl" TEXT,
    "badge" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_userId_idx" ON "products"("userId");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- CreateIndex
CREATE UNIQUE INDEX "users_slug_key" ON "users"("slug");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
