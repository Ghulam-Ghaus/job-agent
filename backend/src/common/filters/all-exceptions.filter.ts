import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Prisma 7 — KnownRequestError lives on @prisma/client runtime
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const { status, message } = this.resolveException(exception);

    this.logger.error(
      { requestId: request.requestId, path: request.url, status, message },
      'Unhandled exception',
    );

    response.status(status).json({
      success: false,
      error: { message, statusCode: status },
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private resolveException(exception: unknown): { status: number; message: string } {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      let message: string;
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null && 'message' in res) {
        const m = (res as Record<string, unknown>).message;
        message = Array.isArray(m) ? m.join(', ') : String(m);
      } else {
        message = exception.message;
      }
      return { status: exception.getStatus(), message };
    }

    if (exception instanceof PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { status: HttpStatus.CONFLICT, message: 'A record with this value already exists.' };
      }
      if (exception.code === 'P2025') {
        return { status: HttpStatus.NOT_FOUND, message: 'Record not found.' };
      }
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'An unexpected error occurred.' };
  }
}
