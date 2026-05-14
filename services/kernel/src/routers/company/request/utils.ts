import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { company_request, db, organization } from "@proptryx/database";
import { fetchGstInfoFromUpstream, GST_INVALID_MESSAGE } from "@proptryx/utils";
import { and, eq } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

export const GST_REQUEST_EXISTS_MESSAGE =
  "A company request with this GST number has already been raised.";
export const GST_ORGANIZATION_EXISTS_MESSAGE =
  "A company with this GST number is already registered.";
const GST_INACTIVE_MESSAGE = "GST number is inactive.";

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
  const gstResult = await fetchGstInfoFromUpstream({
    apiKey: env.GST_API_KEY,
    gstNumber,
  });

  if (!gstResult.success) {
    if (gstResult.status === 503) {
      logger.error("[company.request.gst] GST upstream verification failed", {
        gstNumber,
        error: gstResult.cause instanceof Error ? gstResult.cause.stack : gstResult.cause,
      });
    }

    return {
      success: false as const,
      status: gstResult.status,
      error: gstResult.error,
      message: gstResult.message,
    };
  }

  if (!gstResult.data.flag || gstResult.data.data?.sts !== "Active") {
    return {
      success: false as const,
      status: 400 as const,
      error: "Inactive GST" as const,
      message: gstResult.data.data?.sts ? GST_INACTIVE_MESSAGE : GST_INVALID_MESSAGE,
    };
  }

  return {
    success: true as const,
    data: gstResult.data,
  };
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
