import type { ServerType } from "@hono/node-server";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { logger } from "@/lib/logger";
import { createUpstreamUrl, proxyRoutes, type ProxyRoute } from "@/proxy";

const WEBSOCKET_REQUEST_HEADERS = new Set([
  "connection",
  "host",
  "sec-websocket-accept",
  "sec-websocket-extensions",
  "sec-websocket-key",
  "sec-websocket-protocol",
  "sec-websocket-version",
  "upgrade",
]);

const DEFAULT_WEBSOCKET_CLOSE_CODE = 1011;
const MAX_WEBSOCKET_CLOSE_REASON_BYTES = 123;
const UNSENDABLE_WEBSOCKET_CLOSE_CODES = new Set([1004, 1005, 1006, 1015]);

function resolveNotificationSocketRoute(pathname: string) {
  if (pathname !== "/api/notifications/me/socket") {
    return null;
  }

  return proxyRoutes.find((route) => route.prefix === "/api/notifications") ?? null;
}

function createSocketUpstreamUrl(request: IncomingMessage, route: ProxyRoute) {
  const host = request.headers.host ?? "localhost";
  const requestUrl = new URL(request.url ?? "/", `http://${host}`);
  const upstreamUrl = new URL(createUpstreamUrl(requestUrl.toString(), route));

  upstreamUrl.protocol = upstreamUrl.protocol === "https:" ? "wss:" : "ws:";

  return upstreamUrl;
}

function createSocketHeaders(request: IncomingMessage, route: ProxyRoute) {
  const headers: Record<string, string> = {};
  const targetUrl = new URL(route.target);

  for (const [key, value] of Object.entries(request.headers)) {
    const normalizedKey = key.toLowerCase();

    if (WEBSOCKET_REQUEST_HEADERS.has(normalizedKey)) {
      continue;
    }

    if (Array.isArray(value)) {
      headers[key] = value.join(", ");
      continue;
    }

    if (typeof value === "string") {
      headers[key] = value;
    }
  }

  headers.host = targetUrl.host;
  headers["x-forwarded-host"] = request.headers.host ?? targetUrl.host;
  headers["x-forwarded-proto"] = "ws";
  headers["x-forwarded-prefix"] = route.prefix;

  return headers;
}

function isSendableCloseCode(code: number) {
  if (UNSENDABLE_WEBSOCKET_CLOSE_CODES.has(code)) {
    return false;
  }

  return (code >= 1000 && code <= 1014) || (code >= 3000 && code <= 4999);
}

function resolveCloseCode(code?: number) {
  return typeof code === "number" && isSendableCloseCode(code)
    ? code
    : DEFAULT_WEBSOCKET_CLOSE_CODE;
}

function resolveCloseReason(reason?: RawData | string) {
  if (!reason) {
    return undefined;
  }

  let text: string;

  if (typeof reason === "string") {
    text = reason;
  } else if (Array.isArray(reason)) {
    text = Buffer.concat(reason).toString("utf8");
  } else if (reason instanceof ArrayBuffer) {
    text = Buffer.from(new Uint8Array(reason)).toString("utf8");
  } else {
    text = reason.toString("utf8");
  }

  if (!text) {
    return undefined;
  }

  if (Buffer.byteLength(text, "utf8") <= MAX_WEBSOCKET_CLOSE_REASON_BYTES) {
    return text;
  }

  let trimmed = "";

  for (const character of text) {
    const next = `${trimmed}${character}`;

    if (Buffer.byteLength(next, "utf8") > MAX_WEBSOCKET_CLOSE_REASON_BYTES) {
      break;
    }

    trimmed = next;
  }

  return trimmed || undefined;
}

function closeSocket(
  socket: WebSocket,
  code = DEFAULT_WEBSOCKET_CLOSE_CODE,
  reason: RawData | string = "Notification socket unavailable"
) {
  if (socket.readyState === WebSocket.CONNECTING) {
    socket.terminate();
    return;
  }

  if (socket.readyState === WebSocket.OPEN) {
    socket.close(resolveCloseCode(code), resolveCloseReason(reason));
  }
}

export function attachGatewayWebSocketProxy(server: ServerType) {
  const notificationSocketProxy = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const host = request.headers.host ?? "localhost";
    const requestUrl = new URL(request.url ?? "/", `http://${host}`);
    const route = resolveNotificationSocketRoute(requestUrl.pathname);

    if (!route) {
      return;
    }

    notificationSocketProxy.handleUpgrade(request, socket, head, (clientSocket) => {
      const upstreamUrl = createSocketUpstreamUrl(request, route);
      const upstreamSocket = new WebSocket(upstreamUrl, {
        headers: createSocketHeaders(request, route),
      });
      const pendingMessages: RawData[] = [];

      upstreamSocket.on("open", () => {
        for (const message of pendingMessages.splice(0)) {
          upstreamSocket.send(message);
        }

        logger.info("proxied websocket", {
          prefix: route.prefix,
          upstreamPath: upstreamUrl.pathname,
          target: route.target,
        });
      });

      clientSocket.on("message", (message) => {
        if (upstreamSocket.readyState === WebSocket.OPEN) {
          upstreamSocket.send(message);
          return;
        }

        pendingMessages.push(message);
      });

      upstreamSocket.on("message", (message, isBinary) => {
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(message, { binary: isBinary });
        }
      });

      clientSocket.on("close", (code, reason) => {
        pendingMessages.length = 0;
        closeSocket(upstreamSocket, code, reason);
      });

      upstreamSocket.on("close", (code, reason) => {
        pendingMessages.length = 0;
        closeSocket(clientSocket, code, reason);
      });

      clientSocket.on("error", (error) => {
        logger.error("gateway websocket client error", { error });
        closeSocket(upstreamSocket);
      });

      upstreamSocket.on("error", (error) => {
        logger.error("gateway websocket upstream error", {
          error,
          prefix: route.prefix,
          target: route.target,
        });
        closeSocket(clientSocket);
      });
    });
  });
}
