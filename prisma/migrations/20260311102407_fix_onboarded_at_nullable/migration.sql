/*
  Warnings:

  - You are about to drop the column `onBoardedAt` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "onBoardedAt",
ADD COLUMN     "onboardedAt" TIMESTAMP(3);
