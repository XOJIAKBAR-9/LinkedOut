import type { PublicUser } from "@linkedout/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { publicUserSelect } from "../lib/serializers.js";

interface PostRow {
  id: string;
  content: string;
  createdAt: Date;
  rank: number;
  anonymous: boolean;
  authorId: string;
  authorFirstName: string;
  authorLastName: string;
  authorHeadline: string | null;
  authorAvatarUrl: string | null;
  authorLocation: string | null;
}

interface CompanyHit {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  logoUrl: string | null;
  rank: number;
}

/**
 * Builds the tsquery for a search box string.
 * - Plain words match as prefixes, so "xoji" finds "Xojiakbar" and "eng manag" finds "Engineering Manager".
 * - Advanced syntax (`"exact phrase"`, `-exclude`, `OR`) falls back to websearch_to_tsquery.
 */
export function buildTsQuery(q: string): Prisma.Sql {
  if (/["]|(^|\s)-\S|\sOR\s/.test(q)) return Prisma.sql`websearch_to_tsquery('english', ${q})`;
  const terms = q
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean)
    .slice(0, 8);
  if (terms.length === 0) return Prisma.sql`websearch_to_tsquery('english', ${q})`;
  return Prisma.sql`to_tsquery('english', ${terms.map((t) => `${t}:*`).join(" & ")})`;
}

/** Full-text search over the generated tsvector columns. */
export async function search(q: string, type: "all" | "people" | "posts" | "companies", limit = 10) {
  const tsq = buildTsQuery(q);
  const want = (t: typeof type) => type === "all" || type === t;

  const [people, posts, companies] = await Promise.all([
    want("people")
      ? prisma.$queryRaw<(PublicUser & { rank: number })[]>`
          SELECT id, "firstName", "lastName", headline, "avatarUrl", location,
                 ts_rank("searchVector", ${tsq}) AS rank
          FROM "User"
          WHERE "searchVector" @@ ${tsq}
          ORDER BY rank DESC LIMIT ${limit}`
      : [],
    want("posts")
      ? prisma.$queryRaw<PostRow[]>`
          SELECT p.id, p.content, p."createdAt", p.anonymous,
                 ts_rank(p."searchVector", ${tsq}) AS rank,
                 u.id AS "authorId", u."firstName" AS "authorFirstName", u."lastName" AS "authorLastName",
                 u.headline AS "authorHeadline", u."avatarUrl" AS "authorAvatarUrl", u.location AS "authorLocation"
          FROM "Post" p JOIN "User" u ON u.id = p."authorId"
          WHERE p."searchVector" @@ ${tsq} AND p."groupId" IS NULL
          ORDER BY rank DESC, p."createdAt" DESC LIMIT ${limit}`
      : [],
    want("companies")
      ? prisma.$queryRaw<CompanyHit[]>`
          SELECT id, name, slug, industry, "logoUrl",
                 ts_rank("searchVector", ${tsq}) AS rank
          FROM "Company"
          WHERE "searchVector" @@ ${tsq}
          ORDER BY rank DESC LIMIT ${limit}`
      : [],
  ]);

  const strip = <T extends { rank: number }>(rows: T[]) => rows.map(({ rank: _rank, ...rest }) => rest);
  return {
    people: strip(people),
    posts: posts.map((p) => ({
      id: p.id,
      content: p.content,
      createdAt: p.createdAt.toISOString(),
      // Never reveal who wrote an anonymous post.
      author: p.anonymous ? null : {
        id: p.authorId,
        firstName: p.authorFirstName,
        lastName: p.authorLastName,
        headline: p.authorHeadline,
        avatarUrl: p.authorAvatarUrl,
        location: p.authorLocation,
      } satisfies PublicUser,
    })),
    companies: strip(companies),
  };
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Typeahead people suggestions: real accounts only (sample/seed users are excluded),
 * matched on the beginning of the first name, last name or full name. Case-insensitive.
 */
export async function suggestPeople(q: string, limit = 6): Promise<PublicUser[]> {
  const query = q.trim().replace(/\s+/g, " ");
  if (!query) return [];
  const prefix = `${escapeLike(query)}%`;
  const ids = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User"
    WHERE NOT "isSample"
      AND ("firstName" ILIKE ${prefix}
        OR "lastName" ILIKE ${prefix}
        OR ("firstName" || ' ' || "lastName") ILIKE ${prefix}
        OR ("lastName" || ' ' || "firstName") ILIKE ${prefix})
    ORDER BY ("firstName" ILIKE ${prefix}) DESC, "firstName", "lastName"
    LIMIT ${limit}`;
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({ where: { id: { in: ids.map((r) => r.id) } }, select: publicUserSelect });
  const byId = new Map(users.map((u) => [u.id, u]));
  return ids.map((r) => byId.get(r.id)).filter((u): u is PublicUser => Boolean(u));
}
