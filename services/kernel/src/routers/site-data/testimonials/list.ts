import { getDB, testimonial } from "@proptryx/database";
import { createTableListFetcher } from "@proptryx/utils";
import { eq } from "drizzle-orm";
import type { TestimonialListQuery } from "./schema";

export const fetchTestimonialList = createTableListFetcher<
  typeof testimonial,
  typeof testimonial.$inferSelect,
  TestimonialListQuery
>({
  db: getDB,
  table: testimonial,
  where: ({ params }) => (params.includeDeleted ? undefined : eq(testimonial.isDeleted, false)),
  search: {
    exact: [testimonial.id],
    contains: [testimonial.authorName, testimonial.designation, testimonial.description],
  },
  filterColumns: {
    isArchived: testimonial.isArchived,
    propertyId: testimonial.propertyId,
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    id: testimonial.id,
    propertyId: testimonial.propertyId,
    authorName: testimonial.authorName,
    designation: testimonial.designation,
    ratings: testimonial.ratings,
    isArchived: testimonial.isArchived,
    createdAt: testimonial.createdAt,
    updatedAt: testimonial.updatedAt,
  },
});
