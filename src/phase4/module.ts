import { Module } from '@nestjs/common';
import {
  ClientLookupController,
  DistributedOrdersController,
} from './controller';
import { DistributedOrders } from './service';
import { OrderStore } from './store';
import { SagaWorker } from './worker';
import { ReportsController } from './reports';
import { DistributedInventoryController } from './inventory.controller';

@Module({
  controllers: [
    ReportsController,
    DistributedInventoryController,
    DistributedOrdersController,
    ClientLookupController,
  ],
  providers: [DistributedOrders, OrderStore, SagaWorker],
})
export class Phase4Module {}
