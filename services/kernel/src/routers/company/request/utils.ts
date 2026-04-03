import { env } from "@/config/env";
import { company_request, db, gstInfoResponseSchema } from "@proptryx/database";
import { and, eq } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

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
