import { NotificationsService } from "./notifications.service";
import { FriendsService } from "../friends/friends.service";
import { GroupInvitesService } from "../groups/group-invites.service";
import { GroupsService } from "../groups/groups.service";
jest.mock("@nestjs/common", () => require("../test/mock-nest-common"));

const actor = (id: number) => ({
  id,
  name: `Pessoa ${id}`,
  username: `p${id}`,
  avatar: null,
  status: "ACTIVE",
});
const invite = () => ({
  id: 10,
  groupId: 5,
  inviterId: 1,
  inviteeId: 2,
  status: "PENDING",
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  inviter: actor(1),
  invitee: actor(2),
});

function setup() {
  const tx: any = {
    notificationPreferences: { findUnique: jest.fn().mockResolvedValue(null) },
    notification: {
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue(actor(2)),
      findUnique: jest.fn(({ where }) => Promise.resolve(actor(where.id))),
    },
    block: { findFirst: jest.fn().mockResolvedValue(null) },
    friendship: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 9 }),
      update: jest.fn(),
      delete: jest.fn(),
    },
    group: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 5, name: "Bloco", ownerId: 1 }),
    },
    groupMember: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    groupInvite: {
      findUnique: jest.fn().mockResolvedValue(invite()),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(invite()),
      update: jest.fn().mockResolvedValue(invite()),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn(),
    },
  };
  tx.$transaction = jest.fn((work) => work(tx));
  const notifications = new NotificationsService(tx);
  const groups = new GroupsService(tx, notifications);
  jest
    .spyOn(groups, "requireMembership")
    .mockResolvedValue({ id: 1, role: "OWNER" } as never);
  jest
    .spyOn(groups, "requireGroup")
    .mockResolvedValue({ id: 5, name: "Bloco" } as never);
  return {
    tx,
    notifications,
    groups,
    friends: new FriendsService(tx, notifications),
    invites: new GroupInvitesService(tx, groups, notifications),
  };
}

function expectDelivery(tx: any, userId: number, type: string) {
  expect(tx.notification.create).toHaveBeenCalledTimes(1);
  expect(tx.notification.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      userId,
      data: expect.objectContaining({ type }),
    }),
  });
}

describe("notification delivery from real domain services", () => {
  it("delivers a friend request to its recipient", async () => {
    const { tx, friends } = setup();
    await friends.request(1, 2);
    expectDelivery(tx, 2, "FRIEND_REQUEST");
  });
  it.each(["accept", "reject"] as const)(
    "delivers friend %s to the original requester",
    async (action) => {
      const { tx, friends } = setup();
      tx.friendship.findFirst.mockResolvedValue({
        id: 9,
        requesterId: 1,
        receiverId: 2,
      });
      await friends.respond(2, 9, action);
      expectDelivery(
        tx,
        1,
        action === "accept" ? "FRIEND_ACCEPTED" : "FRIEND_REJECTED",
      );
    },
  );
  it("deduplicates recipient IDs and delivers the group invitation", async () => {
    const { tx, invites } = setup();
    await invites.create(1, 5, { userIds: [2, 2] });
    expectDelivery(tx, 2, "GROUP_INVITE");
  });
  it("delivers a reissued invitation", async () => {
    const { tx, invites } = setup();
    tx.groupInvite.findFirst.mockResolvedValue({
      ...invite(),
      status: "REJECTED",
    });
    await invites.create(1, 5, { userIds: [2] });
    expectDelivery(tx, 2, "GROUP_INVITE");
  });
  it("delivers acceptance to the inviter and creates membership", async () => {
    const { tx, invites } = setup();
    await invites.accept(2, 10);
    expectDelivery(tx, 1, "GROUP_INVITE_ACCEPTED");
    expect(tx.groupMember.create).toHaveBeenCalled();
  });
  it("does not notify or add a member when another request already claimed acceptance", async () => {
    const { tx, invites } = setup();
    tx.groupInvite.updateMany.mockResolvedValue({ count: 0 });
    await expect(invites.accept(2, 10)).rejects.toMatchObject({ status: 409 });
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.groupMember.create).not.toHaveBeenCalled();
  });
  it("delivers group rejection to the inviter", async () => {
    const { tx, invites } = setup();
    await invites.reject(2, 10);
    expectDelivery(tx, 1, "GROUP_INVITE_REJECTED");
  });
  it("delivers cancellation to the invitee", async () => {
    const { tx, invites } = setup();
    tx.groupInvite.findFirst.mockResolvedValue(invite());
    await invites.cancel(1, 5, 10);
    expectDelivery(tx, 2, "GROUP_INVITE_CANCELLED");
  });
  it("does not notify when a concurrent cancellation has already won", async () => {
    const { tx, invites } = setup();
    tx.groupInvite.findFirst.mockResolvedValue(invite());
    tx.groupInvite.updateMany.mockResolvedValue({ count: 0 });
    await expect(invites.cancel(1, 5, 10)).rejects.toMatchObject({
      status: 409,
    });
    expect(tx.notification.create).not.toHaveBeenCalled();
  });
  it("honors the recipient preference without failing invitation creation", async () => {
    const { tx, invites } = setup();
    tx.notificationPreferences.findUnique.mockResolvedValue({
      groupInvites: false,
    });
    await invites.create(1, 5, { userIds: [2] });
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.groupInvite.create).toHaveBeenCalled();
  });
  it("propagates delivery persistence failures to the surrounding transaction", async () => {
    const { tx, invites } = setup();
    tx.notification.create.mockRejectedValue(new Error("database unavailable"));
    await expect(invites.accept(2, 10)).rejects.toThrow("database unavailable");
    expect(tx.$transaction).toHaveBeenCalled();
  });
});

describe("notification inbox ownership and preferences", () => {
  it("restricts mark-read to the authenticated recipient", async () => {
    const { tx, notifications } = setup();
    tx.notification.updateMany.mockResolvedValue({ count: 0 });
    await expect(notifications.markRead(2, 10)).rejects.toMatchObject({
      status: 404,
    });
    expect(tx.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 10, userId: 2 },
      data: { read: true },
    });
  });
  it("marks only the authenticated recipient unread items", async () => {
    const { tx, notifications } = setup();
    await notifications.markAllRead(2);
    expect(tx.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 2, read: false },
      data: { read: true },
    });
  });
  it("lists only the recipient notifications with stable pagination", async () => {
    const { tx, notifications } = setup();
    await notifications.list(2, { page: 2, limit: 20 });
    expect(tx.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 2 },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: 20,
      take: 20,
    });
  });
});

describe("membership notifications persist with the membership mutation", () => {
  it("notifies the member added directly by an administrator", async () => {
    const { tx, groups } = setup();
    tx.groupMember.create.mockResolvedValue({
      role: "MEMBER",
      joinedAt: new Date(),
    });
    await groups.addMember(1, 5, 2);
    expectDelivery(tx, 2, "GROUP_MEMBER_ADDED");
    expect(tx.$transaction).toHaveBeenCalled();
  });
  it("notifies the owner when a member leaves", async () => {
    const { tx, groups } = setup();
    (groups.requireMembership as jest.Mock).mockResolvedValue({
      id: 3,
      role: "MEMBER",
    });
    await groups.leave(2, 5);
    expectDelivery(tx, 1, "GROUP_MEMBER_LEFT");
    expect(tx.$transaction).toHaveBeenCalled();
  });
  it("notifies the removed member", async () => {
    const { tx, groups } = setup();
    tx.groupMember.findUnique.mockResolvedValue({ id: 3, role: "MEMBER" });
    await groups.removeMember(1, 5, 2);
    expectDelivery(tx, 2, "GROUP_MEMBER_REMOVED");
  });
  it("notifies a member when their role changes", async () => {
    const { tx, groups } = setup();
    tx.groupMember.findUnique.mockResolvedValue({ id: 3, role: "MEMBER" });
    tx.groupMember.update.mockResolvedValue({
      role: "ADMIN",
      user: actor(2),
      joinedAt: new Date(),
    });
    await groups.changeRole(1, 5, 2, "ADMIN");
    expectDelivery(tx, 2, "GROUP_ROLE_CHANGED");
  });
  it("does not notify for an unchanged role", async () => {
    const { tx, groups } = setup();
    tx.groupMember.findUnique.mockResolvedValue({ id: 3, role: "ADMIN" });
    tx.groupMember.update.mockResolvedValue({
      role: "ADMIN",
      user: actor(2),
      joinedAt: new Date(),
    });
    await groups.changeRole(1, 5, 2, "ADMIN");
    expect(tx.notification.create).not.toHaveBeenCalled();
  });
  it("notifies members of group information changes", async () => {
    const { tx, groups } = setup();
    tx.group.findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue({ name: "Antigo", description: null, avatar: null });
    tx.group.update = jest
      .fn()
      .mockResolvedValue({
        id: 5,
        name: "Novo",
        description: null,
        avatar: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    tx.groupMember.findMany = jest.fn().mockResolvedValue([{ userId: 2 }]);
    tx.groupMember.count = jest.fn().mockResolvedValue(2);
    await groups.update(1, 5, { name: "Novo" });
    expectDelivery(tx, 2, "GROUP_UPDATED");
    expect(tx.groupMember.findMany).toHaveBeenCalledWith({
      where: { groupId: 5, userId: { not: 1 } },
      select: { userId: true },
    });
  });
  it("propagates a membership notification failure so the transaction can roll back", async () => {
    const { tx, groups } = setup();
    tx.groupMember.findUnique.mockResolvedValue({ id: 3, role: "MEMBER" });
    tx.notification.create.mockRejectedValue(new Error("write failed"));
    await expect(groups.removeMember(1, 5, 2)).rejects.toThrow("write failed");
    expect(tx.$transaction).toHaveBeenCalled();
  });
});
