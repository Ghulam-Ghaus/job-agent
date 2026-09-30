import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  requestId?: string;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const requestId = context
      .switchToHttp()
      .getRequest<{ requestId?: string }>().requestId;

    return next.handle().pipe(
      map((data: T) => ({
        success: true,
        data,
        requestId,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
