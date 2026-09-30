export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
}

export interface User {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'USER';
}

export interface LoginPayload {
  email: string;
  password: string;
}

export class ApiClientError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public raw?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Automatically send and receive HTTP-only cookies
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg =
      json?.error?.message ||
      json?.message ||
      `Request failed with status ${response.status}`;
    throw new ApiClientError(response.status, errorMsg, json);
  }

  // ResponseInterceptor wraps success in { success: true, data: T }
  return (json && 'data' in json ? json.data : json) as T;
}

export const api = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),

  auth: {
    login: (credentials: LoginPayload) =>
      api.post<{ user: User }>('/auth/login', credentials),

    refresh: () => api.post<{ user: User }>('/auth/refresh'),

    logout: () => api.post<{ message: string }>('/auth/logout'),

    me: () => api.get<{ user: User }>('/auth/me'),
  },

  health: {
    check: () => api.get<{ status: string }>('/health'),
  },
};
