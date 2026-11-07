import { execSync } from "node:child_process";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://linkedout:linkedout@localhost:5432/linkedout_test";

/** Drops and re-migrates the test database once before the run. */
export default function setup() {
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
