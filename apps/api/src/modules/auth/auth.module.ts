import { Module } from '@nestjs/common';
import { AccessModule } from '../../shared/auth/access.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { WebAuthController } from './web-auth.controller';

@Module({ imports: [AccessModule], controllers: [AuthController, WebAuthController], providers: [AuthService] })
export class AuthModule {}
