export function formatDate(date: Date | string, timezone: string = "UTC", options: Intl.DateTimeFormatOptions = {}) {
  const d = typeof date === "string" ? new Date(date) : date;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
    ...options,
  };

  try {
    return new Intl.DateTimeFormat("en-US", defaultOptions).format(d);
  } catch (error) {
    console.error(`Error formatting date for timezone ${timezone}:`, error);
    // Fallback to UTC if the timezone is invalid
    return new Intl.DateTimeFormat("en-US", { ...defaultOptions, timeZone: "UTC" }).format(d);
  }
}

export const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  // Add more as needed or use a library
];
