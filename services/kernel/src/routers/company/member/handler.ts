import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  createErrorResponse,
  encryptPassword,
  generateRandomId,
  generateRandomPassword,
  generateUID,
  getBetterAuthContext,
  PasswordUtils,
  registerOpenApiRoute,
} from "@proptryx/utils";
import { create } from "./openapi.route";
import { env } from "@/config/env";
import { account, db, member, organization, user } from "@proptryx/database";
import { and, eq } from "drizzle-orm";
import { emailSubject, renderMemberAccountCredEmail, sendEmail } from "@proptryx/notification";

export const companyMembersGroup = new OpenAPIHono<AppBindings>();

// Mutation routes
registerOpenApiRoute(companyMembersGroup, create, async (c) => {
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const [existingUserWithMember, orgData] = await Promise.all([
    db
      .select({
        userId: user.id,
        memberId: member.id,
        organizationId: member.organizationId,
      })
      .from(user)
      .leftJoin(
        member,
        and(
          eq(member.userId, user.id),
          eq(member.organizationId, body.organizationId),
          eq(member.isDeleted, false)
        )
      )
      .where(eq(user.email, body.email))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({ id: organization.id, name: organization.name })
      .from(organization)
      .where(and(eq(organization.id, body.organizationId), eq(organization.isDeleted, false)))
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  const emailExists = Boolean(existingUserWithMember?.userId);
  const memberExists = Boolean(existingUserWithMember?.memberId);

  if (emailExists) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "Client with this email already exists",
      }),
      409
    );
  }

  if (memberExists) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "This user is already a member of the company",
      }),
      409
    );
  }

  const userId = generateUID();
  const password = generateRandomPassword();
  const [hashedPassword, accId] = await Promise.all([
    PasswordUtils.hash(password),
    Promise.resolve(encryptPassword(password, env.BETTER_AUTH_SECRET)),
  ]);

  const memberData = await db.transaction(async (tx) => {
    // Step 1: Insert user
    await tx.insert(user).values({
      id: userId,
      name: body.name,
      email: body.email,
      phoneNumber: body.phoneNumber,
      zoneId: body.zoneId,
    });

    // Step 2: Insert account
    await tx.insert(account).values({
      id: accId,
      userId,
      accountId: generateRandomId(),
      providerId: "credential",
      password: hashedPassword,
    });

    // Step 3: Insert member
    const [memberInserted] = await tx
      .insert(member)
      .values({
        id: generateRandomId(),
        userId,
        panel: "company",
        organizationId: body.organizationId,
        role: body.role,
        createdByUser: currentUser?.id,
      })
      .returning();

    return memberInserted;
  });

  //send email
  if (memberData) {
    await sendEmail({
      to: body.email,
      subject: emailSubject["member-account-cred"].subject,
      html: await renderMemberAccountCredEmail({
        credEmail: body.email,
        credPassword: password,
        organizationName: orgData.name,
        role: memberData.role,
        previewText: emailSubject["member-account-cred"].previewText,
      }),
    });
  }

  return c.json(memberData, 201);
});
