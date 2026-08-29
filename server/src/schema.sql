-- Florida Roleplay — PostgreSQL schema.
--
-- Run with `npm run db:init`, which executes this file as one statement batch.
-- Every statement is IF NOT EXISTS, so running it against a live database is a
-- no-op rather than a migration — see server/src/scripts/initDb.js.
--
-- There is no CREATE DATABASE here. Railway, Northflank and every other managed
-- Postgres hand you a database that already exists and a role that cannot make
-- another one; the connection string names it.

-- Bumps updated_at on every UPDATE. MySQL had ON UPDATE CURRENT_TIMESTAMP as a
-- column attribute; Postgres does not, so it is one shared trigger function
-- attached to each table that carries the column.
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Discord-authenticated members. id is the Discord snowflake.
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(20)  NOT NULL,
  username      VARCHAR(64)  NOT NULL,
  display_name  VARCHAR(128) NULL,
  avatar        TEXT         NULL,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Roles are rows rather than a column so a user can hold several at once.
CREATE TABLE IF NOT EXISTS user_roles (
  user_id     VARCHAR(20) NOT NULL,
  role        VARCHAR(32) NOT NULL,
  granted_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Browser sessions minted by the Discord OAuth callback. The cookie carries only
-- this random id; everything about the user is read back through the join, so a
-- stolen cookie can be revoked by deleting the row and a role change takes effect
-- on the next request rather than living frozen inside a token.
CREATE TABLE IF NOT EXISTS sessions (
  id           VARCHAR(64)  NOT NULL,
  user_id      VARCHAR(20)  NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at   TIMESTAMPTZ  NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS departments (
  id                VARCHAR(64)  NOT NULL,
  name              VARCHAR(128) NOT NULL,
  abbr              VARCHAR(16)  NOT NULL,
  tone              VARCHAR(16)  NOT NULL DEFAULT 'brand',
  icon              VARCHAR(32)  NOT NULL DEFAULT 'Shield',
  tagline           TEXT         NULL,
  mission           TEXT         NULL,
  roster            INT          NOT NULL DEFAULT 0,
  hiring            BOOLEAN      NOT NULL DEFAULT TRUE,
  ranks             JSONB         NULL,
  fleet             JSONB         NULL,
  application_type  VARCHAR(64)  NULL,
  sort_order        INT          NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS staff (
  id          VARCHAR(64)  NOT NULL,
  name        VARCHAR(128) NOT NULL,
  handle      VARCHAR(64)  NOT NULL,
  role        VARCHAR(64)  NOT NULL,
  team        VARCHAR(64)  NOT NULL,
  department  VARCHAR(64)  NULL,
  tone        VARCHAR(16)  NOT NULL DEFAULT 'primary',
  online      BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS rules (
  id                    VARCHAR(64)  NOT NULL,
  category_id           VARCHAR(64)  NOT NULL,
  category              VARCHAR(128) NOT NULL,
  category_description  TEXT         NULL,
  number                VARCHAR(16)  NOT NULL,
  title                 VARCHAR(255) NOT NULL,
  body                  TEXT         NOT NULL,
  sort_order            INT          NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS patch_notes (
  id           VARCHAR(64)  NOT NULL,
  version      VARCHAR(32)  NOT NULL,
  title        VARCHAR(255) NOT NULL,
  tag          VARCHAR(32)  NOT NULL DEFAULT 'Feature',
  tone         VARCHAR(16)  NOT NULL DEFAULT 'primary',
  released_at  DATE         NOT NULL,
  changes      JSONB         NOT NULL,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS applications (
  id              INT GENERATED BY DEFAULT AS IDENTITY,
  reference       VARCHAR(32)  NOT NULL,
  type            VARCHAR(64)  NOT NULL,
  discord_id      VARCHAR(20)  NOT NULL,
  discord_name    VARCHAR(64)  NOT NULL,
  age_range       VARCHAR(32)  NULL,
  experience      VARCHAR(32)  NULL,
  character_name  VARCHAR(128) NOT NULL,
  backstory       TEXT         NOT NULL,
  scenario        TEXT         NOT NULL,
  status          VARCHAR(32)  NOT NULL DEFAULT 'Pending Review',
  reviewer_id     VARCHAR(20)  NULL,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS reports (
  id           INT GENERATED BY DEFAULT AS IDENTITY,
  reference    VARCHAR(32) NOT NULL,
  type         VARCHAR(32) NOT NULL,
  discord_id   VARCHAR(20) NOT NULL,
  involved     TEXT        NOT NULL,
  occurred_at  VARCHAR(128) NULL,
  evidence     TEXT        NULL,
  description  TEXT        NOT NULL,
  status       VARCHAR(32) NOT NULL DEFAULT 'Pending Review',
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS events (
  id           VARCHAR(64)  NOT NULL,
  title        VARCHAR(255) NOT NULL,
  event_date   DATE         NOT NULL,
  event_time   VARCHAR(32)  NULL,
  location     VARCHAR(128) NULL,
  status       VARCHAR(32)  NOT NULL DEFAULT 'Upcoming',
  attendance   INT          NOT NULL DEFAULT 0,
  description  TEXT         NULL,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS articles (
  slug          VARCHAR(64)  NOT NULL,
  title         VARCHAR(255) NOT NULL,
  category      VARCHAR(64)  NOT NULL,
  summary       TEXT         NULL,
  reading_time  VARCHAR(16)  NULL,
  body          JSONB         NOT NULL,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (slug)
);

CREATE TABLE IF NOT EXISTS supporters (
  id          VARCHAR(64)  NOT NULL,
  name        VARCHAR(128) NOT NULL,
  tier        VARCHAR(32)  NOT NULL,
  since       DATE         NULL,
  discord_id  VARCHAR(20)  NULL,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS store_tiers (
  id          VARCHAR(64)  NOT NULL,
  name        VARCHAR(64)  NOT NULL,
  price       VARCHAR(16)  NOT NULL,
  period      VARCHAR(16)  NOT NULL DEFAULT '/month',
  tone        VARCHAR(16)  NOT NULL DEFAULT 'primary',
  popular     BOOLEAN      NOT NULL DEFAULT FALSE,
  blurb       TEXT         NULL,
  features    JSONB         NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- Staff Hub
-- ---------------------------------------------------------------------------

-- Portal content, one row per editable section (featured, reminders,
-- quickNotes, links). JSONB keeps the shapes flexible without a migration each
-- time the Director panel gains a field.
CREATE TABLE IF NOT EXISTS hub_portal (
  section     VARCHAR(32) NOT NULL,
  payload     JSONB        NOT NULL,
  updated_by  VARCHAR(20) NULL,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (section)
);

CREATE TABLE IF NOT EXISTS hub_roster (
  id          VARCHAR(64)  NOT NULL,
  name        VARCHAR(128) NOT NULL,
  handle      VARCHAR(64)  NOT NULL,
  rank_id     VARCHAR(32)  NOT NULL,
  rank_label  VARCHAR(64)  NOT NULL,
  rank_order  INT          NOT NULL DEFAULT 0,
  team        VARCHAR(64)  NULL,
  joined      DATE         NULL,
  claims      INT          NOT NULL DEFAULT 0,
  vest_hours  INT          NOT NULL DEFAULT 0,
  status      VARCHAR(32)  NOT NULL DEFAULT 'Active',
  discord_id  VARCHAR(20)  NULL,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hub_disciplinary (
  id           VARCHAR(32)  NOT NULL,
  staff_name   VARCHAR(128) NOT NULL,
  rank_label   VARCHAR(64)  NULL,
  action_type  VARCHAR(64)  NOT NULL,
  tone         VARCHAR(16)  NOT NULL DEFAULT 'slate',
  issued_by    VARCHAR(128) NOT NULL,
  issued_at    DATE         NOT NULL,
  status       VARCHAR(32)  NOT NULL DEFAULT 'Active',
  summary      TEXT         NULL,
  discord_id   VARCHAR(20)  NULL,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- One row per staff exam attempt. override_payload caches the latest override
-- so listing attempts never needs to join the full history.
CREATE TABLE IF NOT EXISTS hub_attempts (
  attempt_id       VARCHAR(64)  NOT NULL,
  staff_name       VARCHAR(128) NOT NULL,
  discord_id       VARCHAR(20)  NULL,
  exam_type        VARCHAR(16)  NOT NULL,
  submitted_at     TIMESTAMPTZ     NOT NULL,
  score            VARCHAR(32)  NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'Needs Review',
  original_score   VARCHAR(32)  NULL,
  original_status  VARCHAR(32)  NULL,
  override_payload JSONB         NULL,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (attempt_id)
);

-- Append-only: every override ever applied. Rows are never updated or deleted,
-- which is what makes the audit log trustworthy.
CREATE TABLE IF NOT EXISTS hub_overrides (
  id               INT GENERATED BY DEFAULT AS IDENTITY,
  attempt_id       VARCHAR(64)  NOT NULL,
  discord_id       VARCHAR(20)  NULL,
  staff_name       VARCHAR(128) NULL,
  exam_type        VARCHAR(16)  NULL,
  original_score   VARCHAR(32)  NULL,
  original_status  VARCHAR(32)  NULL,
  override_score   VARCHAR(32)  NOT NULL,
  override_status  VARCHAR(32)  NOT NULL,
  reviewer         VARCHAR(128) NOT NULL,
  reason           TEXT         NOT NULL,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS hub_exam_settings (
  exam_type   VARCHAR(16) NOT NULL,
  pass_score  INT         NOT NULL,
  review_min  INT         NOT NULL,
  review_max  INT         NOT NULL,
  max_score   INT         NOT NULL,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (exam_type)
);

CREATE TABLE IF NOT EXISTS hub_questions (
  id               INT GENERATED BY DEFAULT AS IDENTITY,
  exam_type        VARCHAR(16)  NOT NULL,
  question_id      VARCHAR(32)  NOT NULL,
  question_number  VARCHAR(16)  NOT NULL,
  question_text    TEXT         NOT NULL,
  question_type    VARCHAR(32)  NULL,
  points           INT          NOT NULL DEFAULT 1,
  correct_answer   TEXT         NULL,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- Civilian Hub
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS civ_characters (
  id            VARCHAR(64)  NOT NULL,
  discord_id    VARCHAR(20)  NULL,
  name          VARCHAR(128) NOT NULL,
  dob           DATE         NULL,
  occupation    VARCHAR(128) NULL,
  residence     VARCHAR(255) NULL,
  phone         VARCHAR(32)  NULL,
  bank_balance  INT          NOT NULL DEFAULT 0,
  cash_balance  INT          NOT NULL DEFAULT 0,
  status        VARCHAR(32)  NOT NULL DEFAULT 'Active',
  is_primary    BOOLEAN      NOT NULL DEFAULT FALSE,
  joined_at     DATE         NULL,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS civ_vehicles (
  id                VARCHAR(64)  NOT NULL,
  plate             VARCHAR(16)  NOT NULL,
  make              VARCHAR(64)  NOT NULL,
  model             VARCHAR(64)  NOT NULL,
  model_year        INT          NULL,
  colour            VARCHAR(64)  NULL,
  owner_character   VARCHAR(64)  NULL,
  owner_name        VARCHAR(128) NULL,
  garage            VARCHAR(128) NULL,
  status            VARCHAR(32)  NOT NULL DEFAULT 'Stored',
  insured           BOOLEAN      NOT NULL DEFAULT FALSE,
  registered_until  DATE         NULL,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS civ_properties (
  id               VARCHAR(64)  NOT NULL,
  address          VARCHAR(255) NOT NULL,
  property_type    VARCHAR(64)  NULL,
  owner_character  VARCHAR(64)  NULL,
  owner_name       VARCHAR(128) NULL,
  district         VARCHAR(64)  NULL,
  purchased_at     DATE         NULL,
  value_usd        INT          NOT NULL DEFAULT 0,
  garage_slots     INT          NOT NULL DEFAULT 0,
  status           VARCHAR(32)  NOT NULL DEFAULT 'Owned',
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS civ_licences (
  id              VARCHAR(64)  NOT NULL,
  licence_type    VARCHAR(64)  NOT NULL,
  holder_character VARCHAR(64) NULL,
  holder_name     VARCHAR(128) NULL,
  licence_number  VARCHAR(32)  NOT NULL,
  issued_at       DATE         NULL,
  expires_at      DATE         NULL,
  status          VARCHAR(32)  NOT NULL DEFAULT 'Valid',
  points          INT          NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS civ_businesses (
  id          VARCHAR(64)  NOT NULL,
  name        VARCHAR(128) NOT NULL,
  category    VARCHAR(64)  NULL,
  owner_name  VARCHAR(128) NULL,
  district    VARCHAR(64)  NULL,
  phone       VARCHAR(32)  NULL,
  hiring      BOOLEAN      NOT NULL DEFAULT FALSE,
  blurb       TEXT         NULL,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS civ_jobs (
  id             VARCHAR(64)  NOT NULL,
  title          VARCHAR(128) NOT NULL,
  business_id    VARCHAR(64)  NULL,
  business_name  VARCHAR(128) NULL,
  category       VARCHAR(64)  NULL,
  pay            VARCHAR(64)  NULL,
  job_type       VARCHAR(32)  NULL,
  posted_at      DATE         NULL,
  blurb          TEXT         NULL,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS civ_classifieds (
  id           VARCHAR(64)  NOT NULL,
  title        VARCHAR(128) NOT NULL,
  category     VARCHAR(64)  NULL,
  price        VARCHAR(64)  NULL,
  seller_name  VARCHAR(128) NULL,
  phone        VARCHAR(32)  NULL,
  posted_at    DATE         NULL,
  blurb        TEXT         NULL,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS civ_penal_code (
  code        VARCHAR(16)  NOT NULL,
  title       VARCHAR(128) NOT NULL,
  degree      VARCHAR(32)  NOT NULL,
  fine        VARCHAR(32)  NULL,
  jail_time   VARCHAR(32)  NULL,
  points      INT          NOT NULL DEFAULT 0,
  notes       TEXT         NULL,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (code)
);

-- Penal code changes, laid over the seeded charge list. The 561 imported charges
-- ship in the seed; this table only stores what an editor has since added,
-- changed or removed, keyed by the charge id. An override on a seeded id edits
-- that charge (or, with deleted = TRUE, hides it); an id that is not in the seed
-- is a brand-new charge. Keeping edits here means the seed stays the canonical
-- import and a redeploy never clobbers a hand-added charge. Codes are not unique
-- (Sonoran reuses them), so the id — not the code — is the key.
CREATE TABLE IF NOT EXISTS penal_overrides (
  id          VARCHAR(40)  NOT NULL,
  code        VARCHAR(24)  NULL,
  title       VARCHAR(200) NULL,
  degree      VARCHAR(48)  NULL,
  bond        VARCHAR(32)  NULL,
  fine        VARCHAR(32)  NULL,
  jail        VARCHAR(48)  NULL,
  points      INT          NOT NULL DEFAULT 0,
  notes       TEXT         NULL,
  deleted     BOOLEAN      NOT NULL DEFAULT FALSE,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- Community roster (written by the Discord bot)
-- ---------------------------------------------------------------------------

-- One row per member holding a mapped Discord role. discord_id is unique
-- because the sync API upserts on it, and losing a member's roles deletes the
-- row rather than flagging it.
CREATE TABLE IF NOT EXISTS roster_members (
  id              VARCHAR(64)  NOT NULL,
  discord_id      VARCHAR(20)  NOT NULL,
  character_name  VARCHAR(128) NOT NULL,
  display_name    VARCHAR(128) NULL,
  department      VARCHAR(32)  NOT NULL,
  rank_label      VARCHAR(64)  NOT NULL,
  callsign        VARCHAR(32)  NULL,
  status          VARCHAR(32)  NOT NULL DEFAULT 'Active',
  joined_at       DATE         NULL,
  synced_at       TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source          VARCHAR(32)  NOT NULL DEFAULT 'discord-sync',
  PRIMARY KEY (id)
);

-- The Discord role → department/rank mapping the bot reads. Editing a row here
-- changes what a role means everywhere at once; the bot holds no copy.
CREATE TABLE IF NOT EXISTS roster_role_map (
  role_id           VARCHAR(20)  NOT NULL,
  role_key          VARCHAR(64)  NOT NULL,
  -- 'rank' for a rostered rank, 'base' for membership/whitelisting, 'tag' for
  -- status roles like LOA. One table so a single save keeps them consistent.
  kind              VARCHAR(16)  NOT NULL DEFAULT 'rank',
  department        VARCHAR(32)  NULL,
  rank_label        VARCHAR(64)  NOT NULL,
  rank_full         VARCHAR(128) NULL,
  sort_order        INT          NOT NULL DEFAULT 0,
  display_template  VARCHAR(128) NOT NULL DEFAULT '{callsign} | {rank} | {surname}',
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id)
);

-- A rank's colour on the roster, seeded from its Discord role colour on import
-- and overridable by hand. The rank name renders in this colour.
ALTER TABLE roster_role_map
  ADD COLUMN IF NOT EXISTS color VARCHAR(9) NULL;

-- Callsigns the hub hands out automatically, one per member per department, from
-- that department's configured number range. Stored so a member keeps the same
-- number across syncs; a member who carries a callsign in their Discord nickname
-- has no row here (their nickname wins) but reserves that number so it isn't
-- reassigned.
CREATE TABLE IF NOT EXISTS dept_callsigns (
  department   VARCHAR(32) NOT NULL,
  discord_id   VARCHAR(20) NOT NULL,
  callsign     VARCHAR(16) NOT NULL,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (department, discord_id)
);

-- The leadership team the public home page shows — a fixed set of seats
-- (Ownership + the Board of Directors), edited by hand by Ownership. A seat with
-- no name renders as "Vacant".
CREATE TABLE IF NOT EXISTS leadership_seats (
  seat_key    VARCHAR(48)  NOT NULL,
  grp         VARCHAR(16)  NOT NULL,
  title       VARCHAR(64)  NOT NULL,
  name        VARCHAR(128) NOT NULL DEFAULT '',
  handle      VARCHAR(64)  NOT NULL DEFAULT '',
  discord_id  VARCHAR(20)  NOT NULL DEFAULT '',
  avatar_url  TEXT         NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (seat_key)
);

-- The seats ship empty; editing fills them. ON CONFLICT DO NOTHING keeps any
-- edits across a redeploy while still adding a seat that is new to this list.
INSERT INTO leadership_seats (seat_key, grp, title, sort_order) VALUES
  ('owner',                  'ownership', 'Owner',                   0),
  ('co-owner',               'ownership', 'Co-Owner',                1),
  ('staff-director',         'directors', 'Staff Director',          0),
  ('es-director',            'directors', 'ES Director',             1),
  ('dev-director',           'directors', 'Dev. Director',           2),
  ('civilian-director',      'directors', 'Civilian Director',       3),
  ('asst-staff-director',    'directors', 'Asst. Staff Director',    4),
  ('asst-es-director',       'directors', 'Asst. ES Director',       5),
  ('asst-dev-director',      'directors', 'Asst. Dev. Director',     6),
  ('asst-civilian-director', 'directors', 'Asst. Civilian Director', 7)
ON CONFLICT (seat_key) DO NOTHING;

-- Append-only record of what the bot changed, so a wrong rank can be traced.
CREATE TABLE IF NOT EXISTS roster_sync_log (
  id              INT GENERATED BY DEFAULT AS IDENTITY,
  discord_id      VARCHAR(20)  NULL,
  character_name  VARCHAR(128) NULL,
  action          VARCHAR(32)  NOT NULL,
  detail          TEXT         NULL,
  actor           VARCHAR(64)  NOT NULL DEFAULT 'roster-bot',
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- Permission grants (edited from the Permissions page)
-- ---------------------------------------------------------------------------

-- One row per (permission, Discord role) pair. An empty table means the shipped
-- defaults apply, so a fresh install is neither wide open nor locked out.
CREATE TABLE IF NOT EXISTS permission_grants (
  permission_key  VARCHAR(64) NOT NULL,
  role_key        VARCHAR(64) NOT NULL,
  granted_by      VARCHAR(20) NULL,
  granted_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (permission_key, role_key)
);

-- LOA is stored on the roster row: the return date lives here rather than in the
-- bot, so a restart or redeploy cannot lose a pending return.
ALTER TABLE roster_members
  ADD COLUMN IF NOT EXISTS loa_until  DATE NULL,
  ADD COLUMN IF NOT EXISTS loa_reason TEXT NULL;

-- Every mapped Discord role the member currently holds, so a department roster
-- can show anyone who holds one of *its* roles even when the member's highest
-- rank (the one that decides their primary department above) is in another
-- department. Without it a trooper who is also staff would show only on the
-- staff roster, never on their department's.
ALTER TABLE roster_members
  ADD COLUMN IF NOT EXISTS role_ids TEXT[] NULL;

-- The member's server nickname in each guild the bot shares with them, keyed by
-- guild id. A department roster shows the character name and callsign from *its*
-- server's nickname — the "901 | Trooper | Jamison" a member sets there — rather
-- than a global Discord username that means nothing in-character.
ALTER TABLE roster_members
  ADD COLUMN IF NOT EXISTS nicks JSONB NULL;

-- Staff activity overlay. The bot owns who is on the roster and at what rank;
-- this holds the human-managed activity a Discord role cannot express — status,
-- leave, probation and when they last moved rank — keyed by Discord id so it
-- rides alongside the bot's roster without the bot needing to know about it. A
-- missing row means Active, so a member never has to be created here first.
CREATE TABLE IF NOT EXISTS staff_activity (
  discord_id       VARCHAR(20)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'Active',
  loa_until        DATE         NULL,
  loa_reason       TEXT         NULL,
  probation_until  DATE         NULL,
  last_move        DATE         NULL,
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (discord_id)
);

-- ---------------------------------------------------------------------------
-- Department sites (the department hub engine)
-- ---------------------------------------------------------------------------

-- One row per department site. The whole site — branding, navigation, pages,
-- roster layout and its access table — is the config document, which is why a
-- new department needs no migration and no deploy. An empty table means the
-- seeds in server/src/departmentSeed.js apply, so the hub works before anything
-- has ever been saved.
CREATE TABLE IF NOT EXISTS department_configs (
  id          VARCHAR(64) NOT NULL,
  config      JSONB        NOT NULL,
  updated_by  VARCHAR(20) NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- The config each save replaced, so a department that breaks its own site can
-- restore the previous version from the Builder Portal instead of filing a
-- ticket. Trimmed to the newest 50 per department on every write — Builder
-- sessions auto-save far more often than anyone reads back.
CREATE TABLE IF NOT EXISTS department_config_versions (
  id             INT GENERATED BY DEFAULT AS IDENTITY,
  department_id  VARCHAR(64)  NOT NULL,
  config         JSONB         NOT NULL,
  label          VARCHAR(160) NULL,
  actor          VARCHAR(20)  NULL,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Append-only record of who changed what on a department site.
CREATE TABLE IF NOT EXISTS department_audit_log (
  id             INT GENERATED BY DEFAULT AS IDENTITY,
  department_id  VARCHAR(64)  NOT NULL,
  actor          VARCHAR(20)  NULL,
  actor_name     VARCHAR(128) NULL,
  action         VARCHAR(64)  NOT NULL,
  summary        VARCHAR(512) NULL,
  at             TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- The staff roster grew an operational view: a callsign, the position someone
-- holds (which is not the same as their rank), when they were hired and last
-- moved, free-text notes, and rows for positions nobody currently holds.
ALTER TABLE hub_roster
  ADD COLUMN IF NOT EXISTS callsign      VARCHAR(16)  NULL,
  ADD COLUMN IF NOT EXISTS position      VARCHAR(96)  NULL,
  ADD COLUMN IF NOT EXISTS position_note VARCHAR(96)  NULL,
  ADD COLUMN IF NOT EXISTS hired         DATE         NULL,
  ADD COLUMN IF NOT EXISTS last_move     DATE         NULL,
  ADD COLUMN IF NOT EXISTS loa_until     DATE         NULL,
  ADD COLUMN IF NOT EXISTS online        BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notes         TEXT         NULL,
  ADD COLUMN IF NOT EXISTS vacant        BOOLEAN      NOT NULL DEFAULT FALSE;

-- Who is on probation and which administrator is signing off on them. Read
-- beside the staff roster but kept apart from it: it is a different list, and a
-- join would make every roster read carry it.
CREATE TABLE IF NOT EXISTS hub_training (
  id          VARCHAR(32)  NOT NULL,
  trainee     VARCHAR(128) NOT NULL,
  admin_name  VARCHAR(128) NOT NULL,
  since       DATE         NULL,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- Forms and exams
-- ---------------------------------------------------------------------------

-- One row per form. The whole document — questions, answer key, thresholds and
-- who may take or review it — is JSONB, so adding a question type needs no
-- migration. An empty table means the seeds in server/src/formsSeed.js apply.
CREATE TABLE IF NOT EXISTS forms (
  id          VARCHAR(64) NOT NULL,
  audience    VARCHAR(16) NOT NULL DEFAULT 'staff',
  document    JSONB        NOT NULL,
  updated_by  VARCHAR(20) NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Answers only. The score is never stored: it is computed from the form on
-- every read, so correcting an answer key re-grades the whole history instead
-- of leaving old results wrong. subject_name is NULL for an anonymous form —
-- the identity is not recorded rather than recorded and hidden.
CREATE TABLE IF NOT EXISTS form_submissions (
  id                  VARCHAR(64)  NOT NULL,
  form_id             VARCHAR(64)  NOT NULL,
  subject_name        VARCHAR(128) NULL,
  subject_discord_id  VARCHAR(20)  NULL,
  answers             JSONB         NOT NULL,
  submitted_at        TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- A reviewer's score for one written answer, kept apart from the submission so
-- the original auto-grade is never overwritten — the machine's result and the
-- human's adjustment to it are two different facts.
CREATE TABLE IF NOT EXISTS form_reviews (
  submission_id  VARCHAR(64) NOT NULL,
  question_id    VARCHAR(64) NOT NULL,
  awarded        INT         NOT NULL DEFAULT 0,
  reviewer       VARCHAR(20) NULL,
  reviewed_at    TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (submission_id, question_id)
);

-- ---------------------------------------------------------------------------
-- Promotion board
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS promotion_votes (
  id                  VARCHAR(64)  NOT NULL,
  nominee_name        VARCHAR(128) NOT NULL,
  nominee_discord_id  VARCHAR(20)  NULL,
  current_role_key    VARCHAR(64)  NULL,
  proposed_role_key   VARCHAR(64)  NOT NULL,
  reason              TEXT         NOT NULL,
  created_by          VARCHAR(20)  NULL,
  created_by_name     VARCHAR(128) NULL,
  opens_at            TIMESTAMPTZ     NOT NULL,
  closes_at           TIMESTAMPTZ     NOT NULL,
  published           BOOLEAN      NOT NULL DEFAULT FALSE,
  published_at        TIMESTAMPTZ    NULL,
  cancelled           BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- One ballot per voter per vote, so changing your mind updates rather than
-- appends. Ballots are their own table because voting is the concurrent
-- operation here — two people voting at once on a single JSONB document would
-- lose one of them.
CREATE TABLE IF NOT EXISTS promotion_ballots (
  vote_id           VARCHAR(64)  NOT NULL,
  voter_discord_id  VARCHAR(20)  NOT NULL,
  voter_name        VARCHAR(128) NULL,
  choice            VARCHAR(16)  NOT NULL,
  reason            VARCHAR(512) NULL,
  cast_at           TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (vote_id, voter_discord_id)
);

-- Board settings, currently just the live-result visibility rules.
CREATE TABLE IF NOT EXISTS promotion_settings (
  name        VARCHAR(64) NOT NULL,
  value       JSONB        NOT NULL,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (name)
);

-- ------------------------------------------------------------------ --
-- Emergency Services transfer portal
-- ------------------------------------------------------------------ --

-- One row per transfer ticket.
--
-- approvals and history are JSONB rather than tables of their own: both are
-- read only as part of a ticket, both are written by the same person in the
-- same action, and neither is queried across tickets. That is the opposite of
-- promotion ballots, which are concurrent and so live in their own table.
--
-- Ported from fartherr97/es-transfer-portal. That schema.sql had fallen behind
-- its own code — no approvals, history, rejection_reason, assigned_rank,
-- retired_member or employment_type columns, and a status ENUM missing
-- 'closed', all of which lib/transfers.js read and wrote. This is the full set.
--
-- created_by_id is the one column upstream does not have, and it fixes a real
-- bug. Upstream decides whether you are looking at your own ticket by comparing
-- your Discord username and display name against the strings stored on the row
-- (lib/access.js, isOwnTicket). Change your Discord name — or have a department
-- head correct a typo in the member field — and that comparison stops matching,
-- so the person who opened the ticket is refused their own ticket while it is
-- still open. The submitter's user id is recorded here at creation and matched
-- first; the name comparison stays as a fallback for rows created before it.
CREATE TABLE IF NOT EXISTS transfers (
  id                VARCHAR(32)  NOT NULL,
  member_name       VARCHAR(128) NOT NULL,
  discord_username  VARCHAR(128) NOT NULL,
  created_by_id     VARCHAR(20)  NULL,
  current_rank      VARCHAR(128) NOT NULL,
  from_dept         VARCHAR(32)  NOT NULL,
  to_dept           VARCHAR(32)  NOT NULL,
  reason            TEXT         NULL,
  status            VARCHAR(16)  NOT NULL DEFAULT 'pending',
  -- What the outgoing department should do with their roles once it completes.
  remove_roles        BOOLEAN    NOT NULL DEFAULT TRUE,
  assign_visitor_pass BOOLEAN    NOT NULL DEFAULT TRUE,
  assign_retired      BOOLEAN    NOT NULL DEFAULT FALSE,
  require_bot_confirm BOOLEAN    NOT NULL DEFAULT TRUE,
  -- The outcome, written when the receiving department processes it.
  assigned_rank     VARCHAR(128) NULL,
  employment_type   VARCHAR(16)  NULL,
  retired_member    BOOLEAN      NOT NULL DEFAULT FALSE,
  rejection_reason  VARCHAR(512) NULL,
  approvals         JSONB         NOT NULL,
  history           JSONB         NOT NULL,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Per-ticket chat. internal = 1 is the staff-only thread; internal = 0 is
-- the thread the transferee also reads. One table rather than two because they
-- differ by a flag and nothing else — and because a query that forgets the flag
-- is easier to spot than a join against the wrong table.
CREATE TABLE IF NOT EXISTS transfer_messages (
  id            VARCHAR(48)  NOT NULL,
  transfer_id   VARCHAR(32)  NOT NULL,
  internal      BOOLEAN      NOT NULL DEFAULT FALSE,
  author_id     VARCHAR(20)  NULL,
  author_name   VARCHAR(128) NOT NULL,
  author_avatar VARCHAR(512) NULL,
  body          TEXT         NOT NULL,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_transfer_messages FOREIGN KEY (transfer_id)
    REFERENCES transfers(id) ON DELETE CASCADE
);

-- Who is looking at a ticket right now. Upserted on each heartbeat; a viewer
-- counts as present while last_seen is inside the TTL, and reads filter on it
-- rather than relying on anything having cleaned up.
CREATE TABLE IF NOT EXISTS transfer_viewers (
  transfer_id  VARCHAR(32)  NOT NULL,
  viewer_id    VARCHAR(20)  NOT NULL,
  viewer_name  VARCHAR(128) NOT NULL,
  viewer_avatar VARCHAR(512) NULL,
  last_seen    TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (transfer_id, viewer_id),
  CONSTRAINT fk_transfer_viewers FOREIGN KEY (transfer_id)
    REFERENCES transfers(id) ON DELETE CASCADE
);

-- How much of each thread a viewer has read.
--
-- Upstream keeps this in a React ref seeded at zero (app/page.jsx, TicketChat),
-- so the baseline dies with the component: reopen a ticket and every internal
-- message counts as unread again — five notes you already read still show as
-- five. Storing it per viewer per ticket makes the badge mean "since you last
-- looked" rather than "since this component mounted", and it follows the person
-- rather than the browser they happened to read it in.
--
-- Counts, not timestamps: the badge is a count, and comparing two integers
-- cannot disagree with the number rendered next to it the way a clock can.
CREATE TABLE IF NOT EXISTS transfer_reads (
  transfer_id   VARCHAR(32) NOT NULL,
  viewer_id     VARCHAR(20) NOT NULL,
  public_seen   INT         NOT NULL DEFAULT 0,
  internal_seen INT         NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (transfer_id, viewer_id),
  CONSTRAINT fk_transfer_reads FOREIGN KEY (transfer_id)
    REFERENCES transfers(id) ON DELETE CASCADE
);

-- Per-department webhook configuration. The original kept this in a process
-- global and reset it on every restart; a webhook URL that a director typed in
-- should survive a deploy, so it goes in a table.
CREATE TABLE IF NOT EXISTS transfer_webhooks (
  department_id VARCHAR(32) NOT NULL,
  config        JSONB        NOT NULL,
  updated_by    VARCHAR(20) NULL,
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (department_id)
);

-- ------------------------------------------------------------------ --
-- Disciplinary actions
-- ------------------------------------------------------------------ --

-- Every action taken against a member, by the staff team or by a department.
--
-- One table for both on purpose. A department write-up the staff team cannot
-- see is how somebody with four of them keeps getting hired, and a background
-- check that only covers half the community is worse than none — it reads as a
-- clean record.
--
-- voided rather than DELETE: an action that was later withdrawn is still part
-- of the record, and dropping the row would let a reviewer conclude nothing
-- ever happened. The row stays, marked, with the reason it was withdrawn.
CREATE TABLE IF NOT EXISTS disciplinary_actions (
  id                   BIGINT GENERATED BY DEFAULT AS IDENTITY,
  type                 VARCHAR(32)  NOT NULL,
  body_id              VARCHAR(32)  NOT NULL,
  target_name          VARCHAR(128) NOT NULL,
  target_discord_id    VARCHAR(20)  NOT NULL,
  issued_by_name       VARCHAR(128) NOT NULL,
  issued_by_discord_id VARCHAR(20)  NULL,
  reason               VARCHAR(1000) NOT NULL,
  expires_at           TIMESTAMPTZ    NULL,
  voided               BOOLEAN      NOT NULL DEFAULT FALSE,
  void_reason          VARCHAR(500) NULL,
  created_at           TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id));

-- ------------------------------------------------------------------ --
-- Support portal
-- ------------------------------------------------------------------ --

-- One row per ticket. details holds the intake answers for whichever type it
-- is — a ban appeal's fields are not a bug report's, and a column per field
-- across six types would be mostly nulls.
CREATE TABLE IF NOT EXISTS support_tickets (
  id                  VARCHAR(32)  NOT NULL,
  type                VARCHAR(32)  NOT NULL,
  subject             VARCHAR(200) NOT NULL,
  status              VARCHAR(16)  NOT NULL DEFAULT 'open',
  priority            VARCHAR(16)  NOT NULL DEFAULT 'normal',
  details             JSONB         NOT NULL,
  opened_by_discord_id VARCHAR(20) NULL,
  opened_by_name      VARCHAR(128) NOT NULL,
  assigned_to_discord_id VARCHAR(20) NULL,
  assigned_to_name    VARCHAR(128) NULL,
  history             JSONB         NOT NULL,
  -- Denormalised so a queue sorted by "least recently touched" does not need a
  -- join against every message on every ticket.
  last_message_at     TIMESTAMPTZ    NULL,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- The thread. internal = 1 is a staff note the member never sees; it lives in
-- the same table because the two differ by a flag and nothing else, and a query
-- that forgets the flag is easier to spot than a join against the wrong table.
--
-- reply_to_id is what draws the quoted block above a message, so an agent
-- answering the third question in a long ticket can say which one.
CREATE TABLE IF NOT EXISTS support_messages (
  id           VARCHAR(48)  NOT NULL,
  ticket_id    VARCHAR(32)  NOT NULL,
  internal     BOOLEAN      NOT NULL DEFAULT FALSE,
  author_id    VARCHAR(20)  NULL,
  author_name  VARCHAR(128) NOT NULL,
  author_role  VARCHAR(64)  NULL,
  body         TEXT         NOT NULL,
  reply_to_id  VARCHAR(48)  NULL,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_support_messages FOREIGN KEY (ticket_id)
    REFERENCES support_tickets(id) ON DELETE CASCADE
);

-- The author's Discord avatar, captured at post time so the thread shows real
-- faces without a per-render lookup. Nullable: older rows and members with no
-- avatar fall back to initials.
ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS author_avatar TEXT NULL;

-- Live presence: who is looking at a ticket right now, and who is typing. One
-- row per (ticket, viewer), refreshed by a heartbeat from the open page; a
-- viewer counts as "here" while their row is fresh and "typing" while their
-- typing flag is fresh. Polled rather than socket-backed — a support thread has
-- a handful of people in it, not a stadium.
CREATE TABLE IF NOT EXISTS support_presence (
  ticket_id   VARCHAR(32)  NOT NULL,
  discord_id  VARCHAR(20)  NOT NULL,
  name        VARCHAR(128) NOT NULL,
  avatar      TEXT         NULL,
  typing      BOOLEAN      NOT NULL DEFAULT FALSE,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ticket_id, discord_id),
  CONSTRAINT fk_support_presence FOREIGN KEY (ticket_id)
    REFERENCES support_tickets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_support_presence_ticket ON support_presence (ticket_id, updated_at);

-- Response flows: the branching trees agents walk to compose a reply. The whole
-- tree is one JSONB document because it is edited as a whole by one person in a
-- builder, the same reason department configs and applications are.
CREATE TABLE IF NOT EXISTS support_flows (
  id          VARCHAR(64) NOT NULL,
  name        VARCHAR(120) NOT NULL,
  enabled     BOOLEAN     NOT NULL DEFAULT FALSE,
  document    JSONB        NOT NULL,
  updated_by  VARCHAR(20) NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Ticket categories: the whole ordered catalogue in one JSONB document, edited
-- as a whole by Directorship on the category page. A singleton row ('default')
-- keeps ordering and atomic edits trivial; absent, the code falls back to the
-- built-in default catalogue.
CREATE TABLE IF NOT EXISTS support_type_config (
  id          VARCHAR(32) NOT NULL DEFAULT 'default',
  document    JSONB        NOT NULL,
  updated_by  VARCHAR(20) NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- ------------------------------------------------------------------ --
-- Development Hub
--
-- A development request is a typed ticket for a build — a personal vehicle, a
-- department livery, a script. Same shape as a support ticket (typed intake, a
-- status, a thread) with its own vocabulary. The vehicle library and the
-- suggestion/bug feedback box live alongside it.
-- ------------------------------------------------------------------ --

CREATE TABLE IF NOT EXISTS dev_requests (
  id                     VARCHAR(32)  NOT NULL,
  type                   VARCHAR(48)  NOT NULL,
  subject                VARCHAR(200) NOT NULL,
  status                 VARCHAR(24)  NOT NULL DEFAULT 'pending',
  priority               VARCHAR(16)  NOT NULL DEFAULT 'normal',
  department             VARCHAR(32)  NULL,
  details                JSONB        NOT NULL DEFAULT '{}'::jsonb,
  opened_by_discord_id   VARCHAR(20)  NULL,
  opened_by_name         VARCHAR(128) NOT NULL,
  assigned_to_discord_id VARCHAR(20)  NULL,
  assigned_to_name       VARCHAR(128) NULL,
  history                JSONB        NOT NULL DEFAULT '[]'::jsonb,
  last_message_at        TIMESTAMPTZ  NULL,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS dev_request_messages (
  id            VARCHAR(48)  NOT NULL,
  request_id    VARCHAR(32)  NOT NULL,
  internal      BOOLEAN      NOT NULL DEFAULT FALSE,
  author_id     VARCHAR(20)  NULL,
  author_name   VARCHAR(128) NOT NULL,
  author_role   VARCHAR(64)  NULL,
  author_avatar TEXT         NULL,
  body          TEXT         NOT NULL,
  reply_to_id   VARCHAR(48)  NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_dev_request_messages FOREIGN KEY (request_id)
    REFERENCES dev_requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dev_vehicles (
  id          VARCHAR(64)  NOT NULL,
  name        VARCHAR(160) NOT NULL,
  year        VARCHAR(8)   NULL,
  developer   VARCHAR(160) NULL,
  spawn_code  VARCHAR(80)  NULL,
  available   BOOLEAN      NOT NULL DEFAULT TRUE,
  category    VARCHAR(48)  NULL,
  image_url   TEXT         NULL,
  source_url  TEXT         NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS dev_feedback (
  id                   INT GENERATED BY DEFAULT AS IDENTITY,
  type                 VARCHAR(24)  NOT NULL,
  title                VARCHAR(200) NOT NULL,
  body                 TEXT         NOT NULL,
  status               VARCHAR(24)  NOT NULL DEFAULT 'open',
  opened_by_discord_id VARCHAR(20)  NULL,
  opened_by_name       VARCHAR(128) NULL,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- The request-category catalogue in one JSONB document (singleton 'default'),
-- edited as a whole on the category page; absent, the built-in defaults stand.
CREATE TABLE IF NOT EXISTS dev_type_config (
  id          VARCHAR(32) NOT NULL DEFAULT 'default',
  document    JSONB        NOT NULL,
  updated_by  VARCHAR(20) NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- ------------------------------------------------------------------ --
-- Indexes
--
-- Separate statements rather than inline KEY clauses: that is MySQL syntax,
-- and Postgres index names are unique per database rather than per table —
-- which is why each one already carries its table's name.
-- ------------------------------------------------------------------ --

CREATE INDEX IF NOT EXISTS idx_rules_category ON rules (category_id);
CREATE INDEX IF NOT EXISTS idx_patch_notes_released ON patch_notes (released_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_applications_reference ON applications (reference);
CREATE INDEX IF NOT EXISTS idx_applications_discord_id ON applications (discord_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_reports_reference ON reports (reference);
CREATE INDEX IF NOT EXISTS idx_reports_discord_id ON reports (discord_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events (event_date);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles (category);
CREATE INDEX IF NOT EXISTS idx_supporters_tier ON supporters (tier);
CREATE INDEX IF NOT EXISTS idx_hub_roster_rank ON hub_roster (rank_id);
CREATE INDEX IF NOT EXISTS idx_hub_roster_discord ON hub_roster (discord_id);
CREATE INDEX IF NOT EXISTS idx_hub_da_discord ON hub_disciplinary (discord_id);
CREATE INDEX IF NOT EXISTS idx_hub_da_issued ON hub_disciplinary (issued_at);
CREATE INDEX IF NOT EXISTS idx_hub_attempts_discord ON hub_attempts (discord_id);
CREATE INDEX IF NOT EXISTS idx_hub_attempts_exam ON hub_attempts (exam_type);
CREATE INDEX IF NOT EXISTS idx_hub_attempts_submitted ON hub_attempts (submitted_at);
CREATE INDEX IF NOT EXISTS idx_hub_overrides_attempt ON hub_overrides (attempt_id);
CREATE INDEX IF NOT EXISTS idx_hub_overrides_created ON hub_overrides (created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hub_questions_qid ON hub_questions (question_id);
CREATE INDEX IF NOT EXISTS idx_hub_questions_exam ON hub_questions (exam_type);
CREATE INDEX IF NOT EXISTS idx_civ_characters_discord ON civ_characters (discord_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_civ_vehicles_plate ON civ_vehicles (plate);
CREATE INDEX IF NOT EXISTS idx_civ_vehicles_owner ON civ_vehicles (owner_character);
CREATE INDEX IF NOT EXISTS idx_civ_properties_owner ON civ_properties (owner_character);
CREATE UNIQUE INDEX IF NOT EXISTS uq_civ_licences_number ON civ_licences (licence_number);
CREATE INDEX IF NOT EXISTS idx_civ_licences_holder ON civ_licences (holder_character);
CREATE INDEX IF NOT EXISTS idx_civ_businesses_category ON civ_businesses (category);
CREATE INDEX IF NOT EXISTS idx_civ_jobs_posted ON civ_jobs (posted_at);
CREATE INDEX IF NOT EXISTS idx_civ_classifieds_posted ON civ_classifieds (posted_at);
CREATE INDEX IF NOT EXISTS idx_civ_penal_degree ON civ_penal_code (degree);
CREATE UNIQUE INDEX IF NOT EXISTS uq_roster_discord ON roster_members (discord_id);
CREATE INDEX IF NOT EXISTS idx_roster_department ON roster_members (department);
CREATE INDEX IF NOT EXISTS idx_roster_status ON roster_members (status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_roster_role_key ON roster_role_map (role_key);
CREATE INDEX IF NOT EXISTS idx_roster_role_department ON roster_role_map (department);
CREATE INDEX IF NOT EXISTS idx_roster_role_kind ON roster_role_map (kind);
CREATE INDEX IF NOT EXISTS idx_roster_log_discord ON roster_sync_log (discord_id);
CREATE INDEX IF NOT EXISTS idx_roster_log_created ON roster_sync_log (created_at);
CREATE INDEX IF NOT EXISTS idx_permission_grants_role ON permission_grants (role_key);
CREATE INDEX IF NOT EXISTS idx_dept_versions_dept ON department_config_versions (department_id, id);
CREATE INDEX IF NOT EXISTS idx_dept_audit_dept ON department_audit_log (department_id, id);
CREATE INDEX IF NOT EXISTS idx_forms_audience ON forms (audience);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form ON form_submissions (form_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_form_submissions_discord ON form_submissions (subject_discord_id);
CREATE INDEX IF NOT EXISTS idx_promotion_votes_closes ON promotion_votes (closes_at);
CREATE INDEX IF NOT EXISTS idx_transfers_queue ON transfers (status, created_at);
CREATE INDEX IF NOT EXISTS idx_transfers_depts ON transfers (from_dept, to_dept);
CREATE INDEX IF NOT EXISTS idx_transfers_creator ON transfers (created_by_id);
CREATE INDEX IF NOT EXISTS idx_transfer_messages_thread ON transfer_messages (transfer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transfer_viewers_seen ON transfer_viewers (last_seen);
-- The index /bgcheck reads: one member, newest first, inside a date window.
CREATE INDEX IF NOT EXISTS idx_discipline_target ON disciplinary_actions (target_discord_id, created_at);
CREATE INDEX IF NOT EXISTS idx_discipline_issuer ON disciplinary_actions (issued_by_discord_id, created_at);
CREATE INDEX IF NOT EXISTS idx_discipline_body ON disciplinary_actions (body_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_queue ON support_tickets (status, priority, last_message_at);
CREATE INDEX IF NOT EXISTS idx_support_opener ON support_tickets (opened_by_discord_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_assignee ON support_tickets (assigned_to_discord_id, status);
CREATE INDEX IF NOT EXISTS idx_support_messages_thread ON support_messages (ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dev_requests_queue ON dev_requests (status, priority, last_message_at);
CREATE INDEX IF NOT EXISTS idx_dev_requests_opener ON dev_requests (opened_by_discord_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dev_requests_assignee ON dev_requests (assigned_to_discord_id, status);
CREATE INDEX IF NOT EXISTS idx_dev_request_messages_thread ON dev_request_messages (request_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dev_vehicles_order ON dev_vehicles (sort_order, name);
CREATE INDEX IF NOT EXISTS idx_dev_feedback_created ON dev_feedback (created_at);

-- ------------------------------------------------------------------ --
-- updated_at triggers
-- ------------------------------------------------------------------ --

DROP TRIGGER IF EXISTS touch_users ON users;
CREATE TRIGGER touch_users BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_departments ON departments;
CREATE TRIGGER touch_departments BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_staff ON staff;
CREATE TRIGGER touch_staff BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_rules ON rules;
CREATE TRIGGER touch_rules BEFORE UPDATE ON rules
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_patch_notes ON patch_notes;
CREATE TRIGGER touch_patch_notes BEFORE UPDATE ON patch_notes
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_applications ON applications;
CREATE TRIGGER touch_applications BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_reports ON reports;
CREATE TRIGGER touch_reports BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_events ON events;
CREATE TRIGGER touch_events BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_articles ON articles;
CREATE TRIGGER touch_articles BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_supporters ON supporters;
CREATE TRIGGER touch_supporters BEFORE UPDATE ON supporters
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_store_tiers ON store_tiers;
CREATE TRIGGER touch_store_tiers BEFORE UPDATE ON store_tiers
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_hub_portal ON hub_portal;
CREATE TRIGGER touch_hub_portal BEFORE UPDATE ON hub_portal
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_hub_roster ON hub_roster;
CREATE TRIGGER touch_hub_roster BEFORE UPDATE ON hub_roster
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_hub_disciplinary ON hub_disciplinary;
CREATE TRIGGER touch_hub_disciplinary BEFORE UPDATE ON hub_disciplinary
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_hub_attempts ON hub_attempts;
CREATE TRIGGER touch_hub_attempts BEFORE UPDATE ON hub_attempts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_hub_exam_settings ON hub_exam_settings;
CREATE TRIGGER touch_hub_exam_settings BEFORE UPDATE ON hub_exam_settings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_hub_questions ON hub_questions;
CREATE TRIGGER touch_hub_questions BEFORE UPDATE ON hub_questions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_civ_characters ON civ_characters;
CREATE TRIGGER touch_civ_characters BEFORE UPDATE ON civ_characters
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_civ_vehicles ON civ_vehicles;
CREATE TRIGGER touch_civ_vehicles BEFORE UPDATE ON civ_vehicles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_civ_properties ON civ_properties;
CREATE TRIGGER touch_civ_properties BEFORE UPDATE ON civ_properties
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_civ_licences ON civ_licences;
CREATE TRIGGER touch_civ_licences BEFORE UPDATE ON civ_licences
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_civ_businesses ON civ_businesses;
CREATE TRIGGER touch_civ_businesses BEFORE UPDATE ON civ_businesses
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_civ_jobs ON civ_jobs;
CREATE TRIGGER touch_civ_jobs BEFORE UPDATE ON civ_jobs
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_civ_classifieds ON civ_classifieds;
CREATE TRIGGER touch_civ_classifieds BEFORE UPDATE ON civ_classifieds
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_civ_penal_code ON civ_penal_code;
CREATE TRIGGER touch_civ_penal_code BEFORE UPDATE ON civ_penal_code
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_roster_role_map ON roster_role_map;
CREATE TRIGGER touch_roster_role_map BEFORE UPDATE ON roster_role_map
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_department_configs ON department_configs;
CREATE TRIGGER touch_department_configs BEFORE UPDATE ON department_configs
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_forms ON forms;
CREATE TRIGGER touch_forms BEFORE UPDATE ON forms
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_promotion_settings ON promotion_settings;
CREATE TRIGGER touch_promotion_settings BEFORE UPDATE ON promotion_settings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_transfers ON transfers;
CREATE TRIGGER touch_transfers BEFORE UPDATE ON transfers
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_transfer_viewers ON transfer_viewers;
CREATE TRIGGER touch_transfer_viewers BEFORE UPDATE ON transfer_viewers
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_transfer_reads ON transfer_reads;
CREATE TRIGGER touch_transfer_reads BEFORE UPDATE ON transfer_reads
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_transfer_webhooks ON transfer_webhooks;
CREATE TRIGGER touch_transfer_webhooks BEFORE UPDATE ON transfer_webhooks
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_disciplinary_actions ON disciplinary_actions;
CREATE TRIGGER touch_disciplinary_actions BEFORE UPDATE ON disciplinary_actions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_support_tickets ON support_tickets;
CREATE TRIGGER touch_support_tickets BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_support_flows ON support_flows;
CREATE TRIGGER touch_support_flows BEFORE UPDATE ON support_flows
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_dev_requests ON dev_requests;
CREATE TRIGGER touch_dev_requests BEFORE UPDATE ON dev_requests
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_dev_vehicles ON dev_vehicles;
CREATE TRIGGER touch_dev_vehicles BEFORE UPDATE ON dev_vehicles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_dev_type_config ON dev_type_config;
CREATE TRIGGER touch_dev_type_config BEFORE UPDATE ON dev_type_config
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS touch_support_type_config ON support_type_config;
CREATE TRIGGER touch_support_type_config BEFORE UPDATE ON support_type_config
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Community image host. Uploaded images live in the database (Northflank wipes
-- local disk on redeploy), keyed by a random id that also forms the public URL
-- at /images/<id>. Only raster types are accepted (no SVG, which can carry
-- script), verified by magic bytes at upload.
CREATE TABLE IF NOT EXISTS media_images (
  id               TEXT PRIMARY KEY,
  content_type     TEXT NOT NULL,
  bytes            BYTEA NOT NULL,
  size             INTEGER NOT NULL,
  original_name    TEXT,
  uploaded_by_id   TEXT,
  uploaded_by_name TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_images_created_idx ON media_images (created_at DESC);
CREATE INDEX IF NOT EXISTS media_images_uploader_idx ON media_images (uploaded_by_id);

-- Who has said they will attend a department calendar event. Kept out of the
-- department config so a member RSVPing needs no edit rights and does not spawn
-- a config version on every click; keyed by (department, event, member).
CREATE TABLE IF NOT EXISTS event_attendance (
  dept_id     TEXT NOT NULL,
  event_id    TEXT NOT NULL,
  discord_id  TEXT NOT NULL,
  name        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (dept_id, event_id, discord_id)
);
CREATE INDEX IF NOT EXISTS event_attendance_dept_idx ON event_attendance (dept_id);
