import { readFile } from "node:fs/promises";
import path from "node:path";
import { resolveSharedStaticPath } from "@proptryx/static";
import type { Context } from "hono";

export interface FaviconHandlerOptions {
  filePath?: string;
  cacheControl?: string;
}

export function createFaviconHandler(options: FaviconHandlerOptions = {}) {
  const faviconPath = options.filePath ?? resolveSharedStaticPath("logo", "favicon.png");
  const extension = path.extname(faviconPath).toLowerCase();
  const contentType =
    extension === ".svg"
      ? "image/svg+xml"
      : extension === ".png"
        ? "image/png"
        : extension === ".ico"
          ? "image/x-icon"
          : "application/octet-stream";
  let cachedFavicon: ArrayBuffer | null = null;

  return async (c: Context) => {
    try {
      if (!cachedFavicon) {
        const fileContent = await readFile(faviconPath);
        cachedFavicon = fileContent.buffer.slice(
          fileContent.byteOffset,
          fileContent.byteOffset + fileContent.byteLength
        );
      }

      return new Response(cachedFavicon!, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": options.cacheControl ?? "public, max-age=86400",
        },
      });
    } catch {
      return c.json(
        {
          success: false,
          error: "Not Found",
          message: `Favicon is missing at ${faviconPath}`,
        },
        404
      );
    }
  };
}
