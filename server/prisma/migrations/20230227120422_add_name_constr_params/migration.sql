/*
  Warnings:

  - Added the required column `name` to the `ConstrAbiParams` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ConstrAbiParams" ADD COLUMN     "name" TEXT NOT NULL;
