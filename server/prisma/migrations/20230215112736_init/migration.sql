-- CreateTable
CREATE TABLE "Entry" (
    "id" SERIAL NOT NULL,
    "txid" TEXT NOT NULL,
    "vout" INTEGER NOT NULL,
    "scriptHash" TEXT NOT NULL,
    "timeAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Src" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "fName" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Src_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Src" ADD CONSTRAINT "Src_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
