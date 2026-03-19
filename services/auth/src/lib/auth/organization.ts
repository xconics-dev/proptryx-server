import { APIError, type BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, createAuthMiddleware, sessionMiddleware } from "better-auth/api";
import { z } from "zod";
import { env } from "@/config/env";

const gstNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Invalid GST number format.");

const gstCheckBodySchema = z.object({
  gstNumber: gstNumberSchema,
});

const gstInfoResponseSchema = z.object({
  flag: z.boolean().optional(),
  message: z.string().optional(),
  data: z
    .object({
      ntcrbs: z.string().optional(),
      adhrVFlag: z.string().optional(),
      lgnm: z.string().optional(),
      stj: z.string().optional(),
      dty: z.string().optional(),
      cxdt: z.string().optional(),
      gstin: z.string().optional(),
      nba: z.array(z.string()).optional(),
      ekycVFlag: z.string().optional(),
      cmpRt: z.string().optional(),
      rgdt: z.string().optional(),
      ctb: z.string().optional(),
      pradr: z
        .object({
          adr: z.string().optional(),
          addr: z
            .object({
              flno: z.string().optional(),
              lg: z.string().optional(),
              loc: z.string().optional(),
              pncd: z.string().optional(),
              bnm: z.string().optional(),
              city: z.string().optional(),
              lt: z.string().optional(),
              stcd: z.string().optional(),
              bno: z.string().optional(),
              dst: z.string().optional(),
              st: z.string().optional(),
            })
            .optional(),
        })
        .optional(),
      sts: z.string().optional(),
      tradeNam: z.string().nullish(),
      isFieldVisitConducted: z.string().optional(),
      adhrVdt: z.string().optional(),
      ctj: z.string().optional(),
      einvoiceStatus: z.string().optional(),
      lstupdt: z.string().optional(),
      adadr: z.array(z.unknown()).optional(),
      ctjCd: z.string().optional(),
      errorMsg: z.string().nullish(),
      stjCd: z.string().optional(),
    })
    .optional(),
});

// const signedInSessionMiddleware = createAuthMiddleware(
//   {
//     use: [sessionMiddleware],
//   },
//   async (ctx) => {
//     const session = ctx.context.session as { user?: { id?: string } } | undefined;

//     if (!session?.user?.id) {
//       throw new APIError("UNAUTHORIZED", {
//         message: "Authentication required.",
//       });
//     }

//     return {
//       session,
//     };
//   }
// );

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
    let payload: unknown;

    try {
      const response = await fetch(
        `http://sheet.gstincheck.co.in/check/${encodeURIComponent(env.GST_API_KEY)}/${encodeURIComponent(ctx.body.gstNumber)}`
      );

      if (!response.ok) {
        throw new APIError("INTERNAL_SERVER_ERROR", {
          message: "Failed to fetch GST details from upstream service.",
        });
      }

      payload = await response.json();
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }

      throw new APIError("INTERNAL_SERVER_ERROR", {
        message: "Unable to fetch GST information at the moment.",
      });
    }

    const parsedPayload = gstInfoResponseSchema.safeParse(payload);

    if (
      !parsedPayload.success ||
      !parsedPayload.data.flag ||
      parsedPayload.data.data?.sts !== "Active"
    ) {
      throw new APIError("BAD_REQUEST", {
        message: "GST number is invalid or inactive.",
      });
    }

    return ctx.json({
      success: true,
      message: "Company GST info fetched successfully.",
      data: {
        gstNumber: ctx.body.gstNumber,
        tradeName: parsedPayload.data.data?.tradeNam ?? null,
        status: parsedPayload.data.data?.sts ?? null,
      },
    });
  }
);

export const organizationControlsPlugin = {
  id: "organization-controls",
  endpoints: {
    organizationGstCheck: gstCheckEndpoint,
  },
} satisfies BetterAuthPlugin;
