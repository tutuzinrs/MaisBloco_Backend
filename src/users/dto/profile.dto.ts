import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LocationSharingLevel } from '@prisma/client';

export class UpdateProfileDto {
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Matches(/^[a-z0-9_.]{3,30}$/)
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().toLowerCase().replace(/^@/, '')
      : value,
  )
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;
}

export class PrivacyDto {
  @IsEnum(LocationSharingLevel)
  locationSharingLevel: LocationSharingLevel;
}

export class NotificationPreferencesDto {
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() friendRequests?: boolean;
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() groupInvites?: boolean;
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() messages?: boolean;
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() groupActivity?: boolean;
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() favoriteEvents?: boolean;
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() eventReminders?: boolean;
}

export class MyEventsQueryDto {
  @IsOptional()
  @IsIn(['favorites', 'confirmed', 'history'])
  filter: 'favorites' | 'confirmed' | 'history' = 'favorites';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}
