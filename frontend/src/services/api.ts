const BASE_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    const responseBody = await response.text();
    try {
      const body = JSON.parse(responseBody);
      message = body.detail || body.message || message;
    } catch {
      if (responseBody) message = responseBody;
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  get<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint);
  },

  post<T, TBody = unknown>(endpoint: string, body: TBody): Promise<T> {
    return request<T>(endpoint, { method: "POST", body: JSON.stringify(body) });
  },

  delete<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: "DELETE" });
  },

  getDownloadUrl(bookingCode: string, email: string): string {
    return `${BASE_URL}/api/bookings/ticket/${encodeURIComponent(bookingCode)}/download?email=${encodeURIComponent(email)}`;
  },
};
