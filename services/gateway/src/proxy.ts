import { env } from "@/config/env";

export interface ProxyRoute {
  prefix: string;
  target: string;
  stripPrefix?: boolean;
}

export const proxyRoutes: ProxyRoute[] = [
  // Keep /api/auth prefix for Better Auth basePath/public URL consistency.
  { prefix: "/api/auth", target: env.AUTH_SERVICE_URL, stripPrefix: false },
  { prefix: "/api/kernel", target: env.KERNEL_SERVICE_URL, stripPrefix: true },
];

export function createUpstreamUrl(requestUrl: string, route: ProxyRoute) {
  const incomingUrl = new URL(requestUrl);
  const shouldStripPrefix = route.stripPrefix ?? true;
  const remainingPath = shouldStripPrefix
    ? incomingUrl.pathname.slice(route.prefix.length) || "/"
    : incomingUrl.pathname || "/";

  return new URL(`${remainingPath}${incomingUrl.search}`, route.target).toString();
}
