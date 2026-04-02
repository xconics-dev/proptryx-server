import { faq, getDB } from "@proptryx/database";
import { createTableListFetcher } from "@proptryx/utils";
import { eq } from "drizzle-orm";
import type { FaqListQuery } from "./schema";

export const fetchFaqList = createTableListFetcher<
  typeof faq,
  typeof faq.$inferSelect,
  FaqListQuery
>({
  db: getDB,
  table: faq,
  where: eq(faq.isDeleted, false),
  search: {
    exact: [faq.id],
    contains: [faq.question, faq.answer],
  },
  filterColumns: {
    isArchived: faq.isArchived,
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    id: faq.id,
    question: faq.question,
    isArchived: faq.isArchived,
    createdAt: faq.createdAt,
    updatedAt: faq.updatedAt,
  },
});
