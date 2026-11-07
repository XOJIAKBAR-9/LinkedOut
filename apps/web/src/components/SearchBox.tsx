import type { PublicUser } from "@linkedout/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { UserAvatar } from "@/components/UserAvatar";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { cn, fullName } from "@/lib/utils";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Header search with suggestions as you type (real people only, matched on name prefix).
 * Keyboard: ↑/↓ to move, Enter to open, Esc to close. Implements the ARIA combobox pattern.
 */
export function SearchBox({ className }: { className?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const listId = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const term = useDebounced(q.trim(), 200);

  const suggestions = useQuery({
    queryKey: ["suggest", term],
    queryFn: () => api.get<{ people: PublicUser[] }>(`/search/suggest?q=${encodeURIComponent(term)}`),
    enabled: term.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const people = q.trim() ? (suggestions.data?.people ?? []) : [];
  // Options: each person, then "See all results".
  const count = people.length + 1;
  const showList = open && q.trim().length > 0;

  useEffect(() => setActive(-1), [term]);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const goToSearch = () => {
    const query = q.trim();
    if (!query) return;
    close();
    inputRef.current?.blur();
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const goToPerson = (p: PublicUser) => {
    close();
    setQ("");
    inputRef.current?.blur();
    navigate(`/in/${p.id}`);
  };

  const choose = (index: number) => {
    const person = people[index];
    if (person) goToPerson(person);
    else goToSearch();
  };

  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        choose(active);
      }}
    >
      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
      <Input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => (a + 1) % count);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? count - 1 : a - 1));
          } else if (e.key === "Escape") {
            close();
          }
        }}
        placeholder={t("nav.search")}
        aria-label={t("nav.search")}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        spellCheck={false}
        className="h-9 border-transparent bg-muted pl-8 focus-visible:border-input"
      />
      {showList && (
        <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
          {/* onMouseDown + preventDefault keeps focus in the input so the click isn't lost to onBlur. */}
          <ul id={listId} role="listbox" aria-label={t("search.suggestions")} onMouseDown={(e) => e.preventDefault()}>
            {people.length > 0 && (
              <li role="presentation" className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("search.suggestions")}
              </li>
            )}
            {people.map((p, i) => (
              <li
                key={p.id}
                id={optionId(i)}
                role="option"
                aria-selected={active === i}
                onClick={() => goToPerson(p)}
                onMouseEnter={() => setActive(i)}
                className={cn("flex cursor-pointer items-center gap-3 px-3 py-2", active === i && "bg-accent text-accent-foreground")}
              >
                <UserAvatar user={p} className="h-8 w-8 text-xs" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{fullName(p)}</span>
                  {p.headline && <span className="block truncate text-xs text-muted-foreground">{p.headline}</span>}
                </span>
              </li>
            ))}
            {people.length === 0 && term === q.trim() && !suggestions.isFetching && (
              <li role="presentation" className="px-3 py-2 text-xs text-muted-foreground">{t("search.noPeople")}</li>
            )}
            <li
              id={optionId(people.length)}
              role="option"
              aria-selected={active === people.length}
              onClick={goToSearch}
              onMouseEnter={() => setActive(people.length)}
              className={cn(
                "flex cursor-pointer items-center gap-3 border-t px-3 py-2 text-sm",
                active === people.length && "bg-accent text-accent-foreground",
              )}
            >
              <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="truncate">{t("search.seeAll", { query: q.trim() })}</span>
            </li>
          </ul>
        </div>
      )}
    </form>
  );
}
