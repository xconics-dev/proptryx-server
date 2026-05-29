import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { env } from "../config/env";
import type { SendPushToTokensOptions, SendPushToTokensResult } from "./types";

const FCM_BATCH_SIZE = 500;

function normalizePrivateKey(value?: string | null) {
  return value?.replace(/\\n/g, "\n");
}

function getFirebaseCredential() {
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    throw new Error(
      "Firebase Cloud Messaging is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
    );
  }

  return cert({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: normalizePrivateKey(env.FIREBASE_PRIVATE_KEY),
  });
}

export function isFirebasePushConfigured() {
  return Boolean(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY);
}

export function getFirebaseMessagingClient() {
  if (getApps().length === 0) {
    initializeApp({
      credential: getFirebaseCredential(),
      projectId: env.FIREBASE_PROJECT_ID,
    });
  }

  return getMessaging();
}

const chunk = <T>(items: T[], size: number) => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const toStringData = (data: SendPushToTokensOptions["payload"]["data"]) =>
  Object.fromEntries(
    Object.entries(data ?? {})
      .filter(([, value]) => value != null)
      .map(([key, value]) => [key, String(value)])
  );

export async function sendPushToTokens({
  tokens,
  payload,
  dryRun,
}: SendPushToTokensOptions): Promise<SendPushToTokensResult> {
  const uniqueTokens = [...new Set(tokens.map((token) => token.trim()).filter(Boolean))];

  if (uniqueTokens.length === 0) {
    return {
      requested: 0,
      successCount: 0,
      failureCount: 0,
      invalidTokens: [],
    };
  }

  const messaging = getFirebaseMessagingClient();
  const result: SendPushToTokensResult = {
    requested: uniqueTokens.length,
    successCount: 0,
    failureCount: 0,
    invalidTokens: [],
  };

  for (const tokenBatch of chunk(uniqueTokens, FCM_BATCH_SIZE)) {
    const response = await messaging.sendEachForMulticast(
      {
        tokens: tokenBatch,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.image ?? undefined,
        },
        webpush: {
          headers: {
            Urgency: payload.priority === "high" ? "high" : "normal",
            TTL: "2419200",
          },
          notification: {
            title: payload.title,
            body: payload.body,
            icon: payload.icon ?? undefined,
            image: payload.image ?? undefined,
            badge: payload.badge ?? undefined,
            tag: payload.tag ?? undefined,
            renotify: true,
            actions: payload.actions,
          },
          fcmOptions: {
            link: payload.actionUrl ?? undefined,
          },
        },
        data: toStringData({
          ...payload.data,
          title: payload.title,
          body: payload.body,
          icon: payload.icon,
          image: payload.image,
          badge: payload.badge,
          actionUrl: payload.actionUrl,
          link: payload.actionUrl,
          click_action: payload.actionUrl,
          tag: payload.tag,
        }),
      },
      dryRun
    );

    result.successCount += response.successCount;
    result.failureCount += response.failureCount;

    response.responses.forEach((item, index) => {
      const code = item.error?.code;

      if (
        code === "messaging/invalid-registration-token" ||
        code === "messaging/registration-token-not-registered"
      ) {
        result.invalidTokens.push(tokenBatch[index]);
      }
    });
  }

  return result;
}
