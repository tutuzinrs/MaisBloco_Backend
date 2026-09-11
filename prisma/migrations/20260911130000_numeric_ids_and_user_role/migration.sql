-- Migração manual: IDs numéricos (autoincrement 1,2,3...) + campo role em User.
-- Preserva os dados existentes (User, RefreshToken, PasswordResetToken). As demais
-- tabelas estão vazias e apenas mudam de tipo.

-- ============================================================================
-- 1) Remove todas as foreign keys (recriadas ao final)
-- ============================================================================
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_userId_fkey";
ALTER TABLE "Friendship" DROP CONSTRAINT "Friendship_requesterId_fkey";
ALTER TABLE "Friendship" DROP CONSTRAINT "Friendship_receiverId_fkey";
ALTER TABLE "Block" DROP CONSTRAINT "Block_blockerId_fkey";
ALTER TABLE "Block" DROP CONSTRAINT "Block_blockedId_fkey";
ALTER TABLE "Group" DROP CONSTRAINT "Group_ownerId_fkey";
ALTER TABLE "GroupMember" DROP CONSTRAINT "GroupMember_groupId_fkey";
ALTER TABLE "GroupMember" DROP CONSTRAINT "GroupMember_userId_fkey";
ALTER TABLE "GroupInvite" DROP CONSTRAINT "GroupInvite_groupId_fkey";
ALTER TABLE "GroupInvite" DROP CONSTRAINT "GroupInvite_inviterId_fkey";
ALTER TABLE "GroupInvite" DROP CONSTRAINT "GroupInvite_inviteeId_fkey";
ALTER TABLE "GroupChat" DROP CONSTRAINT "GroupChat_groupId_fkey";
ALTER TABLE "ConversationParticipant" DROP CONSTRAINT "ConversationParticipant_conversationId_fkey";
ALTER TABLE "ConversationParticipant" DROP CONSTRAINT "ConversationParticipant_userId_fkey";
ALTER TABLE "Message" DROP CONSTRAINT "Message_conversationId_fkey";
ALTER TABLE "Message" DROP CONSTRAINT "Message_groupChatId_fkey";
ALTER TABLE "Message" DROP CONSTRAINT "Message_senderId_fkey";
ALTER TABLE "Message" DROP CONSTRAINT "Message_replyToId_fkey";
ALTER TABLE "MessageReaction" DROP CONSTRAINT "MessageReaction_messageId_fkey";
ALTER TABLE "MessageReaction" DROP CONSTRAINT "MessageReaction_userId_fkey";
ALTER TABLE "PinnedMessage" DROP CONSTRAINT "PinnedMessage_messageId_fkey";
ALTER TABLE "PinnedMessage" DROP CONSTRAINT "PinnedMessage_userId_fkey";
ALTER TABLE "PinnedMessage" DROP CONSTRAINT "PinnedMessage_groupChatId_fkey";
ALTER TABLE "EventParticipant" DROP CONSTRAINT "EventParticipant_eventId_fkey";
ALTER TABLE "EventParticipant" DROP CONSTRAINT "EventParticipant_userId_fkey";
ALTER TABLE "Favorite" DROP CONSTRAINT "Favorite_userId_fkey";
ALTER TABLE "Favorite" DROP CONSTRAINT "Favorite_eventId_fkey";
ALTER TABLE "Location" DROP CONSTRAINT "Location_userId_fkey";
ALTER TABLE "MeetingPoint" DROP CONSTRAINT "MeetingPoint_eventId_fkey";
ALTER TABLE "MeetingPoint" DROP CONSTRAINT "MeetingPoint_createdById_fkey";
ALTER TABLE "MeetingPointShare" DROP CONSTRAINT "MeetingPointShare_meetingPointId_fkey";
ALTER TABLE "MeetingPointShare" DROP CONSTRAINT "MeetingPointShare_sharedWithId_fkey";
ALTER TABLE "Report" DROP CONSTRAINT "Report_reporterId_fkey";
ALTER TABLE "Report" DROP CONSTRAINT "Report_reportedId_fkey";
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";
ALTER TABLE "NotificationPreferences" DROP CONSTRAINT "NotificationPreferences_userId_fkey";

-- ============================================================================
-- 2) User: converte id para numérico preservando os 7 registros + campo role
-- ============================================================================
ALTER TABLE "User" DROP CONSTRAINT "User_pkey";
ALTER TABLE "User" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "User" ADD COLUMN "id" SERIAL;

UPDATE "RefreshToken"
SET "userId" = u."id"
FROM "User" u
WHERE "RefreshToken"."userId" = u."__old_id";

UPDATE "PasswordResetToken"
SET "userId" = u."id"
FROM "User" u
WHERE "PasswordResetToken"."userId" = u."__old_id";

UPDATE "NotificationPreferences"
SET "userId" = u."id"
FROM "User" u
WHERE "NotificationPreferences"."userId" = u."__old_id";

ALTER TABLE "User" ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
ALTER TABLE "User" DROP COLUMN "__old_id";

-- role: 1 = ADMIN, 2 = CLIENTE
ALTER TABLE "User" ADD COLUMN "role" INTEGER NOT NULL DEFAULT 2;
UPDATE "User" SET "role" = 1 WHERE "email" = 'admin_test_01@maisbloco.local';

-- ============================================================================
-- 3) Converte o id das demais tabelas para SERIAL (id numérico)
-- ============================================================================
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_pkey";
ALTER TABLE "RefreshToken" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "RefreshToken" ADD COLUMN "id" SERIAL;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id");
ALTER TABLE "RefreshToken" DROP COLUMN "__old_id";

ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_pkey";
ALTER TABLE "PasswordResetToken" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "PasswordResetToken" ADD COLUMN "id" SERIAL;
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id");
ALTER TABLE "PasswordResetToken" DROP COLUMN "__old_id";

ALTER TABLE "Friendship" DROP CONSTRAINT "Friendship_pkey";
ALTER TABLE "Friendship" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "Friendship" ADD COLUMN "id" SERIAL;
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id");
ALTER TABLE "Friendship" DROP COLUMN "__old_id";

ALTER TABLE "Block" DROP CONSTRAINT "Block_pkey";
ALTER TABLE "Block" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "Block" ADD COLUMN "id" SERIAL;
ALTER TABLE "Block" ADD CONSTRAINT "Block_pkey" PRIMARY KEY ("id");
ALTER TABLE "Block" DROP COLUMN "__old_id";

ALTER TABLE "Group" DROP CONSTRAINT "Group_pkey";
ALTER TABLE "Group" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "Group" ADD COLUMN "id" SERIAL;
ALTER TABLE "Group" ADD CONSTRAINT "Group_pkey" PRIMARY KEY ("id");
ALTER TABLE "Group" DROP COLUMN "__old_id";

ALTER TABLE "GroupMember" DROP CONSTRAINT "GroupMember_pkey";
ALTER TABLE "GroupMember" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "GroupMember" ADD COLUMN "id" SERIAL;
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id");
ALTER TABLE "GroupMember" DROP COLUMN "__old_id";

ALTER TABLE "GroupInvite" DROP CONSTRAINT "GroupInvite_pkey";
ALTER TABLE "GroupInvite" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "GroupInvite" ADD COLUMN "id" SERIAL;
ALTER TABLE "GroupInvite" ADD CONSTRAINT "GroupInvite_pkey" PRIMARY KEY ("id");
ALTER TABLE "GroupInvite" DROP COLUMN "__old_id";

ALTER TABLE "GroupChat" DROP CONSTRAINT "GroupChat_pkey";
ALTER TABLE "GroupChat" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "GroupChat" ADD COLUMN "id" SERIAL;
ALTER TABLE "GroupChat" ADD CONSTRAINT "GroupChat_pkey" PRIMARY KEY ("id");
ALTER TABLE "GroupChat" DROP COLUMN "__old_id";

ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_pkey";
ALTER TABLE "Conversation" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "Conversation" ADD COLUMN "id" SERIAL;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id");
ALTER TABLE "Conversation" DROP COLUMN "__old_id";

ALTER TABLE "ConversationParticipant" DROP CONSTRAINT "ConversationParticipant_pkey";
ALTER TABLE "ConversationParticipant" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "ConversationParticipant" ADD COLUMN "id" SERIAL;
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id");
ALTER TABLE "ConversationParticipant" DROP COLUMN "__old_id";

ALTER TABLE "Message" DROP CONSTRAINT "Message_pkey";
ALTER TABLE "Message" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "Message" ADD COLUMN "id" SERIAL;
ALTER TABLE "Message" ADD CONSTRAINT "Message_pkey" PRIMARY KEY ("id");
ALTER TABLE "Message" DROP COLUMN "__old_id";

ALTER TABLE "MessageReaction" DROP CONSTRAINT "MessageReaction_pkey";
ALTER TABLE "MessageReaction" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "MessageReaction" ADD COLUMN "id" SERIAL;
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id");
ALTER TABLE "MessageReaction" DROP COLUMN "__old_id";

ALTER TABLE "PinnedMessage" DROP CONSTRAINT "PinnedMessage_pkey";
ALTER TABLE "PinnedMessage" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "PinnedMessage" ADD COLUMN "id" SERIAL;
ALTER TABLE "PinnedMessage" ADD CONSTRAINT "PinnedMessage_pkey" PRIMARY KEY ("id");
ALTER TABLE "PinnedMessage" DROP COLUMN "__old_id";

ALTER TABLE "Event" DROP CONSTRAINT "Event_pkey";
ALTER TABLE "Event" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "Event" ADD COLUMN "id" SERIAL;
ALTER TABLE "Event" ADD CONSTRAINT "Event_pkey" PRIMARY KEY ("id");
ALTER TABLE "Event" DROP COLUMN "__old_id";

ALTER TABLE "EventParticipant" DROP CONSTRAINT "EventParticipant_pkey";
ALTER TABLE "EventParticipant" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "EventParticipant" ADD COLUMN "id" SERIAL;
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("id");
ALTER TABLE "EventParticipant" DROP COLUMN "__old_id";

ALTER TABLE "Favorite" DROP CONSTRAINT "Favorite_pkey";
ALTER TABLE "Favorite" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "Favorite" ADD COLUMN "id" SERIAL;
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id");
ALTER TABLE "Favorite" DROP COLUMN "__old_id";

ALTER TABLE "Location" DROP CONSTRAINT "Location_pkey";
ALTER TABLE "Location" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "Location" ADD COLUMN "id" SERIAL;
ALTER TABLE "Location" ADD CONSTRAINT "Location_pkey" PRIMARY KEY ("id");
ALTER TABLE "Location" DROP COLUMN "__old_id";

ALTER TABLE "MeetingPoint" DROP CONSTRAINT "MeetingPoint_pkey";
ALTER TABLE "MeetingPoint" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "MeetingPoint" ADD COLUMN "id" SERIAL;
ALTER TABLE "MeetingPoint" ADD CONSTRAINT "MeetingPoint_pkey" PRIMARY KEY ("id");
ALTER TABLE "MeetingPoint" DROP COLUMN "__old_id";

ALTER TABLE "MeetingPointShare" DROP CONSTRAINT "MeetingPointShare_pkey";
ALTER TABLE "MeetingPointShare" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "MeetingPointShare" ADD COLUMN "id" SERIAL;
ALTER TABLE "MeetingPointShare" ADD CONSTRAINT "MeetingPointShare_pkey" PRIMARY KEY ("id");
ALTER TABLE "MeetingPointShare" DROP COLUMN "__old_id";

ALTER TABLE "Report" DROP CONSTRAINT "Report_pkey";
ALTER TABLE "Report" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "Report" ADD COLUMN "id" SERIAL;
ALTER TABLE "Report" ADD CONSTRAINT "Report_pkey" PRIMARY KEY ("id");
ALTER TABLE "Report" DROP COLUMN "__old_id";

ALTER TABLE "Notification" DROP CONSTRAINT "Notification_pkey";
ALTER TABLE "Notification" RENAME COLUMN "id" TO "__old_id";
ALTER TABLE "Notification" ADD COLUMN "id" SERIAL;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_pkey" PRIMARY KEY ("id");
ALTER TABLE "Notification" DROP COLUMN "__old_id";

-- NotificationPreferences: PK é a própria FK (userId) -> converte para Int
ALTER TABLE "NotificationPreferences" DROP CONSTRAINT "NotificationPreferences_pkey";
ALTER TABLE "NotificationPreferences" ALTER COLUMN "userId" TYPE INTEGER USING ("userId"::integer);
ALTER TABLE "NotificationPreferences" ADD CONSTRAINT "NotificationPreferences_pkey" PRIMARY KEY ("userId");

-- ============================================================================
-- 4) Converte o tipo das colunas estrangeiras (FK) para INTEGER
-- ============================================================================
ALTER TABLE "RefreshToken" ALTER COLUMN "userId" TYPE INTEGER USING ("userId"::integer);
ALTER TABLE "PasswordResetToken" ALTER COLUMN "userId" TYPE INTEGER USING ("userId"::integer);
ALTER TABLE "Friendship" ALTER COLUMN "requesterId" TYPE INTEGER USING ("requesterId"::integer);
ALTER TABLE "Friendship" ALTER COLUMN "receiverId" TYPE INTEGER USING ("receiverId"::integer);
ALTER TABLE "Block" ALTER COLUMN "blockerId" TYPE INTEGER USING ("blockerId"::integer);
ALTER TABLE "Block" ALTER COLUMN "blockedId" TYPE INTEGER USING ("blockedId"::integer);
ALTER TABLE "Group" ALTER COLUMN "ownerId" TYPE INTEGER USING ("ownerId"::integer);
ALTER TABLE "GroupMember" ALTER COLUMN "groupId" TYPE INTEGER USING ("groupId"::integer);
ALTER TABLE "GroupMember" ALTER COLUMN "userId" TYPE INTEGER USING ("userId"::integer);
ALTER TABLE "GroupInvite" ALTER COLUMN "groupId" TYPE INTEGER USING ("groupId"::integer);
ALTER TABLE "GroupInvite" ALTER COLUMN "inviterId" TYPE INTEGER USING ("inviterId"::integer);
ALTER TABLE "GroupInvite" ALTER COLUMN "inviteeId" TYPE INTEGER USING ("inviteeId"::integer);
ALTER TABLE "GroupChat" ALTER COLUMN "groupId" TYPE INTEGER USING ("groupId"::integer);
ALTER TABLE "ConversationParticipant" ALTER COLUMN "conversationId" TYPE INTEGER USING ("conversationId"::integer);
ALTER TABLE "ConversationParticipant" ALTER COLUMN "userId" TYPE INTEGER USING ("userId"::integer);
ALTER TABLE "Message" ALTER COLUMN "conversationId" TYPE INTEGER USING ("conversationId"::integer);
ALTER TABLE "Message" ALTER COLUMN "groupChatId" TYPE INTEGER USING ("groupChatId"::integer);
ALTER TABLE "Message" ALTER COLUMN "senderId" TYPE INTEGER USING ("senderId"::integer);
ALTER TABLE "Message" ALTER COLUMN "replyToId" TYPE INTEGER USING ("replyToId"::integer);
ALTER TABLE "MessageReaction" ALTER COLUMN "messageId" TYPE INTEGER USING ("messageId"::integer);
ALTER TABLE "MessageReaction" ALTER COLUMN "userId" TYPE INTEGER USING ("userId"::integer);
ALTER TABLE "PinnedMessage" ALTER COLUMN "messageId" TYPE INTEGER USING ("messageId"::integer);
ALTER TABLE "PinnedMessage" ALTER COLUMN "userId" TYPE INTEGER USING ("userId"::integer);
ALTER TABLE "PinnedMessage" ALTER COLUMN "groupChatId" TYPE INTEGER USING ("groupChatId"::integer);
ALTER TABLE "EventParticipant" ALTER COLUMN "eventId" TYPE INTEGER USING ("eventId"::integer);
ALTER TABLE "EventParticipant" ALTER COLUMN "userId" TYPE INTEGER USING ("userId"::integer);
ALTER TABLE "Favorite" ALTER COLUMN "userId" TYPE INTEGER USING ("userId"::integer);
ALTER TABLE "Favorite" ALTER COLUMN "eventId" TYPE INTEGER USING ("eventId"::integer);
ALTER TABLE "Location" ALTER COLUMN "userId" TYPE INTEGER USING ("userId"::integer);
ALTER TABLE "MeetingPoint" ALTER COLUMN "eventId" TYPE INTEGER USING ("eventId"::integer);
ALTER TABLE "MeetingPoint" ALTER COLUMN "createdById" TYPE INTEGER USING ("createdById"::integer);
ALTER TABLE "MeetingPointShare" ALTER COLUMN "meetingPointId" TYPE INTEGER USING ("meetingPointId"::integer);
ALTER TABLE "MeetingPointShare" ALTER COLUMN "sharedWithId" TYPE INTEGER USING ("sharedWithId"::integer);
ALTER TABLE "Report" ALTER COLUMN "reporterId" TYPE INTEGER USING ("reporterId"::integer);
ALTER TABLE "Report" ALTER COLUMN "reportedId" TYPE INTEGER USING ("reportedId"::integer);
ALTER TABLE "Notification" ALTER COLUMN "userId" TYPE INTEGER USING ("userId"::integer);

-- Índice extra sobre "id" (Conversation) é removido junto da coluna antiga:
CREATE INDEX "Conversation_id_idx" ON "Conversation"("id");

-- ============================================================================
-- 5) Recria todas as foreign keys
-- ============================================================================
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Group" ADD CONSTRAINT "Group_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupInvite" ADD CONSTRAINT "GroupInvite_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupInvite" ADD CONSTRAINT "GroupInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupInvite" ADD CONSTRAINT "GroupInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupChat" ADD CONSTRAINT "GroupChat_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_groupChatId_fkey" FOREIGN KEY ("groupChatId") REFERENCES "GroupChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PinnedMessage" ADD CONSTRAINT "PinnedMessage_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PinnedMessage" ADD CONSTRAINT "PinnedMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PinnedMessage" ADD CONSTRAINT "PinnedMessage_groupChatId_fkey" FOREIGN KEY ("groupChatId") REFERENCES "GroupChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Location" ADD CONSTRAINT "Location_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingPoint" ADD CONSTRAINT "MeetingPoint_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MeetingPoint" ADD CONSTRAINT "MeetingPoint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingPointShare" ADD CONSTRAINT "MeetingPointShare_meetingPointId_fkey" FOREIGN KEY ("meetingPointId") REFERENCES "MeetingPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingPointShare" ADD CONSTRAINT "MeetingPointShare_sharedWithId_fkey" FOREIGN KEY ("sharedWithId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationPreferences" ADD CONSTRAINT "NotificationPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;