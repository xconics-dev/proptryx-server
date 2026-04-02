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
  where: eq(testimonial.isDeleted, false),
  search: {
    exact: [testimonial.id],
    contains: [testimonial.authorName, testimonial.designation, testimonial.description],
  },
  filterColumns: {
    isArchived: testimonial.isArchived,
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    id: testimonial.id,
    authorName: testimonial.authorName,
    designation: testimonial.designation,
    ratings: testimonial.ratings,
    isArchived: testimonial.isArchived,
    createdAt: testimonial.createdAt,
    updatedAt: testimonial.updatedAt,
  },
});
