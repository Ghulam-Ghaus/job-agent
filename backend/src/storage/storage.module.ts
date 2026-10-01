import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service.js';
import { LocalDiskStorageService } from './local-disk-storage.service.js';

@Global()
@Module({
  providers: [
    {
      provide: StorageService,
      useClass: LocalDiskStorageService,
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
