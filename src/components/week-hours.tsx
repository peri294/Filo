"use client";

import { CopyCheck } from "lucide-react";
import { parseWeeklyHours, WEEK } from "@/lib/schedule";

export type DayRow = { open: boolean; from: string; to: string };
export type WeekRows = Record<number, DayRow>;

/** Filas editables a partir del JSON guardado (los días que no figuran, cerrados). */
export function weekRowsFrom(weeklyHours: string | null, fallback = { open: "09:00", close: "20:00" }): WeekRows {
  const hours = weeklyHours ? parseWeeklyHours(weeklyHours) : {};
  const first = Object.values(hours)[0] ?? fallback;
  return Object.fromEntries(
    WEEK.map((d) => {
      const h = hours[d.value];
      return [d.value, { open: !!h, from: h?.open ?? first.open, to: h?.close ?? first.close }];
    }),
  );
}

/** Lo que espera la API: solo los días abiertos, cada uno con su horario. */
export function weekRowsPayload(rows: WeekRows) {
  return WEEK.filter((d) => rows[d.value].open).map((d) => ({
    weekday: d.value,
    open: rows[d.value].from,
    close: rows[d.value].to,
  }));
}

/** Una fila por día: abierto o cerrado, apertura y cierre, y copiar el horario a los demás días. */
export function WeekHoursFields({
  value,
  onChange,
  unit,
  legend,
  idPrefix,
}: {
  value: WeekRows;
  onChange: (rows: WeekRows) => void;
  unit: number;
  legend: string;
  idPrefix: string;
}) {
  const update = (day: number, patch: Partial<DayRow>) => onChange({ ...value, [day]: { ...value[day], ...patch } });
  const copyToOpenDays = (day: number) => {
    const { from, to } = value[day];
    onChange(
      Object.fromEntries(Object.entries(value).map(([k, d]) => [k, d.open ? { ...d, from, to } : d])) as WeekRows,
    );
  };

  return (
    <fieldset className="space-y-2">
      <legend className="label">{legend}</legend>
      {WEEK.map((d) => {
        const day = value[d.value];
        return (
          <div
            key={d.value}
            className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2 ${day.open ? "border-brass/60" : "border-line"}`}
          >
            <label className="flex w-28 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-brass)]"
                checked={day.open}
                onChange={(e) => update(d.value, { open: e.target.checked })}
              />
              <span className={day.open ? "text-ink" : "text-muted"}>{d.label}</span>
            </label>
            {day.open ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  id={`${idPrefix}-${d.value}-from`}
                  type="time"
                  className="input min-w-0 flex-1 px-3 py-2"
                  step={unit * 60}
                  value={day.from}
                  onChange={(e) => update(d.value, { from: e.target.value })}
                  aria-label={`${d.label}: desde`}
                  required
                />
                <span className="text-sm text-muted">a</span>
                <input
                  id={`${idPrefix}-${d.value}-to`}
                  type="time"
                  className="input min-w-0 flex-1 px-3 py-2"
                  step={unit * 60}
                  value={day.to}
                  onChange={(e) => update(d.value, { to: e.target.value })}
                  aria-label={`${d.label}: hasta`}
                  required
                />
                <button
                  type="button"
                  className="btn-ghost shrink-0 px-2.5 py-2"
                  onClick={() => copyToOpenDays(d.value)}
                  title="Copiar este horario a los demás días marcados"
                  aria-label={`Copiar el horario del ${d.label.toLowerCase()} a los demás días marcados`}
                >
                  <CopyCheck className="size-4" aria-hidden />
                </button>
              </div>
            ) : (
              <span className="text-sm text-muted">No</span>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
