import { env } from "@/config/env";

export interface ProxyRoute {
  prefix: string;
  target: string;
}

export const proxyRoutes: ProxyRoute[] = [
  { prefix: "/api/auth", target: env.AUTH_SERVICE_URL },
  { prefix: "/api/property", target: env.PROPERTY_SERVICE_URL },
];

export function createUpstreamUrl(requestUrl: string, route: ProxyRoute) {
  const incomingUrl = new URL(requestUrl);
  const remainingPath = incomingUrl.pathname.slice(route.prefix.length) || "/";

  return new URL(`${remainingPath}${incomingUrl.search}`, route.target).toString();
}
