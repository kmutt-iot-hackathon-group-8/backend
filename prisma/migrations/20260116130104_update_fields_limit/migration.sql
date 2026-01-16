/*
  Warnings:

  - You are about to alter the column `status` on the `attendees` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `eventIMG` on the `events` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - The primary key for the `history` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `history` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `history` table. All the data in the column will be lost.
  - You are about to alter the column `fname` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `lname` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `email` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(254)`.
  - You are about to alter the column `cardId` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `userPassword` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - Made the column `eventStartDate` on table `events` required. This step will fail if there are existing NULL values in that column.
  - Made the column `eventEndDate` on table `events` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `eventStartTime` to the `events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `eventEndTime` to the `events` table without a default value. This is not possible if the table is not empty.
  - Made the column `regisStart` on table `events` required. This step will fail if there are existing NULL values in that column.
  - Made the column `regisEnd` on table `events` required. This step will fail if there are existing NULL values in that column.
  - Made the column `regisURL` on table `events` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fname` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `lname` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userPassword` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_eventOwner_fkey";

-- AlterTable
ALTER TABLE "attendees" ALTER COLUMN "status" SET DATA TYPE VARCHAR(20);

-- AlterTable
ALTER TABLE "events" ALTER COLUMN "eventIMG" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "eventStartDate" SET NOT NULL,
ALTER COLUMN "eventStartDate" SET DATA TYPE DATE,
ALTER COLUMN "eventEndDate" SET NOT NULL,
ALTER COLUMN "eventEndDate" SET DATA TYPE DATE,
DROP COLUMN "eventStartTime",
ADD COLUMN     "eventStartTime" TIME NOT NULL,
DROP COLUMN "eventEndTime",
ADD COLUMN     "eventEndTime" TIME NOT NULL,
ALTER COLUMN "regisStart" SET NOT NULL,
ALTER COLUMN "regisStart" SET DATA TYPE DATE,
ALTER COLUMN "regisEnd" SET NOT NULL,
ALTER COLUMN "regisEnd" SET DATA TYPE DATE,
ALTER COLUMN "regisURL" SET NOT NULL;

-- AlterTable
ALTER TABLE "history" DROP CONSTRAINT "history_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "id",
ADD COLUMN     "historyId" SERIAL NOT NULL,
ADD COLUMN     "scanned_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "history_pkey" PRIMARY KEY ("historyId");

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "fname" SET NOT NULL,
ALTER COLUMN "fname" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "lname" SET NOT NULL,
ALTER COLUMN "lname" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "email" SET DATA TYPE VARCHAR(254),
ALTER COLUMN "cardId" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "userPassword" SET NOT NULL,
ALTER COLUMN "userPassword" SET DATA TYPE VARCHAR(255);

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_eventOwner_fkey" FOREIGN KEY ("eventOwner") REFERENCES "users"("uid") ON DELETE CASCADE ON UPDATE CASCADE;
