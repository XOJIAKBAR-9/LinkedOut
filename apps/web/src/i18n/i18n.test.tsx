import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import i18n, { LANGUAGES, resources } from "@/i18n";
import { LoginPage } from "@/pages/LoginPage";
import { useAuth } from "@/stores/auth";
import { mockFetch, renderWithProviders } from "@/test/render";

/** Flattens nested keys and strips plural suffixes so languages with different plural forms compare equal. */
function keys(obj: object, prefix = ""): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object") keys(v, `${prefix}${k}.`).forEach((x) => out.add(x));
    else out.add(`${prefix}${k}`.replace(/_(zero|one|two|few|many|other)$/, ""));
  }
  return out;
}

describe("i18n", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("has the same keys in every language", () => {
    const en = [...keys(resources.en.translation)].sort();
    for (const { code } of LANGUAGES) {
      expect([...keys(resources[code].translation)].sort(), code).toEqual(en);
    }
  });

  it("has every Russian plural form", () => {
    const ru = resources.ru.translation.post as unknown as Record<string, string>;
    expect(ru.reactions_one && ru.reactions_few && ru.reactions_many).toBeTruthy();
    expect(i18n.getFixedT("ru")("post.comments", { count: 1 })).toBe("1 комментарий");
    expect(i18n.getFixedT("ru")("post.comments", { count: 3 })).toBe("3 комментария");
    expect(i18n.getFixedT("ru")("post.comments", { count: 5 })).toBe("5 комментариев");
    expect(i18n.getFixedT("uz")("post.comments", { count: 5 })).toBe("5 ta izoh");
  });

  it("renders the login page in Russian and Uzbek, including validation messages", async () => {
    useAuth.setState({ user: null, loading: false });
    mockFetch({ "GET /auth/providers": { body: { github: false } } });

    await i18n.changeLanguage("ru");
    const { unmount } = renderWithProviders(<LoginPage />);
    expect(screen.getByRole("button", { name: "Войти" })).toBeInTheDocument();
    expect(screen.getByLabelText("Электронная почта")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("ru");
    screen.getByRole("button", { name: "Войти" }).click();
    expect(await screen.findByText("Введите корректный адрес электронной почты")).toBeInTheDocument();
    unmount();

    await i18n.changeLanguage("uz");
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole("button", { name: "Kirish" })).toBeInTheDocument();
    expect(screen.getByText("Parolni unutdingizmi?")).toBeInTheDocument();
  });
});
