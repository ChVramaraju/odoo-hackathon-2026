export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Array<string | { field: string; issue: string }>;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface SystemHealth {
  status: string;
  version: string;
}

