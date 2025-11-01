const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiCall(endpoint: string, options?: RequestInit) {
  const token = localStorage.getItem("token");
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options?.headers,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    if (res.status === 401) {
      // Token expired, logout
      localStorage.removeItem("token");
      localStorage.removeItem("tenantId");
      localStorage.removeItem("tenantName");
      window.location.href = "/login";
    }
    throw new Error(`API error: ${res.statusText}`);
  }
  return res.json();
}

