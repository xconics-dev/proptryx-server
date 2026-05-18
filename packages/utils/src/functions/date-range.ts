type DateBoundary = "start" | "end";

function parseDateParts(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const [year, month, day] = value.split("T")[0].split("-").map(Number);

  if (!(year && month && day)) {
    return null;
  }

  return { day, month, year };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone,
      year: "numeric",
    }).formatToParts(date);

    const values = new Map(parts.map((part) => [part.type, part.value]));
    const asUtc = Date.UTC(
      Number(values.get("year")),
      Number(values.get("month")) - 1,
      Number(values.get("day")),
      Number(values.get("hour")),
      Number(values.get("minute")),
      Number(values.get("second"))
    );

    return asUtc - date.getTime();
  } catch {
    return 0;
  }
}

function zonedDateTimeToUtc({
  day,
  hour,
  millisecond,
  minute,
  month,
  second,
  timeZone,
  year,
}: {
  day: number;
  hour: number;
  millisecond: number;
  minute: number;
  month: number;
  second: number;
  timeZone: string;
  year: number;
}) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const firstPass = utcGuess - getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  const secondPass = utcGuess - getTimeZoneOffsetMs(new Date(firstPass), timeZone);

  return new Date(secondPass);
}

export function resolveDateRangeBoundary({
  boundary,
  timeZone = "UTC",
  value,
}: {
  boundary: DateBoundary;
  timeZone?: string | null;
  value: unknown;
}) {
  const parts = parseDateParts(value);

  if (!parts) {
    return null;
  }

  const normalizedTimeZone =
    typeof timeZone === "string" && timeZone.trim().length > 0 ? timeZone.trim() : "UTC";

  return zonedDateTimeToUtc({
    ...parts,
    hour: boundary === "start" ? 0 : 23,
    millisecond: boundary === "start" ? 0 : 999,
    minute: boundary === "start" ? 0 : 59,
    second: boundary === "start" ? 0 : 59,
    timeZone: normalizedTimeZone,
  });
}
