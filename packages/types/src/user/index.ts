import type { UserStatus } from '../auth/index.js';

export interface UserSummary {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  status: UserStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
