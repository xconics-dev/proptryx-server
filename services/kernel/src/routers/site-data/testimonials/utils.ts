import { db, property, testimonial } from "@proptryx/database";
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

export async function findActivePropertyById(id: string) {
  return db
    .select({ id: property.id })
    .from(property)
    .where(and(eq(property.id, id), eq(property.isDeleted, false)))
    .limit(1)
    .then((rows) => rows[0]);
}
