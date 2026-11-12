import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { AccessModule } from '../../shared/auth/access.module';
import { CommercialController } from './commercial.controller';
import { CommercialRepository } from './commercial.repository';
import { CommercialService } from './commercial.service';

@Module({ imports: [DatabaseModule, AccessModule], controllers: [CommercialController], providers: [CommercialRepository, CommercialService] })
export class CommercialModule {}
