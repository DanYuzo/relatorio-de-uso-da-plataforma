// ─── CursoEduca API Interfaces ──────────────────────────────────────────────
// Type-safe representations of CursoEduca API responses.
// Used by the API client (Story 1.2) and the adapter layer.

// ─── Pagination ─────────────────────────────────────────────────────────────

export interface ApiPaginatedResponse<T> {
  metadata: {
    totalCount: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  data: T[];
}

// ─── Members ────────────────────────────────────────────────────────────────

/** GET /members */
export interface ApiMember {
  id: number;
  uuid?: string;
  name: string;
  email: string;
  image?: string;
  lastLogin?: string;
  lastAccess?: string;
  document?: { type?: string; value?: string };
  situation?: string;
  slug?: string;
  groups?: ApiMemberGroup[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiMemberGroup {
  id: number;
  uuid?: string;
  name: string;
  expiresAt?: string;
  isActive?: boolean;
}

// ─── Groups ─────────────────────────────────────────────────────────────────

/** GET /groups */
export interface ApiGroup {
  id: number;
  uuid: string;
  name: string;
  description?: string;
  membersCount?: number;
  isActive?: boolean;
  expirationType?: string;
  expiresAt?: string;
  expirationInterval?: number;
}

// ─── Reports ────────────────────────────────────────────────────────────────

/** GET /reports/access */
export interface ApiAccessReport {
  isOk?: boolean;
  createdAt: string;
  member?: {
    uuid?: string;
    name?: string;
    email?: string;
    slug?: string;
  };
}

/** GET /reports/progress */
export interface ApiProgressReport {
  id: number;
  finishedAt: string;
  lesson: {
    id: number;
    title: string;
    section?: {
      id: number;
      title: string;
      content?: {
        id: number;
        title: string;
        slug?: string;
      };
    };
  };
  member: {
    id: number;
    email: string;
    name?: string;
  };
  enrollment?: {
    id: number;
    progress: number;
    group?: {
      id: number;
      uuid?: string;
      name?: string;
    };
  };
}

// ─── Enrollments ────────────────────────────────────────────────────────────

/** GET /api/reports/enrollments */
export interface ApiEnrollment {
  id: number;
  content: {
    id: number;
    title: string;
    slug?: string;
  };
  startedAt?: string;
  finishedAt?: string;
  member: {
    id: number;
    name: string;
    email: string;
    slug?: string;
    groupIds?: number[];
  };
  situationId?: number;
  progress: number;
  expiresAt?: string;
  expirationEnabled?: boolean;
  integration?: string;
}

// ─── Proxy Request ──────────────────────────────────────────────────────────

export interface ApiProxyRequest {
  service: 'members' | 'contents';
  endpoint: string;
  params?: Record<string, string | number>;
}
