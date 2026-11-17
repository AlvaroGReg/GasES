import { Controller, Get, Query } from '@nestjs/common';
import { SnapshotsService } from './snapshots.service';

@Controller()
export class AppController {
  constructor(private readonly snapshotsService: SnapshotsService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('snapshots')
  listSnapshots(@Query('limit') limit?: string) {
    return this.snapshotsService.list(Number(limit));
  }

  @Get('snapshots/latest')
  latestSnapshot() {
    return this.snapshotsService.latest();
  }
}
