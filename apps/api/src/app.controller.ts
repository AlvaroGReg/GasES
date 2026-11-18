import { Controller, Get, Query } from '@nestjs/common';
import { PriceDataService } from './price-data.service';
import { SnapshotsService } from './snapshots.service';

@Controller()
export class AppController {
  constructor(
    private readonly snapshotsService: SnapshotsService,
    private readonly priceDataService: PriceDataService,
  ) {}

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

  @Get('prices/latest')
  latestPrices() {
    return this.priceDataService.latest();
  }

  @Get('prices/history')
  priceHistory(
    @Query('provinceId') provinceId?: string,
    @Query('period') period?: string,
  ) {
    return this.priceDataService.history(provinceId, period);
  }

  @Get('prices/observations')
  recentPriceObservations(@Query('limit') limit?: string) {
    const parsedLimit = limit === undefined ? undefined : Number(limit);
    return this.priceDataService.recentObservations(parsedLimit);
  }
}
