import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  // Login is started via startLogin() in the effect below, only when we actually
  // navigate — never during render. startLogin() mints a one-time nonce + writes
  // the state cookie, so calling it per render would overwrite the cookie and
  // desync it from an in-flight login's `state`.
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        // expected if session expired
      } else {
        console.warn("Logout error:", error);
      }
    } finally {
      try {
        await fetch("/api/private-auth/sign-out", { method: "POST" });
      } catch {}
      try {
        localStorage.removeItem("seif_local_auth_user");
        localStorage.removeItem("seif_private_token");
        sessionStorage.removeItem("seif_private_token");
        sessionStorage.removeItem("manus-cookie");
        localStorage.removeItem("manus-runtime-user-info");
      } catch {}
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
      window.location.reload();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    let currentUser = meQuery.data ?? null;
    if (!currentUser) {
      try {
        const local = localStorage.getItem("seif_local_auth_user");
        if (local) {
          currentUser = JSON.parse(local);
        } else {
          const raw = localStorage.getItem("manus-runtime-user-info");
          if (raw && raw !== "null" && raw !== "undefined") {
            currentUser = JSON.parse(raw);
          }
        }
      } catch {}
    } else {
      try {
        localStorage.setItem("manus-runtime-user-info", JSON.stringify(currentUser));
      } catch {}
    }
    return {
      user: currentUser,
      loading: meQuery.isLoading && !currentUser,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(currentUser),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;

    // Navigate at this moment only. startLogin() mints the nonce + cookie itself.
    if (redirectPath) {
      window.location.href = redirectPath;
    } else {
      startLogin();
    }
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
