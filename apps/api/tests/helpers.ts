import request from "supertest";
import { createApp } from "../src/app.js";

export const app = createApp();

let n = 0;

/** Registers a user and returns a supertest agent that keeps its session cookies. */
export async function signUp(overrides: Partial<{ firstName: string; lastName: string; email: string }> = {}) {
  n += 1;
  const agent = request.agent(app);
  const body = {
    firstName: overrides.firstName ?? "Test",
    lastName: overrides.lastName ?? `User${n}`,
    email: overrides.email ?? `user${n}-${Date.now()}@example.test`,
    password: "password123",
  };
  const res = await agent.post("/api/v1/auth/register").send(body).expect(201);
  return { agent, user: res.body.user as { id: string; email: string }, password: body.password, cookies: res.headers["set-cookie"] as unknown as string[] };
}
