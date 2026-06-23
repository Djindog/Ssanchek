-- CreateTable
CREATE TABLE "UserCrawlResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCrawlResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCrawlResult_userId_key" ON "UserCrawlResult"("userId");

-- AddForeignKey
ALTER TABLE "UserCrawlResult" ADD CONSTRAINT "UserCrawlResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
