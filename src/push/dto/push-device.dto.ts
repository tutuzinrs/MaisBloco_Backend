import { IsIn, IsString, IsUUID, Matches } from 'class-validator';

export class RevokePushDeviceDto {
  @IsUUID('4')
  deviceId!: string;

  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  secret!: string;
}

export class RegisterPushDeviceDto extends RevokePushDeviceDto {
  @IsString()
  @Matches(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$/)
  token!: string;

  @IsIn(['android', 'ios'])
  platform!: 'android' | 'ios';
}
