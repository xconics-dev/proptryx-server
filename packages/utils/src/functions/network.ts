export const SECURITY_CORS_ALLOW_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
] as const;

export const SECURITY_CORS_ALLOW_HEADERS = [
  "Content-Type",
  "Authorization",
  "X-Request-Id",
  "Set-Auth-Token",
  "X-Razorpay-Signature",
] as const;

export const SECURITY_CORS_EXPOSE_HEADERS = ["X-Request-Id", "Set-Auth-Token"] as const;

export const CLIENT_IP_HEADER_CANDIDATES = [
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
  "true-client-ip",
  "x-client-ip",
] as const;

export const AUTH_SESSION_FORWARD_HEADERS = [
  "authorization",
  "cookie",
  "user-agent",
  "x-forwarded-for",
  "x-real-ip",
  "x-request-id",
] as const;

export function normalizeForwardedIp(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const first = value
    .split(",")[0]
    ?.trim()
    .replace(/^\[|\]$/g, "");
  if (!first) {
    return undefined;
  }

  // Handle IPv4 with port, e.g. 203.0.113.10:52341
  if (first.includes(".") && first.includes(":")) {
    const [host] = first.split(":");
    return host?.trim() || undefined;
  }

  return first;
}

export function resolveClientIpFromHeaderGetter(
  getHeader: (headerName: string) => string | undefined
) {
  for (const headerName of CLIENT_IP_HEADER_CANDIDATES) {
    const value = normalizeForwardedIp(getHeader(headerName));
    if (value) {
      return value;
    }
  }

  return undefined;
}
