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

export interface AtsTarget {
  platform: 'greenhouse' | 'lever';
  slug: string;
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
  atsTargets?: AtsTarget[];
  locationFilters?: string[];
  cvStyle?: 'AUTO' | 'GULF' | 'EUROPE';
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

export type OpportunityType = 'JOB' | 'FREELANCE' | 'LEAD';
export type OpportunityStatus =
  | 'DISCOVERED'
  | 'QUALIFIED'
  | 'DRAFT_READY'
  | 'AWAITING_APPROVAL'
  | 'APPLIED'
  | 'VIEWED'
  | 'SHORTLISTED'
  | 'REJECTED'
  | 'ARCHIVED';

export interface ScoreBreakdown {
  technical: number;
  experience: number;
  location: number;
  seniority: number;
  salary: number;
  visa: number;
  budgetFit?: number;
  clientTrust?: number;
  competition?: number;
  scopeClarity?: number;
}

export interface SkillGap {
  skill: string;
  required: boolean;
  reason: string;
}

export interface JobRequirementFields {
  title?: string;
  company?: string;
  country?: string;
  city?: string;
  remote?: boolean;
  seniority?: string;
  yearsExp?: number;
  skills?: { name: string; required: boolean; yearsExp?: number }[];
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
  visaSponsorship?: boolean;
  industry?: string;
  description?: string;
  postedAt?: string;
  isFreelance?: boolean;
  freelanceRateMin?: number;
  freelanceRateMax?: number;
  freelanceRateType?: 'HOURLY' | 'FIXED';
  clientPaymentVerified?: boolean;
  clientRating?: number;
  clientTotalSpent?: string;
  proposalsCount?: string;
  scopeClarity?: 'CLEAR' | 'MODERATE' | 'VAGUE';
}

export interface OpportunityRequirement {
  id: string;
  opportunityId: string;
  fieldsJson: JobRequirementFields;
  evidenceJson: Record<string, string>;
  promptVersion: string;
  model: string;
  extractedAt: string;
}

export interface OpportunityMatch {
  id: string;
  opportunityId: string;
  score: number;
  breakdownJson: ScoreBreakdown;
  gapsJson: SkillGap[];
  recommendedCvId: string | null;
  scoredAt: string;
}

export interface Opportunity {
  id: string;
  userId: string;
  type: OpportunityType;
  status: OpportunityStatus;
  contentHash: string;
  sourceType?: string;
  title?: string;
  company?: string;
  country?: string;
  city?: string;
  url?: string;
  rawText: string;
  language?: string;
  postedAt?: string;
  createdAt: string;
  updatedAt: string;
  requirement?: OpportunityRequirement | null;
  match?: OpportunityMatch | null;
  applyPack?: ApplyPack | null;
}

export interface VerifierIssue {
  claim: string;
  reason: string;
}

export interface ApplyPack {
  id: string;
  opportunityId: string;
  userId: string;
  coverNote: string;
  coverNoteEdited?: string | null;
  selectedCvId?: string | null;
  answersFilled: { question: string; answer: string }[];
  verifierStatus: 'pending' | 'passed' | 'flagged';
  verifierIssues: VerifierIssue[];
  createdAt: string;
  updatedAt: string;
  approval?: ApprovalRecord | null;
  opportunity?: Opportunity;
}

export interface ApprovalRecord {
  id: string;
  applyPackId: string;
  userId: string;
  decision: 'approved' | 'rejected';
  notes?: string | null;
  decidedAt: string;
}

// ─── Sprint 4: Direct Clients & Leads ─────────────────────────────────────────

export type LeadStatus =
  | 'RESEARCHING'
  | 'QUALIFIED'
  | 'DRAFT_READY'
  | 'CONTACTED'
  | 'REPLIED'
  | 'MEETING'
  | 'PROPOSAL_SENT'
  | 'WON'
  | 'LOST'
  | 'NOT_INTERESTED';

export type OutreachStatus = 'DRAFT' | 'APPROVED' | 'SENT' | 'REJECTED';

export interface NeedSignal {
  signal: string;
  evidence: string;
  severity: 'HIGH' | 'MED' | 'LOW';
}

export interface Contact {
  id: string;
  companyId: string;
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachMessage {
  id: string;
  companyId: string;
  contactId?: string | null;
  userId: string;
  channel: string;
  subject: string;
  body: string;
  status: OutreachStatus;
  sentAt?: string | null;
  openedAt?: string | null;
  repliedAt?: string | null;
  approvalId?: string | null;
  optOutToken: string;
  createdAt: string;
  updatedAt: string;
  contact?: Contact | null;
}

export interface Company {
  id: string;
  userId: string;
  name: string;
  placeId?: string | null;
  website?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  businessType?: string | null;
  status: LeadStatus;
  qualificationScore?: number | null;
  needSignalsJson: NeedSignal[];
  notes?: string | null;
  lastContactedAt?: string | null;
  nextFollowUpAt?: string | null;
  createdAt: string;
  updatedAt: string;
  contacts: Contact[];
  outreachMessages: OutreachMessage[];
}

export interface DiscoveredPlace {
  name: string;
  placeId?: string;
  website?: string;
  phone?: string;
  address?: string;
  city?: string;
  businessType?: string;
  status?: string;
}

export interface QuotaInfo {
  callsThisMonth: number;
  monthlyLimit: number;
  costThisMonthUsd: number;
  remaining: number;
}

export interface SuppressionEntry {
  id: string;
  userId: string;
  domain?: string | null;
  email?: string | null;
  reason: string;
  createdAt: string;
}

// ─── Sprint 5: Public Showcase & Admin Types ──────────────────────────────────

export interface PublicSkill {
  name: string;
  level: string;
  category?: string | null;
  yearsOfExp?: number | null;
}

export interface PublicProject {
  id: string;
  title: string;
  description: string | null;
  techStack: string[];
  url: string | null;
  repoUrl: string | null;
  highlights: string[];
  featured: boolean;
}

export interface PublicProfile {
  name: string;
  headline: string;
  summary: string;
  location: string;
  country: string | null;
  slug: string;
  skills: PublicSkill[];
  projects: PublicProject[];
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
}

export interface PublicProduct {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string;
  category: string;
  features: string[];
  priceUsd: number | null;
  priceModel: string;
  demoUrl: string | null;
  badge: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'USER';
  isActive: boolean;
  slug: string | null;
  twoFactorEnabled: boolean;
  fullName: string | null;
  headline: string | null;
  createdAt: string;
  stats: {
    opportunities: number;
    applyPacks: number;
    leads: number;
  };
}

export interface LlmMetricsSummary {
  totalCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  cacheHitRate: number;
  errorCalls: number;
}

export interface LlmMetrics {
  summary: LlmMetricsSummary;
  providers: Array<{ provider: string; count: number }>;
  models: Array<{ model: string; count: number }>;
  recentCalls: Array<{
    id: string;
    provider: string;
    model: string;
    purpose?: string | null;
    tokensIn?: number | null;
    tokensOut?: number | null;
    costUsd?: number | null;
    durationMs?: number | null;
    cached: boolean;
    status: string;
    createdAt: string;
  }>;
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  meta: unknown;
  requestId: string | null;
  ipAddress: string | null;
  createdAt: string;
  user?: { email: string; role: string } | null;
}

export interface IngestionSource {
  id: string;
  name: string;
  type: string;
  status: string;
  metrics: Record<string, number>;
  details: string;
}

export interface SourcesStatus {
  sources: IngestionSource[];
}

export interface TailoredCvContent {
  headline: string;
  summary: string;
  skills: Array<{ category: string; items: string[] }>;
  experiences: Array<{
    title: string;
    company: string;
    location?: string;
    period: string;
    bullets: string[];
    techStack: string[];
  }>;
  projects: Array<{
    title: string;
    description: string;
    highlights: string[];
    techStack: string[];
  }>;
}

export interface TailoredCv {
  id: string;
  userId: string;
  opportunityId?: string | null;
  targetRole: string;
  contentJson: TailoredCvContent;
  verifierStatus: 'passed' | 'flagged' | 'pending';
  verifierIssues: Array<{ claim: string; reason: string }>;
  createdAt: string;
  opportunity?: { id: string; title: string; company: string } | null;
}

export interface CoverLetter {
  id: string;
  userId: string;
  opportunityId: string;
  body: string;
  bodyEdited?: string | null;
  verifierStatus: string;
  verifierIssues: Array<{ claim: string; reason: string }>;
  createdAt: string;
}

export interface PrepTask {
  id: string;
  title: string;
  description: string;
  topic: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  done: boolean;
}

export interface InterviewPrepPlan {
  overview: string;
  topics: Array<{
    name: string;
    description: string;
    keyConcepts: string[];
  }>;
  tasks: Array<{
    id?: string;
    title: string;
    description: string;
    topic: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  }>;
  questions: Array<{
    question: string;
    category: string;
    expectedAnswer: string;
    talkingPoints: string[];
  }>;
  gapBridges: Array<{
    technology: string;
    challenge: string;
    bridgingAnswer: string;
  }>;
  questionsToAsk: Array<{
    question: string;
    strategicPurpose: string;
  }>;
}

export interface InterviewPrep {
  id: string;
  userId: string;
  opportunityId?: string | null;
  targetRole: string;
  planJson: InterviewPrepPlan;
  tasksJson: PrepTask[];
  createdAt: string;
  opportunity?: { id: string; title: string; company: string } | null;
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

let refreshPromise: Promise<boolean> | null = null;

async function attemptTokenRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

function handleSessionExpired(): void {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    const isPublic =
      path === '/login' ||
      path === '/' ||
      path.startsWith('/products') ||
      path.startsWith('/u/');
    if (!isPublic) {
      window.location.href = `/login?expired=1&redirect=${encodeURIComponent(path)}`;
    }
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false,
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

  if (response.status === 401) {
    const isAuthRoute =
      endpoint.includes('/auth/login') || endpoint.includes('/auth/refresh');

    if (!isAuthRoute && !isRetry) {
      const refreshed = await attemptTokenRefresh();
      if (refreshed) {
        return request<T>(endpoint, options, true);
      }
      handleSessionExpired();
    }
  }

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
async function uploadFile<T>(
  endpoint: string,
  formData: FormData,
  isRetry = false,
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (response.status === 401 && !isRetry) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      return uploadFile<T>(endpoint, formData, true);
    }
    handleSessionExpired();
  }

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

/** Download a file via authenticated GET request and trigger browser save */
async function downloadFile(
  endpoint: string,
  fallbackFilename = 'document.pdf',
  isRetry = false,
): Promise<void> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  });

  if (response.status === 401 && !isRetry) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      return downloadFile(endpoint, fallbackFilename, true);
    }
    handleSessionExpired();
    return;
  }

  if (!response.ok) {
    throw new ApiClientError(response.status, `Download failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition');
  let filename = fallbackFilename;
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) filename = match[1];
  }

  if (typeof window !== 'undefined') {
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  }
}

export interface ParsedCvResult {
  cv: Cv;
  url: string;
  parsed: {
    profile: {
      fullName?: string;
      headline?: string;
      summary?: string;
      phone?: string;
      location?: string;
      country?: string;
      linkedinUrl?: string;
      githubUrl?: string;
      portfolioUrl?: string;
      visaStatus?: string;
      noticePeriodDays?: number;
      willingToRelocate?: boolean;
    };
    skills: Array<{
      name: string;
      level: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT';
      yearsOfExp?: number;
      category?: string;
    }>;
    experiences: Array<{
      title: string;
      company: string;
      location?: string;
      startDate: string;
      endDate?: string;
      isCurrent: boolean;
      bullets: string[];
      techStack: string[];
    }>;
    preferences: {
      targetRoles: string[];
      targetCountries: string[];
      minSalaryUsd?: number;
      remoteOk: boolean;
      preferredIndustries: string[];
    };
  };
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
    login: (credentials: LoginPayload & { twoFactorCode?: string }) =>
      api.post<{ user: User; requires2Fa?: boolean }>('/auth/login', credentials),
    refresh: () => api.post<{ user: User }>('/auth/refresh'),
    logout: () => api.post<{ message: string }>('/auth/logout'),
    me: () => api.get<{ user: User & { twoFactorEnabled?: boolean; slug?: string } }>('/auth/me'),
    generate2Fa: () =>
      api.post<{ secret: string; otpAuthUrl: string; qrCodeDataUrl: string }>('/auth/2fa/generate'),
    enable2Fa: (code: string) =>
      api.post<{ success: boolean; message: string }>('/auth/2fa/enable', { code }),
    disable2Fa: (code: string) =>
      api.post<{ success: boolean; message: string }>('/auth/2fa/disable', { code }),
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
    parse: (formData: FormData) =>
      uploadFile<ParsedCvResult>('/upload/cv/parse', formData),
    update: (
      id: string,
      data: { label?: string; tags?: string[]; isDefault?: boolean },
    ) => api.patch<Cv>(`/cvs/${id}`, data),
    delete: (id: string) => api.delete<void>(`/cvs/${id}`),
  },

  opportunities: {
    create: (data: { text?: string; url?: string; type?: OpportunityType }) =>
      api.post<Opportunity>('/opportunities', data),
    list: () => api.get<Opportunity[]>('/opportunities'),
    get: (id: string) => api.get<Opportunity>(`/opportunities/${id}`),
    reprocess: (id: string) => api.post<Opportunity>(`/opportunities/${id}/reprocess`),
    patch: (id: string, data: Partial<Pick<Opportunity, 'status'>>) =>
      api.patch<Opportunity>(`/opportunities/${id}`, data),
    delete: (id: string) => api.delete<void>(`/opportunities/${id}`),
    buildPack: (id: string) => api.post<ApplyPack>(`/opportunities/${id}/apply-pack`),
    getPack: (id: string) => api.get<ApplyPack>(`/opportunities/${id}/apply-pack`),
    updateCoverNote: (id: string, coverNoteEdited: string) =>
      api.patch<ApplyPack>(`/opportunities/${id}/apply-pack/cover-note`, { coverNoteEdited }),
  },

  approvals: {
    pending: () => api.get<ApplyPack[]>('/opportunities/queue/pending'),
    decided: () => api.get<ApprovalRecord[]>('/opportunities/queue/decided'),
    decide: (packId: string, decision: 'approved' | 'rejected', notes?: string) =>
      api.post<ApprovalRecord>(`/opportunities/queue/${packId}/decide`, { decision, notes }),
  },

  connectors: {
    syncAll: () =>
      api.post<{
        email: { totalProcessed: number; jobsEnqueued: number; errors: string[] };
        ats: {
          companiesChecked: number;
          jobsFound: number;
          jobsEnqueued: number;
          duplicatesSkipped: number;
          locationFiltered: number;
          errors: string[];
        };
        timestamp: string;
      }>('/connectors/sync'),
    syncEmail: () =>
      api.post<{ totalProcessed: number; jobsEnqueued: number; errors: string[] }>(
        '/connectors/email/sync',
      ),
    syncAts: (targets?: AtsTarget[]) =>
      api.post<{
        companiesChecked: number;
        jobsFound: number;
        jobsEnqueued: number;
        duplicatesSkipped: number;
        locationFiltered: number;
        errors: string[];
      }>('/connectors/ats/sync', { targets }),
  },

  leads: {
    discover: (query: string, locationBias?: string) =>
      api.post<DiscoveredPlace[]>('/leads/discover', { query, locationBias }),
    getQuota: () =>
      api.get<QuotaInfo>('/leads/quota'),
    import: (placeData: Partial<DiscoveredPlace>) =>
      api.post<Company>('/leads/import', placeData),
    list: (params?: { status?: LeadStatus; search?: string }) => {
      const q = new URLSearchParams();
      if (params?.status) q.append('status', params.status);
      if (params?.search) q.append('search', params.search);
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      return api.get<Company[]>(`/leads${queryStr}`);
    },
    get: (id: string) =>
      api.get<Company>(`/leads/${id}`),
    update: (id: string, data: { status?: LeadStatus; notes?: string; nextFollowUpAt?: string }) =>
      api.patch<Company>(`/leads/${id}`, data),
    delete: (id: string) =>
      api.delete<void>(`/leads/${id}`),
    draftOutreach: (id: string) =>
      api.post<OutreachMessage>(`/leads/${id}/draft-outreach`),
    approveAndSend: (outreachId: string) =>
      api.post<{ success: boolean; outreach: OutreachMessage; message: string }>(`/leads/outreach/${outreachId}/send`),
    getSuppressions: () =>
      api.get<SuppressionEntry[]>('/leads/suppressions'),
    addSuppression: (data: { domain?: string; email?: string; reason?: string }) =>
      api.post<SuppressionEntry>('/leads/suppressions', data),
    removeSuppression: (id: string) =>
      api.delete<void>(`/leads/suppressions/${id}`),
  },

  public: {
    getProfile: (slug?: string) =>
      api.get<PublicProfile>(slug ? `/public/profile/${slug}` : '/public/profile'),
    getProducts: () =>
      api.get<PublicProduct[]>('/public/products'),
    submitInquiry: (data: {
      name: string;
      email: string;
      company?: string;
      message: string;
      productSlug?: string;
    }) => api.post<{ success: boolean; message: string }>('/public/inquiry', data),
  },

  admin: {
    getUsers: () => api.get<AdminUser[]>('/admin/users'),
    updateUser: (
      id: string,
      data: { role?: 'SUPER_ADMIN' | 'USER'; isActive?: boolean; slug?: string },
    ) => api.patch<AdminUser>(`/admin/users/${id}`, data),
    getLlmMetrics: () => api.get<LlmMetrics>('/admin/llm-usage'),
    getAuditLogs: (action?: string, limit?: number) => {
      const q = new URLSearchParams();
      if (action) q.append('action', action);
      if (limit) q.append('limit', String(limit));
      const qs = q.toString() ? `?${q.toString()}` : '';
      return api.get<AuditLogEntry[]>(`/admin/audit-logs${qs}`);
    },
    getSources: () => api.get<SourcesStatus>('/admin/sources'),
  },

  tailoredCv: {
    generate: (data: {
      opportunityId?: string;
      targetRole?: string;
      jobDescription?: string;
      emphasizedSkills?: string[];
      forceRegenerate?: boolean;
    }) => api.post<TailoredCv>('/tailored-cv/generate', data),
    list: (opportunityId?: string) => {
      const qs = opportunityId ? `?opportunityId=${encodeURIComponent(opportunityId)}` : '';
      return api.get<TailoredCv[]>(`/tailored-cv${qs}`);
    },
    get: (id: string) => api.get<TailoredCv>(`/tailored-cv/${id}`),
    downloadUrl: (id: string, style?: 'GULF' | 'EUROPE') => {
      const qs = style ? `?style=${style}` : '';
      return `${API_BASE_URL}/tailored-cv/${id}/download${qs}`;
    },
    downloadPdf: (id: string, fallbackFilename?: string, style?: 'GULF' | 'EUROPE') => {
      const qs = style ? `?style=${style}` : '';
      return downloadFile(`/tailored-cv/${id}/download${qs}`, fallbackFilename || `tailored-cv-${id}.pdf`);
    },
    addSkillFromGap: (data: {
      name: string;
      category?: string;
      level?: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT';
      opportunityId?: string;
    }) =>
      api.post<{
        success: boolean;
        skill: Skill;
        rescoredOpportunity: Opportunity | null;
        message: string;
      }>('/tailored-cv/add-skill-from-gap', data),
    generateCoverLetter: (data: { opportunityId: string; forceRegenerate?: boolean }) =>
      api.post<CoverLetter>('/tailored-cv/cover-letter', data),
    coverLetterDownloadUrl: (id: string) => `${API_BASE_URL}/tailored-cv/cover-letter/${id}/download`,
    downloadCoverLetterPdf: (id: string, fallbackFilename?: string) =>
      downloadFile(
        `/tailored-cv/cover-letter/${id}/download`,
        fallbackFilename || `cover-letter-${id}.pdf`,
      ),
  },

  interviewPrep: {
    generate: (data: {
      opportunityId?: string;
      targetRole?: string;
      jobDescription?: string;
      focusAreas?: string[];
      forceRegenerate?: boolean;
    }) => api.post<InterviewPrep>('/interview-prep/generate', data),
    list: (opportunityId?: string) => {
      const qs = opportunityId ? `?opportunityId=${encodeURIComponent(opportunityId)}` : '';
      return api.get<InterviewPrep[]>(`/interview-prep${qs}`);
    },
    get: (id: string) => api.get<InterviewPrep>(`/interview-prep/${id}`),
    toggleTask: (prepId: string, taskId: string, done?: boolean) =>
      api.patch<{
        success: boolean;
        taskId: string;
        done: boolean;
        completedCount: number;
        totalCount: number;
        progressPercent: number;
        prep: InterviewPrep;
      }>(`/interview-prep/${prepId}/tasks/${taskId}/toggle`, { done }),
    delete: (id: string) => api.delete<void>(`/interview-prep/${id}`),
  },

  health: {
    check: () => api.get<{ status: string }>('/health'),
  },
};
