import { emailSubject, metadata } from "../static/const";
import {
  renderPropertyPublishedToOrgOwnerEmail,
  renderPropertyPublishedToOwnerEmail,
} from "../templates";
import { sendEmailBatch, type SendEmailOptions } from "../transporter";
import type { NotificationDateTimeInput } from "../templates/notification/utils";

type NotificationRecipient = {
  email?: string | null;
  name?: string | null;
};

type NormalizedNotificationRecipient = {
  email: string;
  name: string;
};

export type SendPropertyPublishedNotificationEmailsOptions = {
  propertyId: string;
  propertyName: string;
  organizationName: string;
  publishedAt: NotificationDateTimeInput;
  propertyUrl?: string;
  propertyOwner?: NotificationRecipient | null;
  organizationOwners?: NotificationRecipient[];
};

function resolvePropertyUrl(propertyId: string, propertyUrl?: string) {
  if (propertyUrl) {
    return propertyUrl;
  }

  return `${metadata.consoleUrl.replace(/\/$/, "")}/data/directory/property/${encodeURIComponent(
    propertyId
  )}`;
}

function normalizeEmail(value?: string | null) {
  const email = value?.trim();
  return email || null;
}

function uniqueRecipients(recipients: NotificationRecipient[] = []) {
  const seen = new Set<string>();
  const unique: NormalizedNotificationRecipient[] = [];

  for (const recipient of recipients) {
    const email = normalizeEmail(recipient.email);

    if (!email || seen.has(email.toLowerCase())) {
      continue;
    }

    seen.add(email.toLowerCase());
    unique.push({
      email,
      name: recipient.name?.trim() || "Organization Owner",
    });
  }

  return unique;
}

export async function sendPropertyPublishedNotificationEmails({
  propertyId,
  propertyName,
  organizationName,
  publishedAt,
  propertyUrl,
  propertyOwner,
  organizationOwners = [],
}: SendPropertyPublishedNotificationEmailsOptions) {
  const resolvedPropertyUrl = resolvePropertyUrl(propertyId, propertyUrl);
  const emails: SendEmailOptions[] = [];
  const propertyOwnerEmail = normalizeEmail(propertyOwner?.email);

  if (propertyOwnerEmail) {
    emails.push({
      to: propertyOwnerEmail,
      subject: emailSubject["property-published-to-owner"].subject,
      html: await renderPropertyPublishedToOwnerEmail({
        ownerName: propertyOwner?.name || "Property Owner",
        propertyName,
        organizationName,
        propertyUrl: resolvedPropertyUrl,
        publishedAt,
        previewText: emailSubject["property-published-to-owner"].previewText,
      }),
    });
  }

  for (const organizationOwner of uniqueRecipients(organizationOwners)) {
    emails.push({
      to: organizationOwner.email,
      subject: emailSubject["property-published-to-org-owner"].subject,
      html: await renderPropertyPublishedToOrgOwnerEmail({
        orgOwnerName: organizationOwner.name,
        propertyOwnerName: propertyOwner?.name || "Property Owner",
        propertyName,
        organizationName,
        propertyUrl: resolvedPropertyUrl,
        publishedAt,
        previewText: emailSubject["property-published-to-org-owner"].previewText,
      }),
    });
  }

  if (emails.length === 0) {
    return [];
  }

  return sendEmailBatch(emails);
}
