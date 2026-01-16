/*
  Warnings:

  - The primary key for the `attendees` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `uid` on the `attendees` table. All the data in the column will be lost.
  - You are about to drop the column `uid` on the `history` table. All the data in the column will be lost.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `uid` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `userPassword` on the `users` table. All the data in the column will be lost.
  - Added the required column `userId` to the `history` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "account" DROP CONSTRAINT "account_userId_fkey";

-- DropForeignKey
ALTER TABLE "attendees" DROP CONSTRAINT "attendees_uid_fkey";

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_eventOwner_fkey";

-- DropForeignKey
ALTER TABLE "history" DROP CONSTRAINT "history_uid_fkey";

-- DropForeignKey
ALTER TABLE "session" DROP CONSTRAINT "session_userId_fkey";

-- AlterTable
ALTER TABLE "attendees" DROP CONSTRAINT "attendees_pkey",
DROP COLUMN "uid",
ADD COLUMN     "userId" INTEGER NOT NULL DEFAULT 1,
ADD CONSTRAINT "attendees_pkey" PRIMARY KEY ("eventId", "userId");

-- AlterTable
ALTER TABLE "history" DROP COLUMN "uid",
ADD COLUMN     "userId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "uid",
DROP COLUMN "userPassword",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_eventOwner_fkey" FOREIGN KEY ("eventOwner") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "history" ADD CONSTRAINT "history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
