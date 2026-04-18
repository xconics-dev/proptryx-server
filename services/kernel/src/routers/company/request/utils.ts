import { env } from "@/config/env";
import { company_request, db, gstInfoResponseSchema, organization } from "@proptryx/database";
import { and, eq } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

export const GST_REQUEST_EXISTS_MESSAGE =
  "A company request with this GST number has already been raised.";
export const GST_ORGANIZATION_EXISTS_MESSAGE =
  "A company with this GST number is already registered.";

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
  const gstResponse = await fetch(
    `http://sheet.gstincheck.co.in/check/${encodeURIComponent(env.GST_API_KEY)}/${encodeURIComponent(gstNumber)}`
  );

  if (!gstResponse.ok) {
    return {
      success: false as const,
      status: 400 as const,
      error: "Invalid GST" as const,
      message: "GST number is invalid or inactive.",
    };
  }

  const gstPayload = await gstResponse.json();
  const gstParsedPayload = gstInfoResponseSchema.safeParse(gstPayload);

  if (!gstParsedPayload.success) {
    return {
      success: false as const,
      status: 400 as const,
      error: "Invalid GST" as const,
      message: "GST number is invalid or inactive.",
    };
  }

  if (gstParsedPayload.data.data?.sts !== "Active") {
    return {
      success: false as const,
      status: 400 as const,
      error: "Inactive GST" as const,
      message: "GST number is inactive.",
    };
  }

  return {
    success: true as const,
    data: gstParsedPayload.data,
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
      .where(eq(company_request.companyGstNumber, gstNumber))
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
