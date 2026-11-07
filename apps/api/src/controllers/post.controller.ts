import type { Request, Response } from "express";
import { createPostSchema, type ListCommentsInput, type PaginationInput } from "@linkedout/shared";
import { currentUserId } from "../middleware/auth.js";
import { parsedQuery } from "../middleware/validate.js";
import * as posts from "../services/post.service.js";

const id = (req: Request) => req.params.id as string;

export async function feed(req: Request, res: Response) {
  const { cursor, limit } = parsedQuery<PaginationInput>(req);
  res.json(await posts.feed(currentUserId(req), cursor, limit));
}

export async function get(req: Request, res: Response) {
  res.json({ post: await posts.getPost(currentUserId(req), id(req)) });
}

/** multipart/form-data: `content` field + optional `image` file. */
export async function create(req: Request, res: Response) {
  const { content } = createPostSchema.parse(req.body);
  res.status(201).json({ post: await posts.create(currentUserId(req), content, req.file) });
}

export async function remove(req: Request, res: Response) {
  await posts.remove(currentUserId(req), id(req));
  res.status(204).end();
}

export async function react(req: Request, res: Response) {
  res.json({ post: await posts.react(currentUserId(req), id(req), req.body.type) });
}

export async function unreact(req: Request, res: Response) {
  res.json({ post: await posts.unreact(currentUserId(req), id(req)) });
}

export async function listComments(req: Request, res: Response) {
  const { cursor, limit, parentId } = parsedQuery<ListCommentsInput>(req);
  res.json(await posts.listComments(id(req), parentId, cursor, limit));
}

export async function addComment(req: Request, res: Response) {
  const { content, parentId } = req.body as { content: string; parentId?: string };
  res.status(201).json({ comment: await posts.addComment(currentUserId(req), id(req), content, parentId) });
}

export async function deleteComment(req: Request, res: Response) {
  await posts.deleteComment(currentUserId(req), req.params.commentId as string);
  res.status(204).end();
}
