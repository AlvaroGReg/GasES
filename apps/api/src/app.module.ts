import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { SnapshotsService } from './snapshots.service';

@Module({
  controllers: [AppController],
  providers: [SnapshotsService],
})
export class AppModule {}
