// Los tests usan una base SQLite aparte (prisma/test.db, ignorada por git), nunca prisma/dev.db.
export const TEST_DB_FILE = "prisma/test.db";
export const TEST_DATABASE_URL = `file:./${TEST_DB_FILE}`;
