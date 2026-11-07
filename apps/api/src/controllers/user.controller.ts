import type { Request, Response } from "express";
import type { PaginationInput } from "@linkedout/shared";
import { badRequest } from "../lib/errors.js";
import { currentUserId } from "../middleware/auth.js";
import { parsedQuery } from "../middleware/validate.js";
import * as connections from "../services/connection.service.js";
import * as posts from "../services/post.service.js";
import * as users from "../services/user.service.js";

const id = (req: Request) => req.params.id as string;

export async function getProfile(req: Request, res: Response) {
  res.json({ profile: await users.getProfile(id(req)) });
}

export async function getExperience(req: Request, res: Response) {
  res.json({ items: await users.getExperience(id(req)) });
}

export async function getPosts(req: Request, res: Response) {
  const { cursor, limit } = parsedQuery<PaginationInput>(req);
  res.json(await posts.byAuthor(currentUserId(req), id(req), cursor, limit));
}

export async function updateMe(req: Request, res: Response) {
  res.json({ user: await users.updateProfile(currentUserId(req), req.body) });
}

export const uploadImage = (kind: "avatar" | "banner") => async (req: Request, res: Response) => {
  if (!req.file) throw badRequest("Attach an image in the 'image' field");
  res.json({ user: await users.setImage(currentUserId(req), kind, req.file) });
};

export async function listConnections(req: Request, res: Response) {
  res.json({ items: await connections.listConnections(currentUserId(req)) });
}

export async function listPending(req: Request, res: Response) {
  res.json({ items: await connections.listPending(currentUserId(req)) });
}

export async function requestConnection(req: Request, res: Response) {
  res.status(201).json({ connection: await connections.request(currentUserId(req), id(req)) });
}

export async function acceptConnection(req: Request, res: Response) {
  res.json({ connection: await connections.accept(currentUserId(req), id(req)) });
}

export async function removeConnection(req: Request, res: Response) {
  await connections.remove(currentUserId(req), id(req));
  res.status(204).end();
}
