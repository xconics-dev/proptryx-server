import { env } from "@/config/env";
import { db, meeting } from "@proptryx/database";
import { eq } from "drizzle-orm";
import { findMeetingByIdWithRelations, type MeetingRecord } from "./utils";

type GoogleAuthTokenResponse = {
  accessToken?: string;
  access_token?: string;
  token?: string;
  data?: {
    accessToken?: string;
    access_token?: string;
    token?: string;
  };
  error?: string;
  message?: string;
};

type GoogleCalendarEvent = {
  id?: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  location?: string;
  status?: string;
  start?: {
    date?: string;
    dateTime?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
  };
};

type GoogleMeetSpace = {
  name?: string;
  meetingUri?: string;
};

type MeetingWithRelations = NonNullable<Awaited<ReturnType<typeof findMeetingByIdWithRelations>>>;

type RequestHeadersInput = Pick<Headers, "get">;

export class GoogleWorkspaceError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = "GoogleWorkspaceError";
  }
}

function resolveAccessToken(payload: GoogleAuthTokenResponse) {
  return (
    payload.accessToken ??
    payload.access_token ??
    payload.token ??
    payload.data?.accessToken ??
    payload.data?.access_token ??
    payload.data?.token ??
    null
  );
}

function getForwardedAuthHeaders(headers?: RequestHeadersInput) {
  const forwarded = new Headers({
    "content-type": "application/json",
  });

  const cookie = headers?.get("cookie");
  const authorization = headers?.get("authorization");

  if (cookie) {
    forwarded.set("cookie", cookie);
  }

  if (authorization) {
    forwarded.set("authorization", authorization);
  }

  return forwarded;
}

export async function getGoogleAccessTokenForUser(input: {
  userId: string;
  headers?: RequestHeadersInput;
}) {
  const authServiceUrl = env.AUTH_SERVICE_URL.replace(/\/+$/, "");
  const response = await fetch(`${authServiceUrl}/api/auth/get-access-token`, {
    method: "POST",
    headers: getForwardedAuthHeaders(input.headers),
    body: JSON.stringify({
      providerId: "google",
      userId: input.userId,
    }),
  });

  let payload: GoogleAuthTokenResponse | null = null;

  try {
    payload = (await response.json()) as GoogleAuthTokenResponse;
  } catch {
    payload = null;
  }

  const accessToken = payload ? resolveAccessToken(payload) : null;

  if (!response.ok || !accessToken) {
    throw new GoogleWorkspaceError(
      payload?.message ??
        payload?.error ??
        "Google account is not connected or the required Calendar/Meet permissions were not granted.",
      response.status === 401 ? 401 : 400
    );
  }

  return accessToken;
}

async function googleJson<T>(url: string, init: RequestInit & { accessToken: string }): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${init.accessToken}`,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = "Google Workspace request failed.";

    try {
      const payload = (await response.json()) as {
        error?: { message?: string };
        message?: string;
      };
      message = payload.error?.message ?? payload.message ?? message;
    } catch {
      message = await response.text().catch(() => message);
    }

    throw new GoogleWorkspaceError(message, response.status);
  }

  return response.json() as Promise<T>;
}

export async function listGoogleCalendarEvents(input: {
  userId: string;
  headers?: RequestHeadersInput;
  timeMin: Date;
  timeMax: Date;
  query?: string;
  maxResults?: number;
}) {
  const accessToken = await getGoogleAccessTokenForUser({
    userId: input.userId,
    headers: input.headers,
  });
  const params = new URLSearchParams({
    timeMin: input.timeMin.toISOString(),
    timeMax: input.timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(input.maxResults ?? 50),
  });

  if (input.query) {
    params.set("q", input.query);
  }

  const payload = await googleJson<{
    items?: GoogleCalendarEvent[];
    nextPageToken?: string;
  }>(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
    method: "GET",
    accessToken,
  });

  return {
    items: (payload.items ?? []).map((item) => ({
      id: item.id ?? "",
      summary: item.summary ?? null,
      description: item.description ?? null,
      htmlLink: item.htmlLink ?? null,
      location: item.location ?? null,
      status: item.status ?? null,
      start: item.start?.dateTime ?? item.start?.date ?? null,
      end: item.end?.dateTime ?? item.end?.date ?? null,
    })),
    nextPageToken: payload.nextPageToken ?? null,
  };
}

function collectAttendees(meetingData: MeetingWithRelations) {
  return [
    meetingData.developer?.email,
    meetingData.occupier?.email,
    meetingData.requestedByUser?.email,
  ]
    .filter((email): email is string => Boolean(email))
    .filter((email, index, emails) => emails.indexOf(email) === index)
    .map((email) => ({ email }));
}

function buildMeetingDescription(input: {
  meetingData: MeetingWithRelations;
  meetUri: string | null;
  description?: string;
}) {
  const lines = [
    input.description,
    input.meetingData.agenda ? `Agenda: ${input.meetingData.agenda}` : null,
    input.meetingData.requestNote ? `Request note: ${input.meetingData.requestNote}` : null,
    input.meetingData.property ? `Property: ${input.meetingData.property.name}` : null,
    input.meetUri ? `Google Meet: ${input.meetUri}` : null,
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n\n");
}

function buildMeetingSummary(meetingData: MeetingWithRelations, summary?: string) {
  if (summary) {
    return summary;
  }

  return meetingData.property?.name
    ? `Proptryx Meeting - ${meetingData.property.name}`
    : "Proptryx Meeting";
}

async function createGoogleMeetSpace(accessToken: string) {
  return googleJson<GoogleMeetSpace>("https://meet.googleapis.com/v2/spaces", {
    method: "POST",
    accessToken,
    body: JSON.stringify({}),
  });
}

async function upsertGoogleCalendarEvent(input: {
  accessToken: string;
  meetingData: MeetingWithRelations;
  meetUri: string | null;
  durationMinutes: number;
  summary?: string;
  description?: string;
}) {
  if (!input.meetingData.scheduledAt) {
    throw new GoogleWorkspaceError("Meeting must be scheduled before Google sync.");
  }

  const start = input.meetingData.scheduledAt;
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);
  const body = {
    summary: buildMeetingSummary(input.meetingData, input.summary),
    description: buildMeetingDescription({
      meetingData: input.meetingData,
      meetUri: input.meetUri,
      description: input.description,
    }),
    location: input.meetUri ?? input.meetingData.location ?? undefined,
    start: {
      dateTime: start.toISOString(),
    },
    end: {
      dateTime: end.toISOString(),
    },
    attendees: collectAttendees(input.meetingData),
  };

  const existingEventId = input.meetingData.googleCalendarEventId;
  const eventUrl = existingEventId
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existingEventId)}?sendUpdates=all`
    : "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all";

  return googleJson<GoogleCalendarEvent>(eventUrl, {
    method: existingEventId ? "PATCH" : "POST",
    accessToken: input.accessToken,
    body: JSON.stringify(body),
  });
}

export async function syncMeetingWithGoogle(input: {
  meetingData: MeetingRecord | MeetingWithRelations;
  userId: string;
  headers?: RequestHeadersInput;
  durationMinutes?: number;
  summary?: string;
  description?: string;
  force?: boolean;
}) {
  const meetingData =
    "property" in input.meetingData
      ? input.meetingData
      : await findMeetingByIdWithRelations(input.meetingData.id);

  if (!meetingData) {
    throw new GoogleWorkspaceError("Meeting not found.", 404);
  }

  if (!meetingData.scheduledAt) {
    throw new GoogleWorkspaceError("Meeting must be scheduled before Google sync.");
  }

  const accessToken = await getGoogleAccessTokenForUser({
    userId: input.userId,
    headers: input.headers,
  });
  const meetSpace =
    meetingData.googleMeetUri && !input.force
      ? {
          name: meetingData.googleMeetSpaceName ?? undefined,
          meetingUri: meetingData.googleMeetUri,
        }
      : await createGoogleMeetSpace(accessToken);
  const event = await upsertGoogleCalendarEvent({
    accessToken,
    meetingData,
    meetUri: meetSpace.meetingUri ?? meetingData.googleMeetUri ?? null,
    durationMinutes: input.durationMinutes ?? 60,
    summary: input.summary,
    description: input.description,
  });

  await db
    .update(meeting)
    .set({
      googleCalendarEventId: event.id ?? meetingData.googleCalendarEventId,
      googleCalendarEventLink: event.htmlLink ?? meetingData.googleCalendarEventLink,
      googleMeetSpaceName: meetSpace.name ?? meetingData.googleMeetSpaceName,
      googleMeetUri: meetSpace.meetingUri ?? meetingData.googleMeetUri,
      googleSyncedAt: new Date(),
      location: meetSpace.meetingUri ?? meetingData.location,
    })
    .where(eq(meeting.id, meetingData.id));

  const updatedMeeting = await findMeetingByIdWithRelations(meetingData.id);
  return updatedMeeting ?? meetingData;
}
