import { create } from "zustand";
import { API_BASE } from "./api";

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
      const response = await fetch(`${API_BASE}/api/auth/login`, {
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
  checked: boolean;
  setHasDescriptor: (value: boolean) => void;
  checkDescriptor: () => Promise<void>;
}

export const useDescriptorStore = create<DescriptorState>((set, get) => ({
  hasDescriptor: false,
  checked: false,
  setHasDescriptor: (value) => set({ hasDescriptor: value, checked: true }),
  checkDescriptor: async () => {
    if (get().checked) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        set({ hasDescriptor: false, checked: true });
        return;
      }
      const res = await fetch(`${API_BASE}/api/schema/descriptor?version=v0`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        set({ hasDescriptor: false, checked: true });
        return;
      }
      const data = await res.json();
      const has = !!(data.descriptor && Object.keys(data.descriptor).length > 0);
      set({ hasDescriptor: has, checked: true });
    } catch {
      set({ hasDescriptor: false, checked: true });
    }
  },
}));

