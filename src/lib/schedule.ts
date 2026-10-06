import { minutesOf, weekdayOf } from "@/lib/time";

/** Horario de un día. Un día que no figura en WeeklyHours está cerrado. */
export type DayHours = { open: string; close: string };
/** Clave: día de la semana (0 = domingo ... 6 = sábado). */
export type WeeklyHours = Partial<Record<number, DayHours>>;

/** Lunes primero, como se muestra en pantalla. */
export const WEEK = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Lee el JSON guardado en BusinessSetting.weeklyHours ({"1": ["09:00", "20:00"], ...}). */
export function parseWeeklyHours(raw: string): WeeklyHours {
  const out: WeeklyHours = {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return out;
  }
  if (!data || typeof data !== "object") return out;
  for (const [day, range] of Object.entries(data as Record<string, unknown>)) {
    const weekday = Number(day);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !Array.isArray(range)) continue;
    const [open, close] = range;
    if (typeof open === "string" && typeof close === "string" && TIME.test(open) && TIME.test(close)) {
      if (minutesOf(close) > minutesOf(open)) out[weekday] = { open, close };
    }
  }
  return out;
}

export function serializeWeeklyHours(hours: WeeklyHours) {
  const out: Record<string, [string, string]> = {};
  for (let d = 0; d <= 6; d++) {
    const h = hours[d];
    if (h) out[d] = [h.open, h.close];
  }
  return JSON.stringify(out);
}

/** Horario de una fecha "YYYY-MM-DD", o null si ese día está cerrado. */
export function hoursFor(weeklyHours: string, dateKey: string): DayHours | null {
  return parseWeeklyHours(weeklyHours)[weekdayOf(dateKey)] ?? null;
}

/** "Lunes a Viernes 09:00 a 20:00 · Sábado 10:00 a 14:00" (agrupa días seguidos con el mismo horario). */
export function describeWeek(weeklyHours: string) {
  const hours = parseWeeklyHours(weeklyHours);
  const groups: { from: string; to: string; range: string }[] = [];
  let previousOpen = false;
  for (const day of WEEK) {
    const h = hours[day.value];
    if (!h) {
      previousOpen = false;
      continue;
    }
    const range = `${h.open} a ${h.close}`;
    const last = groups.at(-1);
    if (previousOpen && last?.range === range) last.to = day.label;
    else groups.push({ from: day.label, to: day.label, range });
    previousOpen = true;
  }
  return groups.map((g) => {
    const days = g.from === g.to ? g.from : `${g.from} a ${g.to}`;
    return `${days} ${g.range}`;
  });
}
