-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BusinessSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "salonName" TEXT NOT NULL DEFAULT 'Barbería',
    "salonAddress" TEXT NOT NULL DEFAULT '',
    "salonPhone" TEXT NOT NULL DEFAULT '5491100000000',
    "weeklyHours" TEXT NOT NULL DEFAULT '{"1":["09:00","20:00"],"2":["09:00","20:00"],"3":["09:00","20:00"],"4":["09:00","20:00"],"5":["09:00","20:00"],"6":["09:00","20:00"]}',
    "slotDurationMin" INTEGER NOT NULL DEFAULT 30,
    "bookingWindowDays" INTEGER NOT NULL DEFAULT 30,
    "minNoticeMin" INTEGER NOT NULL DEFAULT 30
);
-- Se conserva el horario anterior: el mismo apertura/cierre para cada día que estaba abierto.
INSERT INTO "new_BusinessSetting" ("bookingWindowDays", "id", "minNoticeMin", "salonAddress", "salonName", "salonPhone", "slotDurationMin", "weeklyHours")
SELECT "bookingWindowDays", "id", "minNoticeMin", "salonAddress", "salonName", "salonPhone", "slotDurationMin",
  (SELECT json_group_object(CAST(d.value AS TEXT), json_array(b."openingTime", b."closingTime"))
     FROM json_each('[' || b."daysOpen" || ']') AS d)
FROM "BusinessSetting" AS b;
DROP TABLE "BusinessSetting";
ALTER TABLE "new_BusinessSetting" RENAME TO "BusinessSetting";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

