-- CreateTable
CREATE TABLE "users" (
    "uid" SERIAL NOT NULL,
    "fname" TEXT,
    "lname" TEXT,
    "email" TEXT NOT NULL,
    "cardId" TEXT,
    "userPassword" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("uid")
);

-- CreateTable
CREATE TABLE "events" (
    "eventId" SERIAL NOT NULL,
    "eventOwner" INTEGER NOT NULL,
    "eventDetail" TEXT,
    "eventIMG" TEXT,
    "eventStartDate" TIMESTAMP(3),
    "eventEndDate" TIMESTAMP(3),
    "eventStartTime" TEXT,
    "eventEndTime" TEXT,
    "regisStart" TIMESTAMP(3),
    "regisEnd" TIMESTAMP(3),
    "contact" TEXT,
    "regisURL" TEXT,

    CONSTRAINT "events_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "attendees" (
    "eventId" INTEGER NOT NULL,
    "uid" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'registered',

    CONSTRAINT "attendees_pkey" PRIMARY KEY ("eventId","uid")
);

-- CreateTable
CREATE TABLE "history" (
    "id" SERIAL NOT NULL,
    "uid" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_cardId_key" ON "users"("cardId");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_eventOwner_fkey" FOREIGN KEY ("eventOwner") REFERENCES "users"("uid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("eventId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_uid_fkey" FOREIGN KEY ("uid") REFERENCES "users"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "history" ADD CONSTRAINT "history_uid_fkey" FOREIGN KEY ("uid") REFERENCES "users"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "history" ADD CONSTRAINT "history_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("eventId") ON DELETE CASCADE ON UPDATE CASCADE;
