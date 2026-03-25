import { z } from "zod";

export const gstNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Invalid GST number format.");

export const gstCheckBodySchema = z.object({
  gstNumber: gstNumberSchema,
});

export const gstInfoResponseSchema = z.object({
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
