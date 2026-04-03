import { z } from "zod";

export const IMAGE_MIME_PREFIX = "image/" as const;

export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const UPLOAD_FILE_TYPES = ["image/*", ...DOCUMENT_MIME_TYPES] as const;

const IMAGE_MIME_SCHEMA = z
  .string()
  .regex(/^image\/[a-z0-9.+-]+$/i, "Must be a valid image MIME type");

const DOCUMENT_MIME_SCHEMA = z.enum(DOCUMENT_MIME_TYPES);

export type DocumentMimeType = (typeof DOCUMENT_MIME_TYPES)[number];
export type ImageMimeType = `${typeof IMAGE_MIME_PREFIX}${string}`;
export type UploadMimeType = ImageMimeType | DocumentMimeType;

export function isImageMimeType(mimeType: string): mimeType is ImageMimeType {
  return IMAGE_MIME_SCHEMA.safeParse(mimeType).success;
}

export function isDocumentMimeType(mimeType: string): mimeType is DocumentMimeType {
  return DOCUMENT_MIME_SCHEMA.safeParse(mimeType).success;
}

export function isUploadMimeType(mimeType: string): mimeType is UploadMimeType {
  return isImageMimeType(mimeType) || isDocumentMimeType(mimeType);
}
