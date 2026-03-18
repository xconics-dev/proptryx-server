import { Resend } from "resend";
import { env } from "../../config/env";

export type SendEmailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
};

let resendClient: Resend | null = null;

function getResendClient() {
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }

  return resendClient;
}

function normalizeToAddresses(to: string | string[]) {
  return Array.isArray(to) ? to : [to];
}

function resolveFromAddress(from?: string) {
  return from ?? env.RESEND_FROM;
}

export async function sendEmail(options: SendEmailOptions) {
  const response = await getResendClient().emails.send({
    from: resolveFromAddress(options.from),
    to: normalizeToAddresses(options.to),
    subject: options.subject,
    html: options.html,
  });

  if (response.error) {
    throw new Error(response.error.message || "Failed to send email via Resend");
  }

  return response.data;
}

export async function sendEmailBatch(emails: SendEmailOptions[]) {
  const response = await getResendClient().batch.send(
    emails.map((email) => ({
      from: resolveFromAddress(email.from),
      to: normalizeToAddresses(email.to),
      subject: email.subject,
      html: email.html,
    }))
  );

  if (response.error) {
    throw new Error(response.error.message || "Failed to send batch emails via Resend");
  }

  return response.data;
}
