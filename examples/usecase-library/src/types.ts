export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  createdAt: Date;
}

export interface ApiResponse<T> {
  data: T;
  meta: {
    page: number;
    total: number;
    perPage: number;
  };
}
