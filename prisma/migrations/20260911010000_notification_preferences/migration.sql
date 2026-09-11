CREATE TABLE "NotificationPreferences" (
  "userId" TEXT NOT NULL,
  "friendRequests" BOOLEAN NOT NULL DEFAULT true,
  "groupInvites" BOOLEAN NOT NULL DEFAULT true,
  "messages" BOOLEAN NOT NULL DEFAULT true,
  "groupActivity" BOOLEAN NOT NULL DEFAULT true,
  "favoriteEvents" BOOLEAN NOT NULL DEFAULT true,
  "eventReminders" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "NotificationPreferences_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "NotificationPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
