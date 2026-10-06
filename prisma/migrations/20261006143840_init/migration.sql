-- CreateTable
CREATE TABLE "BusinessSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "salonName" TEXT NOT NULL DEFAULT 'Barbería',
    "salonAddress" TEXT NOT NULL DEFAULT '',
    "salonPhone" TEXT NOT NULL DEFAULT '5491100000000',
    "openingTime" TEXT NOT NULL DEFAULT '09:00',
    "closingTime" TEXT NOT NULL DEFAULT '20:00',
    "slotDurationMin" INTEGER NOT NULL DEFAULT 30,
    "daysOpen" TEXT NOT NULL DEFAULT '1,2,3,4,5,6',
    "bookingWindowDays" INTEGER NOT NULL DEFAULT 30,
    "minNoticeMin" INTEGER NOT NULL DEFAULT 30
);

-- CreateTable
CREATE TABLE "Service" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "clientIp" TEXT NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "clientNotifiedAt" DATETIME,
    "confirmedAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "pricePaid" INTEGER,
    "mpPreferenceId" TEXT,
    "mpPaymentId" TEXT,
    "refundStatus" TEXT,
    "refundAmount" INTEGER,
    "refundId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BlockedSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SlotLock" (
    "startsAt" DATETIME NOT NULL PRIMARY KEY,
    "appointmentId" TEXT,
    "blockedSlotId" TEXT,
    CONSTRAINT "SlotLock_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SlotLock_blockedSlotId_fkey" FOREIGN KEY ("blockedSlotId") REFERENCES "BlockedSlot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_code_key" ON "Appointment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_accessToken_key" ON "Appointment"("accessToken");

-- CreateIndex
CREATE INDEX "Appointment_startsAt_idx" ON "Appointment"("startsAt");

-- CreateIndex
CREATE INDEX "Appointment_clientPhone_status_idx" ON "Appointment"("clientPhone", "status");

-- CreateIndex
CREATE INDEX "Appointment_clientIp_createdAt_idx" ON "Appointment"("clientIp", "createdAt");

-- CreateIndex
CREATE INDEX "Appointment_status_expiresAt_idx" ON "Appointment"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "SlotLock_appointmentId_idx" ON "SlotLock"("appointmentId");

-- CreateIndex
CREATE INDEX "SlotLock_blockedSlotId_idx" ON "SlotLock"("blockedSlotId");
