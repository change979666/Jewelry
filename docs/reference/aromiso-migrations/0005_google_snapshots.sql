-- V4: GSC / GA4 daily snapshot cache tables
-- Cron pulls T-2 data daily; dashboard reads snapshots (no real-time Google calls).

CREATE TABLE IF NOT EXISTS gsc_daily (
  date        TEXT NOT NULL,         -- YYYY-MM-DD
  dimension   TEXT NOT NULL,         -- query / page / country
  key         TEXT NOT NULL,         -- specific keyword / page URL / country code
  clicks      INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr         REAL DEFAULT 0,
  position    REAL DEFAULT 0,
  PRIMARY KEY (date, dimension, key)
);

CREATE TABLE IF NOT EXISTS ga_daily (
  date        TEXT NOT NULL,         -- YYYY-MM-DD
  dimension   TEXT NOT NULL,         -- country / device / source / page
  key         TEXT NOT NULL,
  users       INTEGER DEFAULT 0,
  sessions    INTEGER DEFAULT 0,
  bounce_rate REAL DEFAULT 0,
  avg_time    REAL DEFAULT 0,
  PRIMARY KEY (date, dimension, key)
);
