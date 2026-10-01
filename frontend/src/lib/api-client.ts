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

export interface Profile {
  id: string;
  userId: string;
  fullName?: string;
  headline?: string;
  summary?: string;
  phone?: string;
  location?: string;
  country?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  languages: { language: string; level: string }[];
  visaStatus?: string;
  noticePeriodDays?: number;
  willingToRelocate?: boolean;
  relocationCountries: string[];
  telegramChatId?: string;
  onboardingDone?: boolean;
}

export interface Skill {
  id: string;
  name: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT';
  yearsOfExp?: number;
  category?: string;
}

export interface Experience {
  id: string;
  title: string;
  company: string;
  location?: string;
  country?: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  bullets: string[];
  techStack: string[];
}

export interface JobPreference {
  id: string;
  targetRoles: string[];
  targetCountries: string[];
  minSalaryUsd?: number;
  remoteOk: boolean;
  blacklistCompanies: string[];
  blacklistKeywords: string[];
  preferredIndustries: string[];
}

export interface Cv {
  id: string;
  label: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  tags: string[];
  isDefault: boolean;
  createdAt: string;
  url?: string;
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

/** Upload a file via multipart/form-data — do NOT set Content-Type manually */
async function uploadFile<T>(endpoint: string, formData: FormData): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMsg =
      json?.error?.message ||
      json?.message ||
      `Upload failed with status ${response.status}`;
    throw new ApiClientError(response.status, errorMsg, json);
  }
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

  patch: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
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

  profile: {
    get: () => api.get<Profile>('/profile'),
    upsert: (data: Partial<Profile>) => api.put<Profile>('/profile', data),
  },

  skills: {
    list: () => api.get<Skill[]>('/skills'),
    create: (data: Omit<Skill, 'id'>) => api.post<Skill>('/skills', data),
    update: (id: string, data: Partial<Skill>) =>
      api.patch<Skill>(`/skills/${id}`, data),
    delete: (id: string) => api.delete<void>(`/skills/${id}`),
  },

  experience: {
    list: () => api.get<Experience[]>('/experience'),
    create: (data: Omit<Experience, 'id'>) =>
      api.post<Experience>('/experience', data),
    update: (id: string, data: Partial<Experience>) =>
      api.patch<Experience>(`/experience/${id}`, data),
    delete: (id: string) => api.delete<void>(`/experience/${id}`),
  },

  preferences: {
    get: () => api.get<JobPreference | null>('/preferences'),
    upsert: (data: Partial<JobPreference>) =>
      api.put<JobPreference>('/preferences', data),
  },

  cvs: {
    list: () => api.get<Cv[]>('/cvs'),
    upload: (formData: FormData) =>
      uploadFile<{ cv: Cv; url: string }>('/upload/cv', formData),
    update: (
      id: string,
      data: { label?: string; tags?: string[]; isDefault?: boolean },
    ) => api.patch<Cv>(`/cvs/${id}`, data),
    delete: (id: string) => api.delete<void>(`/cvs/${id}`),
  },

  health: {
    check: () => api.get<{ status: string }>('/health'),
  },
};
