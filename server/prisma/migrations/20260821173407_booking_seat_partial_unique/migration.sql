-- DropIndex
DROP INDEX "BookingSeat_showSeatId_key";

-- CreateIndex
CREATE INDEX "BookingSeat_showSeatId_idx" ON "BookingSeat"("showSeatId");

-- Partial unique index: a showSeat may have at most one *active* (non-released) booking seat.
-- Replaces the global unique constraint, which made a cancelled seat permanently unbookable.
CREATE UNIQUE INDEX "BookingSeat_showSeatId_active_key"
  ON "BookingSeat"("showSeatId")
  WHERE "releasedAt" IS NULL;
