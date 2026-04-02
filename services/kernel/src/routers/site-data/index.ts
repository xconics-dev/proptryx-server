import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { faqsGroup } from "./faqs/handler";
import { testimonialsGroup } from "./testimonials/handler";

export const siteDataGroup = new OpenAPIHono<AppBindings>();

siteDataGroup.route("/faqs", faqsGroup);
siteDataGroup.route("/testimonials", testimonialsGroup);
