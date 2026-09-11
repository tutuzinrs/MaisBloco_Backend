import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  NotificationPreferencesDto,
  PrivacyDto,
  UpdateProfileDto,
} from './profile.dto';
describe('Profile DTO boundaries', () => {
  it('rejects internal properties and null required values', () => {
    expect(
      validateSync(
        plainToInstance(UpdateProfileDto, {
          name: null,
          authProvider: 'GOOGLE',
        }),
        { whitelist: true, forbidNonWhitelisted: true },
      ).map((e) => e.property),
    ).toEqual(expect.arrayContaining(['name', 'authProvider']));
  });
  it('normalizes names and usernames before validation', () => {
    const dto = plainToInstance(UpdateProfileDto, {
      name: '  Ana Silva  ',
      username: '@ANA.SILVA',
    });
    expect(validateSync(dto)).toHaveLength(0);
    expect(dto).toMatchObject({ name: 'Ana Silva', username: 'ana.silva' });
  });
  it('rejects invalid privacy levels and non-boolean preferences', () => {
    expect(
      validateSync(
        plainToInstance(PrivacyDto, { locationSharingLevel: 'everyone' }),
      ),
    ).not.toHaveLength(0);
    expect(
      validateSync(
        plainToInstance(NotificationPreferencesDto, { messages: 'false' }),
      ),
    ).not.toHaveLength(0);
    expect(
      validateSync(
        plainToInstance(NotificationPreferencesDto, { messages: false }),
      ),
    ).toHaveLength(0);
  });
});
