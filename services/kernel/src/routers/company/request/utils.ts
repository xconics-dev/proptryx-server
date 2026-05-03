import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { company_request, db, gstInfoResponseSchema, organization } from "@proptryx/database";
import { and, eq } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

export const GST_REQUEST_EXISTS_MESSAGE =
  "A company request with this GST number has already been raised.";
export const GST_ORGANIZATION_EXISTS_MESSAGE =
  "A company with this GST number is already registered.";
const GST_INVALID_MESSAGE = "GST number is invalid or inactive.";
const GST_INACTIVE_MESSAGE = "GST number is inactive.";
const GST_UNAVAILABLE_MESSAGE =
  "GST verification is temporarily unavailable. Please try again in a moment.";
const GST_UPSTREAM_TIMEOUT_MS = 8000;

export async function findCompanyRequestById(id: string, options?: IncludeDeletedOptions) {
  const whereClause = options?.includeDeleted
    ? eq(company_request.id, id)
    : and(eq(company_request.id, id), eq(company_request.isDeleted, false));

  return db
    .select()
    .from(company_request)
    .where(whereClause)
    .limit(1)
    .then((rows) => rows[0]);
}

export async function fetchActiveGstInfo(gstNumber: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GST_UPSTREAM_TIMEOUT_MS);

  try {
    const normalizedGstNumber = gstNumber.trim().toUpperCase();
    const gstResponse = await fetch(
      `http://sheet.gstincheck.co.in/check/${encodeURIComponent(env.GST_API_KEY)}/${encodeURIComponent(normalizedGstNumber)}`,
      { signal: controller.signal }
    );
    const gstPayload = await gstResponse.json().catch(() => null);
    const gstParsedPayload = gstInfoResponseSchema.safeParse(gstPayload);

    if (!gstResponse.ok || !gstParsedPayload.success) {
      return {
        success: false as const,
        status: 400 as const,
        error: "Invalid GST" as const,
        message: GST_INVALID_MESSAGE,
      };
    }

    if (!gstParsedPayload.data.flag || gstParsedPayload.data.data?.sts !== "Active") {
      return {
        success: false as const,
        status: 400 as const,
        error: "Inactive GST" as const,
        message: gstParsedPayload.data.data?.sts ? GST_INACTIVE_MESSAGE : GST_INVALID_MESSAGE,
      };
    }

    return {
      success: true as const,
      data: gstParsedPayload.data,
    };
  } catch (error) {
    logger.error("[company.request.gst] GST upstream verification failed", {
      gstNumber,
      error: error instanceof Error ? error.stack : error,
    });

    return {
      success: false as const,
      status: 503 as const,
      error: "GST Verification Unavailable" as const,
      message: GST_UNAVAILABLE_MESSAGE,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function findCompanyRequestGstConflict(gstNumber: string) {
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

export const isCompanyRequestGstUniqueViolation = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "23505" &&
  "constraint" in error &&
  (error as { constraint?: string }).constraint === "company_request_gst_number_uidx";
