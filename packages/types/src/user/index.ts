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

/**
 * A customer row for the Operations Console customer roster
 * (`GET /admin/customers`). Combines the customer's `User` identity with two
 * live aggregates over their rides: `tripsCount` and `totalSpent` are computed
 * from that customer's COMPLETED rides only (sum of `Ride.totalFare`), so an
 * in-flight or cancelled ride never inflates spend. There is no customer
 * rating model, so no rating field is included.
 */
export interface AdminCustomerDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  tripsCount: number;
  totalSpent: number;
  createdAt: string;
}
