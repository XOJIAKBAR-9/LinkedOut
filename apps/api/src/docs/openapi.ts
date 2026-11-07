/**
 * Hand-maintained OpenAPI 3 description of the REST API, served at /api/docs.
 * Request bodies mirror the Zod schemas in packages/shared.
 */
const json = (schema: object) => ({ "application/json": { schema } });
const ok = (description = "OK") => ({ description });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const idParam = { name: "id", in: "path", required: true, schema: { type: "string" } };
const pageParams = [
  { name: "cursor", in: "query", schema: { type: "string" } },
  { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
];

export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "LinkedOut API",
    version: "0.1.0",
    description:
      "Auth uses httpOnly cookies (`lo_access`, `lo_refresh`). Log in via `POST /auth/login` in this page and the browser will send the cookie on later calls.",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: { cookieAuth: { type: "apiKey", in: "cookie", name: "lo_access" } },
    schemas: {
      Register: {
        type: "object",
        required: ["firstName", "lastName", "email", "password"],
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8 },
        },
      },
      Login: {
        type: "object",
        required: ["email", "password"],
        properties: { email: { type: "string" }, password: { type: "string" } },
      },
      PublicUser: {
        type: "object",
        properties: {
          id: { type: "string" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          headline: { type: "string", nullable: true },
          avatarUrl: { type: "string", nullable: true },
          location: { type: "string", nullable: true },
        },
      },
      Post: {
        type: "object",
        properties: {
          id: { type: "string" },
          content: { type: "string" },
          imageUrl: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          author: ref("PublicUser"),
          commentCount: { type: "integer" },
          reactionCount: { type: "integer" },
          myReaction: { type: "string", nullable: true, enum: ["LIKE", "CELEBRATE", "SUPPORT", "INSIGHTFUL", "FUNNY"] },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: { code: { type: "string" }, message: { type: "string" }, details: {} },
          },
        },
      },
    },
  },
  security: [{ cookieAuth: [] }],
  paths: {
    "/auth/register": { post: { tags: ["Auth"], security: [], requestBody: { content: json(ref("Register")) }, responses: { 201: ok("Created; sets session cookies"), 409: ok("Email taken") } } },
    "/auth/login": { post: { tags: ["Auth"], security: [], requestBody: { content: json(ref("Login")) }, responses: { 200: ok("Sets session cookies"), 401: ok("Bad credentials") } } },
    "/auth/refresh": { post: { tags: ["Auth"], security: [], responses: { 200: ok("Rotates the refresh token"), 401: ok() } } },
    "/auth/logout": { post: { tags: ["Auth"], responses: { 204: ok() } } },
    "/auth/me": { get: { tags: ["Auth"], responses: { 200: ok(), 401: ok() } } },
    "/auth/verify-email": { post: { tags: ["Auth"], security: [], requestBody: { content: json({ type: "object", properties: { token: { type: "string" } } }) }, responses: { 204: ok() } } },
    "/auth/forgot-password": { post: { tags: ["Auth"], security: [], requestBody: { content: json({ type: "object", properties: { email: { type: "string" } } }) }, responses: { 204: ok("Always 204") } } },
    "/auth/reset-password": { post: { tags: ["Auth"], security: [], requestBody: { content: json({ type: "object", properties: { token: { type: "string" }, password: { type: "string" } } }) }, responses: { 204: ok() } } },
    "/auth/account": { delete: { tags: ["Auth"], summary: "Permanently delete your account", description: "Body: `{ password }`, or `{ email }` for GitHub-only accounts. Removes all your data and uploaded files, and clears session cookies.", requestBody: { content: json({ type: "object", properties: { password: { type: "string" }, email: { type: "string" } } }) }, responses: { 204: ok("Deleted"), 403: ok("WRONG_PASSWORD") } } },
    "/auth/github": { get: { tags: ["Auth"], security: [], description: "Starts GitHub OAuth (only when configured)", responses: { 302: ok() } } },
    "/users/me": { patch: { tags: ["Users"], requestBody: { content: json({ type: "object", properties: { firstName: { type: "string" }, lastName: { type: "string" }, headline: { type: "string" }, about: { type: "string" }, location: { type: "string" } } }) }, responses: { 200: ok() } } },
    "/users/me/avatar": { post: { tags: ["Users"], requestBody: { content: { "multipart/form-data": { schema: { type: "object", properties: { image: { type: "string", format: "binary" } } } } } }, responses: { 200: ok() } } },
    "/users/me/banner": { post: { tags: ["Users"], requestBody: { content: { "multipart/form-data": { schema: { type: "object", properties: { image: { type: "string", format: "binary" } } } } } }, responses: { 200: ok() } } },
    "/users/{id}": { get: { tags: ["Users"], parameters: [idParam], responses: { 200: ok(), 404: ok() } } },
    "/users/{id}/experience": { get: { tags: ["Users"], parameters: [idParam], responses: { 200: ok() } } },
    "/users/{id}/posts": { get: { tags: ["Users"], parameters: [idParam, ...pageParams], responses: { 200: ok() } } },
    "/users/{id}/connect": { post: { tags: ["Network"], parameters: [idParam], responses: { 201: ok(), 409: ok() } } },
    "/connections": { get: { tags: ["Network"], responses: { 200: ok() } } },
    "/connections/pending": { get: { tags: ["Network"], responses: { 200: ok() } } },
    "/connections/{id}/accept": { post: { tags: ["Network"], parameters: [idParam], responses: { 200: ok() } } },
    "/connections/{id}": { delete: { tags: ["Network"], parameters: [idParam], responses: { 204: ok() } } },
    "/posts": {
      get: { tags: ["Posts"], summary: "Feed", parameters: pageParams, responses: { 200: ok() } },
      post: { tags: ["Posts"], requestBody: { content: { "multipart/form-data": { schema: { type: "object", required: ["content"], properties: { content: { type: "string" }, image: { type: "string", format: "binary" } } } } } }, responses: { 201: { description: "Created", content: json({ type: "object", properties: { post: ref("Post") } }) } } },
    },
    "/posts/{id}": {
      get: { tags: ["Posts"], parameters: [idParam], responses: { 200: ok() } },
      delete: { tags: ["Posts"], parameters: [idParam], responses: { 204: ok(), 403: ok() } },
    },
    "/posts/{id}/reaction": {
      put: { tags: ["Posts"], parameters: [idParam], requestBody: { content: json({ type: "object", properties: { type: { type: "string", enum: ["LIKE", "CELEBRATE", "SUPPORT", "INSIGHTFUL", "FUNNY"] } } }) }, responses: { 200: ok() } },
      delete: { tags: ["Posts"], parameters: [idParam], responses: { 200: ok() } },
    },
    "/posts/{id}/comments": {
      get: { tags: ["Posts"], summary: "Top-level comments, or replies with ?parentId=", parameters: [idParam, ...pageParams, { name: "parentId", in: "query", schema: { type: "string" } }], responses: { 200: ok() } },
      post: { tags: ["Posts"], summary: "Comment, or reply with parentId", parameters: [idParam], requestBody: { content: json({ type: "object", required: ["content"], properties: { content: { type: "string" }, parentId: { type: "string" } } }) }, responses: { 201: ok(), 404: ok("Post or parent comment not found") } },
    },
    "/conversations": {
      get: { tags: ["Messaging"], responses: { 200: ok() } },
      post: { tags: ["Messaging"], summary: "Open (or create) a 1:1 conversation", requestBody: { content: json({ type: "object", properties: { userId: { type: "string" } } }) }, responses: { 200: ok() } },
    },
    "/conversations/unread": { get: { tags: ["Messaging"], summary: "Unread counts for the Messaging badge", description: "`{ conversations, messages }` — conversations = number of people with unread messages.", responses: { 200: ok() } } },
    "/conversations/{id}/read": { post: { tags: ["Messaging"], summary: "Mark a conversation as read", parameters: [idParam], responses: { 204: ok() } } },
    "/conversations/{id}/messages": {
      get: { tags: ["Messaging"], parameters: [idParam, ...pageParams], responses: { 200: ok() } },
      post: { tags: ["Messaging"], summary: "Send text or a sticker", parameters: [idParam], requestBody: { content: json({ oneOf: [{ type: "object", required: ["content"], properties: { content: { type: "string" } } }, { type: "object", required: ["stickerId"], properties: { stickerId: { type: "string" } } }] }) }, responses: { 201: ok() } },
    },
    "/conversations/{id}/messages/{messageId}": {
      patch: { tags: ["Messaging"], summary: "Edit your own text message (within 15 minutes)", parameters: [idParam, { name: "messageId", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: json({ type: "object", properties: { content: { type: "string" } } }) }, responses: { 200: ok(), 403: ok("FORBIDDEN or EDIT_EXPIRED") } },
      delete: { tags: ["Messaging"], summary: "Delete your own message for everyone", parameters: [idParam, { name: "messageId", in: "path", required: true, schema: { type: "string" } }], responses: { 200: ok(), 403: ok() } },
    },
    "/notifications": { get: { tags: ["Notifications"], parameters: pageParams, responses: { 200: ok() } } },
    "/notifications/read": { post: { tags: ["Notifications"], summary: "Mark all as read", responses: { 204: ok() } } },
    "/notifications/{id}/read": { post: { tags: ["Notifications"], summary: "Mark one as read", parameters: [idParam], responses: { 204: ok() } } },
    "/search/suggest": { get: { tags: ["Search"], summary: "People suggestions while typing (real accounts only)", parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" } }], responses: { 200: ok() } } },
    "/search": { get: { tags: ["Search"], parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" } }, { name: "type", in: "query", schema: { type: "string", enum: ["all", "people", "posts", "companies"] } }], responses: { 200: ok() } } },
  },
};
