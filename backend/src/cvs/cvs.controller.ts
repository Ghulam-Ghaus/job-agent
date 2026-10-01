import { Body, Controller, Delete, Get, Param, Patch } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CvsService } from './cvs.service.js';
import { UpdateCvDto } from './dto/update-cv.dto.js';
import { CurrentUser } from '../auth/decorators/current-user/current-user.decorator.js';

@ApiTags('CVs')
@ApiCookieAuth('accessToken')
@Controller('cvs')
export class CvsController {
  constructor(private readonly cvsService: CvsService) {}

  /** File uploads are handled via /api/v1/upload/cv (multipart) — this endpoint is read/update/delete only. */
  @Get()
  @ApiOperation({ summary: 'List my CVs' })
  findAll(@CurrentUser('id') userId: string) {
    return this.cvsService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single CV record' })
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.cvsService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update CV label / tags / isDefault' })
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateCvDto,
  ) {
    return this.cvsService.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a CV record' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.cvsService.remove(id, userId);
  }
}
