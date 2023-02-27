-- CreateTable
CREATE TABLE "ConstrAbiParams" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "pos" INTEGER NOT NULL,
    "val" TEXT NOT NULL,

    CONSTRAINT "ConstrAbiParams_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ConstrAbiParams" ADD CONSTRAINT "ConstrAbiParams_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
