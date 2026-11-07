import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

export interface StoredFile {
  key: string;
  url: string;
}

/** Swap LocalDiskStorage for an S3/R2 implementation without touching callers. */
export interface Storage {
  save(buffer: Buffer, originalName: string, folder: string): Promise<StoredFile>;
  delete(key: string): Promise<void>;
}

export class LocalDiskStorage implements Storage {
  constructor(
    private readonly root: string,
    private readonly publicBaseUrl: string,
  ) {}

  async save(buffer: Buffer, originalName: string, folder: string): Promise<StoredFile> {
    const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".bin";
    const key = `${folder}/${crypto.randomUUID()}${ext}`;
    const fullPath = path.join(this.root, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
    return { key, url: `${this.publicBaseUrl}/uploads/${key}` };
  }

  async delete(key: string): Promise<void> {
    await fs.rm(path.join(this.root, key), { force: true });
  }
}

export const uploadRoot = path.resolve(env.UPLOAD_DIR);
export const storage: Storage = new LocalDiskStorage(uploadRoot, env.API_ORIGIN);
