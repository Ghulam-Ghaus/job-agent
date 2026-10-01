import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { StorageService, UploadResult } from './storage.service.js';

/**
 * LocalDiskStorageService — saves files to `uploads/` on the local filesystem.
 * Served statically at `/uploads/<filename>` via the static assets config in main.ts.
 * Replace with S3StorageService for production.
 */
@Injectable()
export class LocalDiskStorageService extends StorageService {
  private readonly logger = new Logger(LocalDiskStorageService.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor() {
    super();
    this.uploadDir = join(process.cwd(), 'uploads');
    this.baseUrl = process.env.API_BASE_URL ?? 'http://localhost:4000';

    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Created upload directory: ${this.uploadDir}`);
    }
  }

  async saveFile(buffer: Buffer, originalName: string, mimeType: string): Promise<UploadResult> {
    const ext = extname(originalName) || this.mimeToExt(mimeType);
    const filename = `${uuidv4()}${ext}`;
    const storagePath = join(this.uploadDir, filename);

    await writeFile(storagePath, buffer);
    this.logger.log(`Saved file: ${filename} (${buffer.length} bytes)`);

    return {
      filename,
      storagePath,
      mimeType,
      sizeBytes: buffer.length,
      url: this.getPublicUrl(filename),
    };
  }

  async deleteFile(storagePath: string): Promise<void> {
    try {
      await unlink(storagePath);
      this.logger.log(`Deleted file: ${storagePath}`);
    } catch (err) {
      this.logger.warn(`Failed to delete file: ${storagePath}`, err);
    }
  }

  getPublicUrl(storagePath: string): string {
    // storagePath may be a full path or just the filename
    const filename = storagePath.includes('/') || storagePath.includes('\\')
      ? storagePath.split(/[/\\]/).pop()!
      : storagePath;
    return `${this.baseUrl}/uploads/${filename}`;
  }

  private mimeToExt(mime: string): string {
    const map: Record<string, string> = {
      'application/pdf': '.pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/msword': '.doc',
    };
    return map[mime] ?? '';
  }
}
