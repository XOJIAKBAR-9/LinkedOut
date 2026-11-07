import multer from "multer";
import { badRequest } from "../lib/errors.js";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Files stay in memory and are handed to the Storage interface by the service layer. */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(badRequest("Only JPEG, PNG, WebP or GIF images are allowed", "INVALID_FILE_TYPE"));
  },
});
