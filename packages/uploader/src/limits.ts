import { isDocumentMimeType, isImageMimeType, type UploadMimeType } from "./mime";

export const IMAGE_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const DOCUMENT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const UPLOAD_MAX_FILE_SIZE_BYTES = {
  image: IMAGE_MAX_FILE_SIZE_BYTES,
  document: DOCUMENT_MAX_FILE_SIZE_BYTES,
} as const;

export type UploadFileKind = keyof typeof UPLOAD_MAX_FILE_SIZE_BYTES;

export function isValidFileSize(fileSize: number): boolean {
  return Number.isInteger(fileSize) && fileSize >= 0;
}

export function getUploadFileKind(mimeType: string): UploadFileKind | null {
  if (isImageMimeType(mimeType)) {
    return "image";
  }

  if (isDocumentMimeType(mimeType)) {
    return "document";
  }

  return null;
}

export function getUploadFileSizeLimit(mimeType: UploadMimeType): number {
  return isImageMimeType(mimeType) ? IMAGE_MAX_FILE_SIZE_BYTES : DOCUMENT_MAX_FILE_SIZE_BYTES;
}

export function isWithinImageSizeLimit(
  fileSize: number,
  maxBytes = IMAGE_MAX_FILE_SIZE_BYTES
): boolean {
  return isValidFileSize(fileSize) && fileSize <= maxBytes;
}

export function isWithinDocumentSizeLimit(
  fileSize: number,
  maxBytes = DOCUMENT_MAX_FILE_SIZE_BYTES
): boolean {
  return isValidFileSize(fileSize) && fileSize <= maxBytes;
}

export function isWithinUploadSizeLimit(fileSize: number, mimeType: string): boolean {
  if (isImageMimeType(mimeType)) {
    return isWithinImageSizeLimit(fileSize);
  }

  if (isDocumentMimeType(mimeType)) {
    return isWithinDocumentSizeLimit(fileSize);
  }

  return false;
}
