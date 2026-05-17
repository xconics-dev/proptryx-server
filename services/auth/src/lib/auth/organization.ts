import { APIError, type BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { company_request, gstCheckBodySchema, organization } from "@proptryx/database";
import { fetchGstInfoFromUpstream, GST_INVALID_MESSAGE } from "@proptryx/utils";
import { and, eq } from "drizzle-orm";
import { resolveAuthDatabase } from "./utils";

const GST_REQUEST_EXISTS_MESSAGE =
  "A company request with this GST number has already been raised.";
const GST_ORGANIZATION_EXISTS_MESSAGE = "A company with this GST number is already registered.";
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

    const gstResult = await fetchGstInfoFromUpstream({
      apiKey: env.GST_API_KEY,
      gstNumber,
    });

    if (!gstResult.success) {
      if (gstResult.status === 503) {
        logger.error("[auth.organization.gst] GST upstream verification failed", {
          gstNumber,
          error: gstResult.cause instanceof Error ? gstResult.cause.stack : gstResult.cause,
        });
      }

      throw new APIError(gstResult.status === 400 ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR", {
        message: gstResult.message,
      });
    }

    if (!gstResult.data.flag || gstResult.data.data?.sts !== "Active") {
      throw new APIError("BAD_REQUEST", {
        message: GST_INVALID_MESSAGE,
      });
    }

    return ctx.json({
      success: true,
      message: "Company GST info fetched successfully.",
      data: gstResult.data,
    });
  }
);

export const organizationControlsPlugin = {
  id: "organization-controls",
  endpoints: {
    organizationGstCheck: gstCheckEndpoint,
  },
} satisfies BetterAuthPlugin;
