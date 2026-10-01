import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiCookieAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user/current-user.decorator.js';
import { StorageService } from '../storage/storage.service.js';
import { CvsService } from '../cvs/cvs.service.js';
import { UploadCvBodyDto } from './dto/upload-cv-body.dto.js';

/** Allowed MIME types for CV uploads */
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

@ApiTags('Upload')
@ApiCookieAuth('accessToken')
@Controller('upload')
export class UploadController {
  constructor(
    private readonly storageService: StorageService,
    private readonly cvsService: CvsService,
  ) {}

  @Post('cv')
  @ApiOperation({ summary: 'Upload a CV file (PDF or DOCX, max 10 MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'CV file + metadata',
    schema: {
      type: 'object',
      required: ['file', 'label'],
      properties: {
        file: { type: 'string', format: 'binary' },
        label: { type: 'string', example: 'Backend NodeJS' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          example: ['nodejs', 'backend'],
        },
        isDefault: { type: 'boolean' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(), // buffer in memory; we persist in StorageService
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  async uploadCv(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadCvBodyDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded — include a "file" field');
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Allowed: PDF, DOCX, DOC`,
      );
    }

    // Persist to disk (or S3 — depends on bound StorageService)
    const stored = await this.storageService.saveFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // Create CV metadata record scoped to this user
    const cv = await this.cvsService.create(userId, body, {
      filename: stored.filename,
      storagePath: stored.storagePath,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
    });

    return { cv, url: stored.url };
  }
}
