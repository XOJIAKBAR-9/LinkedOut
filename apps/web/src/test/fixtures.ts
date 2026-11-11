import type { Post, PublicUser } from "@linkedout/shared";

export const person = (id: string, firstName: string, headline: string | null = null): PublicUser => ({
  id,
  firstName,
  lastName: "Test",
  headline,
  avatarUrl: null,
  location: null,
});

/** A complete Post with sensible defaults; override what the test cares about. */
export const makePost = (over: Partial<Post> = {}): Post => ({
  id: "p1",
  type: "UPDATE",
  headline: null,
  content: "Hello",
  imageUrl: null,
  createdAt: new Date().toISOString(),
  author: person("a1", "Grace", "Compiler engineer"),
  anonymous: false,
  isMine: false,
  companyName: null,
  company: null,
  role: null,
  tenureMonths: null,
  reasons: [],
  commentCount: 0,
  reactionCount: 0,
  reactionCounts: { RESPECT: 0, SAME: 0, RUN: 0, FUNNY: 0 },
  myReaction: null,
  ...over,
});
