import { fileURLToPath } from "node:url";
import path from "node:path";

const packageDistDirectory = path.dirname(fileURLToPath(import.meta.url));

export const staticPackageRoot = path.resolve(packageDistDirectory, "..");

export function resolveSharedStaticPath(...segments: string[]) {
  return path.join(staticPackageRoot, ...segments);
}
