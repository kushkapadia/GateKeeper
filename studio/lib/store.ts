import { create } from "zustand";

interface Tenant {
  id: string;
  name: string;
}

interface AuthState {
  isAuthenticated: boolean;
  tenant: Tenant | null;
  token: string | null;
  login: (name: string, password: string) => Promise<boolean>;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  tenant: null,
  token: null,
  login: async (name, password) => {
    try {
      const response = await fetch("http://localhost:8000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      if (!response.ok) {
        return false;
      }
      const data = await response.json();
      localStorage.setItem("token", data.token);
      localStorage.setItem("tenantId", data.tenant.id);
      localStorage.setItem("tenantName", data.tenant.name);
      set({ isAuthenticated: true, tenant: data.tenant, token: data.token });
      return true;
    } catch {
      return false;
    }
  },
  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("tenantId");
    localStorage.removeItem("tenantName");
    set({ isAuthenticated: false, tenant: null, token: null });
  },
  loadFromStorage: () => {
    const token = localStorage.getItem("token");
    const tenantId = localStorage.getItem("tenantId");
    const tenantName = localStorage.getItem("tenantName");
    if (token && tenantId && tenantName) {
      set({
        isAuthenticated: true,
        tenant: { id: tenantId, name: tenantName },
        token,
      });
    }
  },
}));

interface DescriptorState {
  hasDescriptor: boolean;
  setHasDescriptor: (value: boolean) => void;
}

export const useDescriptorStore = create<DescriptorState>((set) => ({
  hasDescriptor: false,
  setHasDescriptor: (value) => set({ hasDescriptor: value }),
}));

