import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { mockFetch, renderWithProviders } from "@/test/render";
import { SearchBox } from "./SearchBox";

const xojiakbar = { id: "u1", firstName: "Xojiakbar", lastName: "Akramov", headline: "Engineer", avatarUrl: null, location: null };
const xolida = { id: "u2", firstName: "Xolida", lastName: "Karimova", headline: null, avatarUrl: null, location: null };

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

const setup = () =>
  renderWithProviders(
    <>
      <SearchBox />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </>,
  );

describe("SearchBox", () => {
  it("suggests people while typing a partial name", async () => {
    const calls = mockFetch({ "GET /search/suggest": { body: { people: [xojiakbar, xolida] } } });
    setup();
    const box = screen.getByRole("combobox", { name: "Search" });
    await userEvent.type(box, "xo");
    expect(await screen.findByRole("option", { name: /Xojiakbar Akramov/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Xolida Karimova/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "See all results for “xo”" })).toBeInTheDocument();
    expect(box).toHaveAttribute("aria-expanded", "true");
    // Debounced: one request for the final text, not one per keystroke.
    await waitFor(() => expect(calls.filter((c) => c.url.startsWith("/search/suggest"))).toHaveLength(1));
    expect(calls[0]!.url).toBe("/search/suggest?q=xo");
  });

  it("opens a person's profile with the keyboard", async () => {
    mockFetch({ "GET /search/suggest": { body: { people: [xojiakbar, xolida] } } });
    setup();
    const box = screen.getByRole("combobox", { name: "Search" });
    await userEvent.type(box, "xo");
    await screen.findByRole("option", { name: /Xolida/ });
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("option", { name: /Xolida/ })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Enter}");
    expect(screen.getByTestId("where")).toHaveTextContent("/in/u2");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("goes to full search on Enter, and closes on Escape", async () => {
    mockFetch({ "GET /search/suggest": { body: { people: [] } } });
    setup();
    const box = screen.getByRole("combobox", { name: "Search" });
    await userEvent.type(box, "react");
    expect(await screen.findByText(/No people found/)).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await userEvent.type(box, "{Enter}");
    expect(screen.getByTestId("where")).toHaveTextContent("/search?q=react");
  });
});
