import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, Length, MaxLength } from 'class-validator';

export class WeChatMiniLoginDto {
  @ApiProperty({ description: 'wx.login 返回的一次性 code' })
  @IsString()
  @Length(1, 256)
  code!: string;

  @ApiProperty({ description: '客户端生成并持久化的设备 UUID' })
  @IsUUID()
  deviceId!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  deviceName = 'WeChat Mini Program';
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @Length(40, 512)
  refreshToken!: string;
}
