import { APIError, type BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { env } from "@/config/env";
import { gstCheckBodySchema, gstInfoResponseSchema } from "@/schema";

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
