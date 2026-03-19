import { z } from "zod";

export const idNumberParamSchema = z.object({
  id: z.number().int().min(1).pipe(z.coerce.number()),
});

export const idStringParamSchema = z.object({
  id: z.string().min(1),
});
