import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";

export function renderWithProviders(ui: React.ReactElement, { route = "/", path = "*" } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path={path} element={ui} />
            <Route path="/feed" element={<p>Feed page</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

/** Minimal fetch mock: map "METHOD /path" to a JSON response. */
export function mockFetch(routes: Record<string, { status?: number; body?: unknown }>) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/^\/api\/v1/, "");
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: init?.body && typeof init.body === "string" ? JSON.parse(init.body) : init?.body });
    const key = Object.keys(routes).find((k) => k === `${method} ${url.split("?")[0]}`);
    const r = key ? routes[key]! : { status: 404, body: { error: { code: "NOT_FOUND", message: "nope" } } };
    return new Response(r.status === 204 ? null : JSON.stringify(r.body ?? {}), {
      status: r.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}
