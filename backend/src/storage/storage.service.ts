import { Injectable } from '@nestjs/common';

export interface UploadResult {
  filename: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

/**
 * StorageService — interface-level contract.
 * Swap LocalDiskStorageService for S3StorageService later with zero controller changes.
 */
@Injectable()
export abstract class StorageService {
  abstract saveFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<UploadResult>;

  abstract deleteFile(storagePath: string): Promise<void>;

  abstract getPublicUrl(storagePath: string): string;
}
