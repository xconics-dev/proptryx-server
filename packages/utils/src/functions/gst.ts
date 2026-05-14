import { gstInfoResponseSchema } from "@proptryx/database";
import type { z } from "zod";

export const DEFAULT_GST_UPSTREAM_TIMEOUT_MS = 5000;

export const GST_INVALID_MESSAGE = "GST number is invalid or inactive.";
export const GST_UNAVAILABLE_MESSAGE =
  "GST verification is temporarily unavailable. Please try again in a moment.";

type GstInfo = z.infer<typeof gstInfoResponseSchema>;

type FetchGstInfoOptions = {
  apiKey: string;
  gstNumber: string;
  timeoutMs?: number;
};

type FetchGstInfoResult =
  | {
      success: true;
      data: GstInfo;
    }
  | {
      success: false;
      status: 400 | 503;
      error: "Invalid GST" | "GST Verification Unavailable";
      message: string;
      cause?: unknown;
    };

const isInvalidGstStatus = (status: number) => status === 400 || status === 404;

export async function fetchGstInfoFromUpstream({
  apiKey,
  gstNumber,
  timeoutMs = DEFAULT_GST_UPSTREAM_TIMEOUT_MS,
}: FetchGstInfoOptions): Promise<FetchGstInfoResult> {
  const normalizedGstNumber = gstNumber.trim().toUpperCase();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `http://sheet.gstincheck.co.in/check/${encodeURIComponent(apiKey)}/${encodeURIComponent(normalizedGstNumber)}`,
      { signal: controller.signal }
    );
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      if (isInvalidGstStatus(response.status)) {
        return {
          success: false,
          status: 400,
          error: "Invalid GST",
          message: GST_INVALID_MESSAGE,
        };
      }

      return {
        success: false,
        status: 503,
        error: "GST Verification Unavailable",
        message: GST_UNAVAILABLE_MESSAGE,
        cause: payload,
      };
    }

    const parsedPayload = gstInfoResponseSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return {
        success: false,
        status: 503,
        error: "GST Verification Unavailable",
        message: GST_UNAVAILABLE_MESSAGE,
        cause: parsedPayload.error,
      };
    }

    return {
      success: true,
      data: parsedPayload.data,
    };
  } catch (error) {
    return {
      success: false,
      status: 503,
      error: "GST Verification Unavailable",
      message: GST_UNAVAILABLE_MESSAGE,
      cause: error,
    };
  } finally {
    clearTimeout(timeout);
  }
}
