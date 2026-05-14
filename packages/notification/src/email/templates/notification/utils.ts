export type NotificationDateTimeInput = Date | string;

export function formatNotificationDateTime(value: NotificationDateTimeInput) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const formattedDateTime = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    hour12: true,
    minute: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
    year: "numeric",
  }).format(date);

  return `${formattedDateTime} IST`;
}
