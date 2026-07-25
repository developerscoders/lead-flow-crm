import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api, ApiError, type Envelope, type User } from "./api";
import { useEffect } from "react";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const res = await api<Envelope<{ user: User }>>("/api/auth/me");
        return res.data.user;
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 60_000,
  });
}

export function useRequireAuth(role?: "admin") {
  const me = useMe();
  const navigate = useNavigate();
  useEffect(() => {
    if (me.isLoading) return;
    if (!me.data) {
      navigate({ to: "/login", replace: true });
    } else if (role === "admin" && me.data.role !== "admin") {
      // stay but signal via return value
    }
  }, [me.data, me.isLoading, navigate, role]);
  return me;
}

export function useLogout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch { /* ignore */ }
    qc.setQueryData(["me"], null);
    qc.clear();
    navigate({ to: "/login", replace: true });
  };
}
