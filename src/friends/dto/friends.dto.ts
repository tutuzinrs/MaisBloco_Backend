import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export class FriendsQueryDto {
  @IsOptional() @IsIn(['friends', 'received', 'sent']) tab:
    'friends' | 'received' | 'sent' = 'friends';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}
export class FriendTargetDto {
  @Type(() => Number) @IsInt() userId: number;
}
export class FriendActionDto {
  @IsIn(['accept', 'reject']) action: 'accept' | 'reject';
}
