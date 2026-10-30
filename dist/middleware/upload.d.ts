/**
 * File Upload Middleware — DisasterReady India
 * Handles photo evidence uploads for hazard reports.
 * - Max 5 MB per file
 * - Only JPEG, PNG, WebP allowed
 * - Stored in /uploads/evidence/ (local disk; swap to GCS/S3 in prod)
 */
import multer from 'multer';
export declare const evidenceUpload: multer.Multer;
