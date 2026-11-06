import { Module } from '@nestjs/common';
import { AccessModule } from '../../shared/auth/access.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({ imports: [AccessModule], controllers: [AuthController], providers: [AuthService] })
export class AuthModule {}
