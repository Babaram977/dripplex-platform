-- Token behind the passenger's public "share my trip" link. Nullable because a
-- ride only gets one when its passenger actually shares it, and unique because
-- the token is the only credential the public tracking endpoint accepts.
ALTER TABLE "rides" ADD COLUMN "share_token" VARCHAR(64);

CREATE UNIQUE INDEX "rides_share_token_key" ON "rides"("share_token");
