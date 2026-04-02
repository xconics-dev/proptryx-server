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
import { create, remove, remove_with_user, update } from "./openapi.route";
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
      panel: "company",
      role: "seller",
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

registerOpenApiRoute(companyMembersGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingMember = await db
    .select()
    .from(member)
    .where(and(eq(member.id, id), eq(member.isDeleted, false)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existingMember) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  const [updatedMember] = await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({
        name: body.name,
        email: body.email,
        image: body.image,
        phoneNumber: body.phoneNumber,
        zoneId: body.zoneId,
      })
      .where(eq(user.id, existingMember.userId));

    return await tx
      .update(member)
      .set({
        role: body.role,
        updatedByUser: currentUser?.id,
      })
      .where(eq(member.id, id))
      .returning();
  });

  if (!updatedMember) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to update member",
      }),
      500
    );
  }

  return c.json(updatedMember);
});

registerOpenApiRoute(companyMembersGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingMember = await db
    .select()
    .from(member)
    .where(and(eq(member.id, id), eq(member.isDeleted, false)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existingMember) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  if (existingMember.role === "owner") {
    return c.json(
      createErrorResponse({
        error: "Forbidden",
        message: "Cannot delete owner member",
      }),
      403
    );
  }

  const [deletedMember] = await db
    .update(member)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: currentUser?.id,
    })
    .where(eq(member.id, id))
    .returning();

  if (!deletedMember) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: "Failed to delete member",
      }),
      500
    );
  }

  return c.json(deletedMember);
});

registerOpenApiRoute(companyMembersGroup, remove_with_user, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);

  const existingMember = await db
    .select()
    .from(member)
    .where(and(eq(member.id, id), eq(member.isDeleted, false)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existingMember) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Member not found",
      }),
      404
    );
  }

  if (existingMember.role === "owner") {
    return c.json(
      createErrorResponse({
        error: "Forbidden",
        message: "Cannot delete owner member",
      }),
      403
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(member)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedByUser: currentUser?.id,
      })
      .where(eq(member.id, id));

    await tx
      .update(user)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedByUser: currentUser?.id,
      })
      .where(eq(user.id, existingMember.userId));
  });

  return c.json(null);
});
