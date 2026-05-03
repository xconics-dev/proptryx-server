import { APIError, type BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import {
  company_request,
  gstCheckBodySchema,
  gstInfoResponseSchema,
  organization,
} from "@proptryx/database";
import { and, eq } from "drizzle-orm";
import { resolveAuthDatabase } from "./utils";

const GST_REQUEST_EXISTS_MESSAGE =
  "A company request with this GST number has already been raised.";
const GST_ORGANIZATION_EXISTS_MESSAGE = "A company with this GST number is already registered.";
const GST_INVALID_MESSAGE = "GST number is invalid or inactive.";
const GST_UNAVAILABLE_MESSAGE =
  "GST verification is temporarily unavailable. Please try again in a moment.";
const GST_UPSTREAM_TIMEOUT_MS = 8000;

async function findGstConflict(gstNumber: string) {
  const db = resolveAuthDatabase();

  const [existingOrganization, existingCompanyRequest] = await Promise.all([
    db
      .select({ id: organization.id })
      .from(organization)
      .where(and(eq(organization.gstNumber, gstNumber), eq(organization.isDeleted, false)))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({ id: company_request.id })
      .from(company_request)
      .where(
        and(eq(company_request.companyGstNumber, gstNumber), eq(company_request.isDeleted, false))
      )
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  if (existingOrganization) {
    return {
      code: "GST_ORGANIZATION_EXISTS",
      message: GST_ORGANIZATION_EXISTS_MESSAGE,
    } as const;
  }

  if (existingCompanyRequest) {
    return {
      code: "GST_COMPANY_REQUEST_EXISTS",
      message: GST_REQUEST_EXISTS_MESSAGE,
    } as const;
  }

  return null;
}

const gstCheckEndpoint = createAuthEndpoint(
  "/organization/gst-check",
  {
    method: "POST",
    body: gstCheckBodySchema,
    metadata: {
      openapi: {
        summary: "Check organization GST details",
        description: "Validates GST number and returns active company trade details",
        responses: {
          200: {
            description: "GST information fetched successfully",
          },
        },
      },
    },
    // use: [signedInSessionMiddleware],
  },
  async (ctx) => {
    const gstNumber = ctx.body.gstNumber;
    const isExistingCompanyCheck = ctx.body.isExistingCompanyCheck;
    const existingConflict = await findGstConflict(gstNumber);

    if (existingConflict && isExistingCompanyCheck) {
      throw new APIError("BAD_REQUEST", {
        message: existingConflict.message,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GST_UPSTREAM_TIMEOUT_MS);
    let payload: unknown;

    try {
      const response = await fetch(
        `http://sheet.gstincheck.co.in/check/${encodeURIComponent(env.GST_API_KEY)}/${encodeURIComponent(gstNumber)}`,
        { signal: controller.signal }
      );

      payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new APIError("BAD_REQUEST", {
          message: GST_INVALID_MESSAGE,
        });
      }
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }

      logger.error("[auth.organization.gst] GST upstream verification failed", {
        gstNumber,
        error: error instanceof Error ? error.stack : error,
      });

      throw new APIError("INTERNAL_SERVER_ERROR", {
        message: GST_UNAVAILABLE_MESSAGE,
      });
    } finally {
      clearTimeout(timeout);
    }

    const parsedPayload = gstInfoResponseSchema.safeParse(payload);

    if (
      !parsedPayload.success ||
      !parsedPayload.data.flag ||
      parsedPayload.data.data?.sts !== "Active"
    ) {
      throw new APIError("BAD_REQUEST", {
        message: GST_INVALID_MESSAGE,
      });
    }

    return ctx.json({
      success: true,
      message: "Company GST info fetched successfully.",
      data: parsedPayload.data,
    });
  }
);

export const organizationControlsPlugin = {
  id: "organization-controls",
  endpoints: {
    organizationGstCheck: gstCheckEndpoint,
  },
} satisfies BetterAuthPlugin;
