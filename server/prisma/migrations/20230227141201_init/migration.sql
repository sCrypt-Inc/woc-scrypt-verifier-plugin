-- CreateTable
CREATE TABLE "Entry" (
    "id" SERIAL NOT NULL,
    "network" TEXT NOT NULL,
    "scriptHash" TEXT NOT NULL,
    "scryptTSVersion" TEXT NOT NULL,
    "timeAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstrAbiParams" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "pos" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "val" TEXT NOT NULL,

    CONSTRAINT "ConstrAbiParams_pkey" PRIMARY KEY ("id")
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
ALTER TABLE "ConstrAbiParams" ADD CONSTRAINT "ConstrAbiParams_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Src" ADD CONSTRAINT "Src_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
