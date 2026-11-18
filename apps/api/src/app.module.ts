import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PriceDataService } from './price-data.service';
import { SnapshotsService } from './snapshots.service';

@Module({
  controllers: [AppController],
  providers: [PriceDataService, SnapshotsService],
})
export class AppModule {}
