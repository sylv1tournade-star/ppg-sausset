const PARIS_TZ = "Europe/Paris";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatParisMonthYear(dateIso: string) {
  const date = new Date(`${dateIso}T12:00:00`);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatMonthYear(year: number, month: number) {
  const date = new Date(year, month, 1);
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const cells: Array<{ date: string | null; day: number | null }> = [];
  for (let i = 0; i < startOffset; i += 1) {
    cells.push({ date: null, day: null });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${pad(month + 1)}-${pad(day)}`;
    cells.push({ date, day });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null });
  }
  return cells;
}

export function toMonthKey(year: number, month: number) {
  return `${year}-${pad(month + 1)}`;
}

export function parseMonthKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  return { year, month: month - 1 };
}

export function shiftMonthKey(key: string, delta: number) {
  const { year, month } = parseMonthKey(key);
  const date = new Date(year, month + delta, 1);
  return toMonthKey(date.getFullYear(), date.getMonth());
}

const WEEKDAY_LABELS = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

export function getWeekdayLabels() {
  return WEEKDAY_LABELS;
}

export function formatParisDate(dateIso: string) {
  const date = new Date(`${dateIso}T12:00:00`);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatParisShortDate(dateIso: string) {
  const date = new Date(`${dateIso}T12:00:00`);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

function parseTimeParts(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return { hours, minutes };
}

function parisWallClockParts(dateIso: string, time: string) {
  const { hours, minutes } = parseTimeParts(time);
  const utcGuess = new Date(`${dateIso}T${pad(hours)}:${pad(minutes)}:00Z`);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(utcGuess);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const parisHour = read("hour") % 24;
  const parisMinute = read("minute");
  const deltaMinutes = (parisHour - hours) * 60 + (parisMinute - minutes);
  const corrected = new Date(utcGuess.getTime() - deltaMinutes * 60_000);

  const finalParts = formatter.formatToParts(corrected);
  const finalRead = (type: Intl.DateTimeFormatPartTypes) =>
    finalParts.find((part) => part.type === type)?.value ?? "00";

  return {
    year: finalRead("year"),
    month: finalRead("month"),
    day: finalRead("day"),
    hour: finalRead("hour"),
    minute: finalRead("minute"),
  };
}

function toIcsStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildGoogleCalendarUrl(input: {
  dateIso: string;
  startTime: string;
  endTime: string;
  title: string;
  details?: string;
  location?: string;
}) {
  const start = parisWallClockParts(input.dateIso, input.startTime);
  const end = parisWallClockParts(input.dateIso, input.endTime);
  const dates = `${start.year}${start.month}${start.day}T${start.hour}${start.minute}00/${end.year}${end.month}${end.day}T${end.hour}${end.minute}00`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates,
    ctz: PARIS_TZ,
  });

  if (input.details) {
    params.set("details", input.details);
  }
  if (input.location) {
    params.set("location", input.location);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcsFile(input: {
  dateIso: string;
  startTime: string;
  endTime: string;
  title: string;
  details?: string;
  location?: string;
  uid: string;
}) {
  const start = parisWallClockParts(input.dateIso, input.startTime);
  const end = parisWallClockParts(input.dateIso, input.endTime);
  const dtStart = `${start.year}${start.month}${start.day}T${start.hour}${start.minute}00`;
  const dtEnd = `${end.year}${end.month}${end.day}T${end.hour}${end.minute}00`;
  const now = toIcsStamp(new Date());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PPG Courir a Sausset//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Paris",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0200",
    "TZNAME:CEST",
    "DTSTART:19700329T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "TZNAME:CET",
    "DTSTART:19701025T030000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=Europe/Paris:${dtStart}`,
    `DTEND;TZID=Europe/Paris:${dtEnd}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
  ];

  if (input.details) {
    lines.push(`DESCRIPTION:${escapeIcsText(input.details)}`);
  }
  if (input.location) {
    lines.push(`LOCATION:${escapeIcsText(input.location)}`);
  }

  lines.push(
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Rappel PPG (2h avant)",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  );

  return `${lines.join("\r\n")}\r\n`;
}

function escapeIcsText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function getThursdayDatesForSeason(startYear: number, dayOfWeek = 4) {
  const dates: string[] = [];
  const cursor = new Date(startYear, 8, 1);

  while (cursor.getDay() !== dayOfWeek) {
    cursor.setDate(cursor.getDate() + 1);
  }

  const end = new Date(startYear + 1, 5, 30);

  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = pad(cursor.getMonth() + 1);
    const day = pad(cursor.getDate());
    dates.push(`${year}-${month}-${day}`);
    cursor.setDate(cursor.getDate() + 7);
  }

  return dates;
}

export function seasonLabelFromStartYear(startYear: number) {
  return `${startYear}-${startYear + 1}`;
}

export function isSessionPast(dateIso: string, endTime: string) {
  const end = parisWallClockParts(dateIso, endTime);
  const endLocal = new Date(
    `${end.year}-${end.month}-${end.day}T${end.hour}:${end.minute}:00`,
  );
  const parisNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: PARIS_TZ }),
  );
  return endLocal < parisNow;
}

export function isSessionRegisterable(
  session: { sessionDate: string; status: string },
  season: { endTime: string },
) {
  if (session.status === "cancelled" || session.status === "rescheduled") {
    return false;
  }
  return !isSessionPast(session.sessionDate, season.endTime);
}

export function findNextOpenSession<T extends { sessionDate: string; status: string }>(
  sessions: T[],
  season: { endTime: string },
) {
  return (
    [...sessions]
      .filter((session) => isSessionRegisterable(session, season))
      .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))[0] ?? null
  );
}

export function formatTimeLabel(time: string) {
  return time.slice(0, 5).replace(":", "h");
}

const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

export function formatDayOfWeekLong(dayOfWeek: number) {
  return DAY_NAMES[dayOfWeek] ?? "jour";
}

export function formatDayOfWeekLongCapitalized(dayOfWeek: number) {
  const label = formatDayOfWeekLong(dayOfWeek);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatDayOfWeekWithArticle(dayOfWeek: number) {
  return `du ${formatDayOfWeekLong(dayOfWeek)}`;
}

export function formatSeasonScheduleTagline(season: {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string;
}) {
  const day = formatDayOfWeekLongCapitalized(season.dayOfWeek);
  const time = `${formatTimeLabel(season.startTime)}-${formatTimeLabel(season.endTime)}`;
  const location = season.location.trim();
  return location ? `${day} ${time} - ${location}` : `${day} ${time}`;
}

export function formatSeasonScheduleShort(season: {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string;
}) {
  return `${formatDayOfWeekLongCapitalized(season.dayOfWeek)} ${formatTimeLabel(season.startTime)}-${formatTimeLabel(season.endTime)} - ${season.location.trim()}`;
}

export function pickAgendaMonthKey(sessionDates: string[]) {
  if (sessionDates.length === 0) {
    const now = new Date();
    return toMonthKey(now.getFullYear(), now.getMonth());
  }

  const sorted = [...sessionDates].sort();
  const min = sorted[0].slice(0, 7);
  const max = sorted[sorted.length - 1].slice(0, 7);
  const now = new Date();
  const current = toMonthKey(now.getFullYear(), now.getMonth());

  if (current >= min && current <= max) {
    return current;
  }

  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const upcoming = sorted.find((date) => date >= today);
  return upcoming ? upcoming.slice(0, 7) : max;
}

export function pickDefaultSessionIdInMonth(
  sessions: Array<{ id: string; sessionDate: string; status: string }>,
  monthKey: string,
) {
  const inMonth = sessions.filter((session) => session.sessionDate.startsWith(monthKey));
  if (inMonth.length === 0) {
    return null;
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcomingScheduled = inMonth.find(
    (session) => session.sessionDate >= today && session.status === "scheduled",
  );
  if (upcomingScheduled) {
    return upcomingScheduled.id;
  }

  const upcomingAny = inMonth.find((session) => session.sessionDate >= today);
  if (upcomingAny) {
    return upcomingAny.id;
  }

  return inMonth[inMonth.length - 1].id;
}
