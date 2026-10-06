import { TZDate, tz } from "@date-fns/tz";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";

// Toda la agenda se maneja en hora de Argentina, sin importar dónde corra el servidor.
export const TZ = "America/Argentina/Buenos_Aires";

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_KEY = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "YYYY-MM-DD" de una fecha que existe (rechaza, por ejemplo, 2026-02-31). */
export function isDateKey(value: string) {
  const match = DATE_KEY.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isTimeKey(value: string) {
  return TIME_KEY.test(value);
}

/** Instante real (UTC) de una fecha "YYYY-MM-DD" y hora "HH:mm" en Argentina. */
export function zonedInstant(dateKey: string, time: string): Date {
  const [, y, m, d] = DATE_KEY.exec(dateKey)!.map(Number);
  const [, h, min] = TIME_KEY.exec(time)!.map(Number);
  return new Date(new TZDate(y, m - 1, d, h, min, TZ).getTime());
}

export function dateKeyOf(date: Date) {
  return format(date, "yyyy-MM-dd", { in: tz(TZ) });
}

export function todayKey() {
  return dateKeyOf(new Date());
}

export function addDaysToKey(dateKey: string, days: number) {
  return dateKeyOf(addDays(zonedInstant(dateKey, "12:00"), days));
}

/** 0 = domingo ... 6 = sábado */
export function weekdayOf(dateKey: string) {
  return new TZDate(zonedInstant(dateKey, "12:00").getTime(), TZ).getDay();
}

export function formatTime(date: Date) {
  return format(date, "HH:mm", { in: tz(TZ) });
}

/** "martes 7 de octubre" */
export function formatLongDate(date: Date) {
  return format(date, "EEEE d 'de' MMMM", { in: tz(TZ), locale: es });
}

/** "mar 7" */
export function formatShortDay(dateKey: string) {
  return format(zonedInstant(dateKey, "12:00"), "EEE d", { in: tz(TZ), locale: es });
}

export function minutesOf(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
