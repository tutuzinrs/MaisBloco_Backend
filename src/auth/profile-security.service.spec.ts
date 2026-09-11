import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../common/mail/mail.service';
jest.mock('@nestjs/common', () => require('../test/mock-nest-common'));
jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('new-hash'),
}));
describe('Profile editing and password changes', () => {
  const db = {
    user: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    refreshToken: { deleteMany: jest.fn() },
    passwordResetToken: { deleteMany: jest.fn() },
  };
  let service: AuthService;
  const dto = {
    currentPassword: 'OldSecret1!',
    password: 'NewSecret1!',
    passwordConfirmation: 'NewSecret1!',
  };
  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      {
        ...db,
        $transaction: (work: (tx: typeof db) => unknown) => work(db),
      } as unknown as PrismaService,
      {} as JwtService,
      {} as MailService,
    );
    db.user.findUnique.mockResolvedValue({
      id: 'me',
      passwordHash: 'old-hash',
      authProvider: 'LOCAL',
    });
  });
  it('does not modify a password when the current password is wrong', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(service.changePassword('me', dto)).rejects.toMatchObject({
      status: 400,
    });
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
  it('does not permit password changes for social accounts', async () => {
    db.user.findUnique.mockResolvedValue({
      authProvider: 'GOOGLE',
      passwordHash: null,
    });
    await expect(service.changePassword('me', dto)).rejects.toMatchObject({
      status: 400,
    });
  });
  it('revokes refresh and reset tokens after a valid change', async () => {
    (bcrypt.compare as jest.Mock)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    db.user.updateMany.mockResolvedValue({ count: 1 });
    await service.changePassword('me', dto);
    expect(db.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'me' },
    });
    expect(db.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'me' },
    });
    expect(db.user.updateMany.mock.calls[0][0].data.passwordHash).toBe(
      'new-hash',
    );
  });
  it('requires matching strong passwords', async () => {
    await expect(
      service.changePassword('me', {
        ...dto,
        passwordConfirmation: 'mismatch',
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.changePassword('me', {
        ...dto,
        password: 'weak',
        passwordConfirmation: 'weak',
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
  it('only writes allowed profile fields and never serializes the hash', async () => {
    db.user.update.mockResolvedValue({
      id: 'me',
      name: 'Updated',
      passwordHash: 'secret',
      phone: null,
      birthDate: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      city: 'Recife',
      locationSharingLevel: 'PRIVATE',
    });
    const result = await service.updateProfile('me', {
      name: 'Updated',
      city: 'Recife',
      passwordHash: 'attack',
      authProvider: 'GOOGLE',
    } as never);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'me' },
      data: { name: 'Updated', city: 'Recife' },
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(result.city).toBe('Recife');
  });
});
