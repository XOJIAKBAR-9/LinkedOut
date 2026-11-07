import { QueryClient } from "@tanstack/react-query";
import { HttpError } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => !(err instanceof HttpError && err.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
});
