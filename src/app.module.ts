import { FriendsModule } from './friends/friends.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BlocosModule } from './blocos/blocos.module';
import { EventsModule } from './events/events.module';
import { GroupsModule } from './groups/groups.module';
import { LocationsModule } from './locations/locations.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    BlocosModule,
    EventsModule,
    GroupsModule,
    LocationsModule,
    UsersModule,
    FriendsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}