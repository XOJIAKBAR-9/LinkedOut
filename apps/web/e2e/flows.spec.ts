import { expect, type Page, test } from "@playwright/test";

const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function register(page: Page, first: string) {
  const email = `e2e-${unique()}@example.test`;
  await page.goto("/register");
  await page.getByLabel("First name").fill(first);
  await page.getByLabel("Last name").fill("Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill("password123");
  await page.getByRole("button", { name: "Agree & join" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  return email;
}

test("sign up, post, react and comment", async ({ page }) => {
  await register(page, "Poster");
  const text = `Hello from Playwright ${unique()}`;
  await page.getByLabel("Post content").fill(text);
  await page.getByRole("button", { name: "Post", exact: true }).click();

  const post = page.getByRole("article").filter({ hasText: text });
  await expect(post).toBeVisible();
  await post.getByRole("button", { name: "Like" }).first().click();
  await expect(post.getByText("1 reaction")).toBeVisible();

  await post.getByRole("button", { name: /Comment$/ }).click();
  await post.getByLabel("Add a comment").fill("First!");
  await post.getByRole("button", { name: "Post", exact: true }).click();
  await expect(post.getByText("First!")).toBeVisible();
});

test("sign out and back in", async ({ page }) => {
  const email = await register(page, "Returning");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/feed$/);
});

test("messages arrive in real time", async ({ browser }) => {
  const alice = await (await browser.newContext()).newPage();
  const bob = await (await browser.newContext()).newPage();
  await register(alice, "Alice");
  await register(bob, "Bob");
  const bobId = await bob.evaluate(async () => (await (await fetch("/api/v1/auth/me")).json()).user.id as string);

  await alice.goto(`/in/${bobId}`);
  await alice.getByRole("button", { name: "Message" }).click();
  await bob.goto("/messaging");

  const chat = alice.getByRole("region", { name: /Chat with Bob/ });
  await chat.getByLabel("Message").fill("Hi Bob, live from Playwright");
  await chat.getByRole("button", { name: "Send" }).click();

  await bob.getByRole("button", { name: /Alice Tester/ }).click();
  await expect(bob.getByText("Hi Bob, live from Playwright")).toBeVisible();
});

test("search finds seeded fictional companies", async ({ page }) => {
  await register(page, "Searcher");
  await page.goto("/search?q=Quillstone");
  await expect(page.getByText("Quillstone Labs")).toBeVisible();
});
