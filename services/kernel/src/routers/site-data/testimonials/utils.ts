import { db, testimonial } from "@proptryx/database";
import { and, eq } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

export async function findTestimonialById(id: string, options?: IncludeDeletedOptions) {
  const whereClause = options?.includeDeleted
    ? eq(testimonial.id, id)
    : and(eq(testimonial.id, id), eq(testimonial.isDeleted, false));

  return db
    .select()
    .from(testimonial)
    .where(whereClause)
    .limit(1)
    .then((rows) => rows[0]);
}
