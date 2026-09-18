-- The DRIVER referral programme row.
--
-- SEEDED INACTIVE, AND THE AMOUNTS ARE NOT A DECISION MADE HERE.
--
-- The founder's instruction was to add drivers to the page and "do not always
-- specify commission, give it an option to work with adjustable values". So
-- this migration does not price a driver referral. It creates the row that lets
-- Operations price it, with `active = false` so that nothing qualifies and
-- nothing pays until a person has set both amounts and switched it on from the
-- console — where every field on this table is already editable.
--
-- The column defaults (350/350) are what the table gives an unspecified row.
-- They are placeholders sitting behind an off switch, not a rate: a driver
-- referral cannot qualify while `active` is false, so no reward is ever priced
-- at them. Writing them explicitly would dress a default up as a ruling.
--
-- hold_days and qualification_window_days take the table's founder-locked
-- defaults (7 and 90), the same as every other programme.
--
-- INSERT ... WHERE NOT EXISTS rather than ON CONFLICT DO NOTHING: if a DRIVER
-- programme somehow already exists, somebody created it deliberately and this
-- migration must not touch its amounts or its switch. Re-running is a no-op
-- either way; this states which of the two it is.
INSERT INTO "referral_programmes" ("id", "referee_type", "active", "created_at", "updated_at")
SELECT gen_random_uuid(), 'DRIVER', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "referral_programmes" WHERE "referee_type" = 'DRIVER'
);
