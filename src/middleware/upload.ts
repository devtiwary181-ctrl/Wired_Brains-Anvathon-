/**
 * File Upload Middleware — DisasterReady India
 * Handles photo evidence uploads for hazard reports.
 * - Max 5 MB per file
 * - Only JPEG, PNG, WebP allowed
 * - Stored in /uploads/evidence/ (local disk; swap to GCS/S3 in prod)
 */
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { Request } from 'express';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads', 'evidence'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = `hazard_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    cb(null, `${safeBase}${ext}`);
  },
});

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('INVALID_FILE_TYPE: Only JPEG, PNG, and WebP images are accepted.'));
  }
}

export const evidenceUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter,
});
