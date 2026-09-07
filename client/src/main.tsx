import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { startLogin } from "./const";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry(failureCount, error: any) {
        if (failureCount >= 3) return false;
        if (error instanceof TRPCClientError && error.message === UNAUTHED_ERR_MSG) return false;
        return error instanceof TypeError || Boolean(error?.message?.toLowerCase().includes("fetch"));
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry(failureCount, error: any) {
        if (failureCount >= 2) return false;
        if (error instanceof TRPCClientError && error.message === UNAUTHED_ERR_MSG) return false;
        return error instanceof TypeError || Boolean(error?.message?.toLowerCase().includes("fetch"));
      },
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  startLogin();
};

if (import.meta.env.DEV && typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    if (!Boolean((error as any)?.message?.toLowerCase().includes("fetch"))) {
      console.error("[API Query Error]", error);
    }
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson as any,
      headers() {
        const h: Record<string, string> = {};
        try {
          const privateToken = localStorage.getItem("seif_private_token") || sessionStorage.getItem("seif_private_token");
          if (privateToken) {
            h["Authorization"] = `Bearer ${privateToken}`;
            h["x-private-session"] = privateToken;
            return h;
          }
          const raw = sessionStorage.getItem("manus-cookie");
          if (raw) {
            const prefix = `${COOKIE_NAME}=`;
            const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
            const token = pair?.trim().slice(prefix.length);
            if (token) {
              h["Authorization"] = `Bearer ${token}`;
              return h;
            }
          }
        } catch {
          // storage unavailable
        }
        return h;
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
