-- Florida Roleplay — MariaDB schema.
-- Run with `npm run db:init`, which executes this file with multipleStatements.

CREATE DATABASE IF NOT EXISTS florida_rp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE florida_rp;

-- Discord-authenticated members. `id` is the Discord snowflake.
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(20)  NOT NULL,
  username      VARCHAR(64)  NOT NULL,
  display_name  VARCHAR(128) NULL,
  avatar        TEXT         NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Roles are rows rather than a column so a user can hold several at once.
CREATE TABLE IF NOT EXISTS user_roles (
  user_id     VARCHAR(20) NOT NULL,
  role        VARCHAR(32) NOT NULL,
  granted_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS departments (
  id                VARCHAR(64)  NOT NULL,
  name              VARCHAR(128) NOT NULL,
  abbr              VARCHAR(16)  NOT NULL,
  tone              VARCHAR(16)  NOT NULL DEFAULT 'brand',
  icon              VARCHAR(32)  NOT NULL DEFAULT 'Shield',
  tagline           TEXT         NULL,
  mission           TEXT         NULL,
  roster            INT          NOT NULL DEFAULT 0,
  hiring            TINYINT(1)   NOT NULL DEFAULT 1,
  ranks             JSON         NULL,
  fleet             JSON         NULL,
  application_type  VARCHAR(64)  NULL,
  sort_order        INT          NOT NULL DEFAULT 0,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS staff (
  id          VARCHAR(64)  NOT NULL,
  name        VARCHAR(128) NOT NULL,
  handle      VARCHAR(64)  NOT NULL,
  role        VARCHAR(64)  NOT NULL,
  team        VARCHAR(64)  NOT NULL,
  department  VARCHAR(64)  NULL,
  tone        VARCHAR(16)  NOT NULL DEFAULT 'primary',
  online      TINYINT(1)   NOT NULL DEFAULT 0,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rules (
  id                    VARCHAR(64)  NOT NULL,
  category_id           VARCHAR(64)  NOT NULL,
  category              VARCHAR(128) NOT NULL,
  category_description  TEXT         NULL,
  number                VARCHAR(16)  NOT NULL,
  title                 VARCHAR(255) NOT NULL,
  body                  TEXT         NOT NULL,
  sort_order            INT          NOT NULL DEFAULT 0,
  created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rules_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS patch_notes (
  id           VARCHAR(64)  NOT NULL,
  version      VARCHAR(32)  NOT NULL,
  title        VARCHAR(255) NOT NULL,
  tag          VARCHAR(32)  NOT NULL DEFAULT 'Feature',
  tone         VARCHAR(16)  NOT NULL DEFAULT 'primary',
  released_at  DATE         NOT NULL,
  changes      JSON         NOT NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_patch_notes_released (released_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS applications (
  id              INT          NOT NULL AUTO_INCREMENT,
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
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_applications_reference (reference),
  KEY idx_applications_discord_id (discord_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reports (
  id           INT         NOT NULL AUTO_INCREMENT,
  reference    VARCHAR(32) NOT NULL,
  type         VARCHAR(32) NOT NULL,
  discord_id   VARCHAR(20) NOT NULL,
  involved     TEXT        NOT NULL,
  occurred_at  VARCHAR(128) NULL,
  evidence     TEXT        NULL,
  description  TEXT        NOT NULL,
  status       VARCHAR(32) NOT NULL DEFAULT 'Pending Review',
  created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reports_reference (reference),
  KEY idx_reports_discord_id (discord_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS events (
  id           VARCHAR(64)  NOT NULL,
  title        VARCHAR(255) NOT NULL,
  event_date   DATE         NOT NULL,
  event_time   VARCHAR(32)  NULL,
  location     VARCHAR(128) NULL,
  status       VARCHAR(32)  NOT NULL DEFAULT 'Upcoming',
  attendance   INT          NOT NULL DEFAULT 0,
  description  TEXT         NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_events_date (event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS articles (
  slug          VARCHAR(64)  NOT NULL,
  title         VARCHAR(255) NOT NULL,
  category      VARCHAR(64)  NOT NULL,
  summary       TEXT         NULL,
  reading_time  VARCHAR(16)  NULL,
  body          JSON         NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (slug),
  KEY idx_articles_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS supporters (
  id          VARCHAR(64)  NOT NULL,
  name        VARCHAR(128) NOT NULL,
  tier        VARCHAR(32)  NOT NULL,
  since       DATE         NULL,
  discord_id  VARCHAR(20)  NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_supporters_tier (tier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS store_tiers (
  id          VARCHAR(64)  NOT NULL,
  name        VARCHAR(64)  NOT NULL,
  price       VARCHAR(16)  NOT NULL,
  period      VARCHAR(16)  NOT NULL DEFAULT '/month',
  tone        VARCHAR(16)  NOT NULL DEFAULT 'primary',
  popular     TINYINT(1)   NOT NULL DEFAULT 0,
  blurb       TEXT         NULL,
  features    JSON         NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Staff Hub
-- ---------------------------------------------------------------------------

-- Portal content, one row per editable section (featured, reminders,
-- quickNotes, links). JSON keeps the shapes flexible without a migration each
-- time the Director panel gains a field.
CREATE TABLE IF NOT EXISTS hub_portal (
  section     VARCHAR(32) NOT NULL,
  payload     JSON        NOT NULL,
  updated_by  VARCHAR(20) NULL,
  updated_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (section)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_hub_roster_rank (rank_id),
  KEY idx_hub_roster_discord (discord_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_hub_da_discord (discord_id),
  KEY idx_hub_da_issued (issued_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per staff exam attempt. `override_payload` caches the latest override
-- so listing attempts never needs to join the full history.
CREATE TABLE IF NOT EXISTS hub_attempts (
  attempt_id       VARCHAR(64)  NOT NULL,
  staff_name       VARCHAR(128) NOT NULL,
  discord_id       VARCHAR(20)  NULL,
  exam_type        VARCHAR(16)  NOT NULL,
  submitted_at     DATETIME     NOT NULL,
  score            VARCHAR(32)  NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'Needs Review',
  original_score   VARCHAR(32)  NULL,
  original_status  VARCHAR(32)  NULL,
  override_payload JSON         NULL,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (attempt_id),
  KEY idx_hub_attempts_discord (discord_id),
  KEY idx_hub_attempts_exam (exam_type),
  KEY idx_hub_attempts_submitted (submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Append-only: every override ever applied. Rows are never updated or deleted,
-- which is what makes the audit log trustworthy.
CREATE TABLE IF NOT EXISTS hub_overrides (
  id               INT          NOT NULL AUTO_INCREMENT,
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
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_hub_overrides_attempt (attempt_id),
  KEY idx_hub_overrides_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hub_exam_settings (
  exam_type   VARCHAR(16) NOT NULL,
  pass_score  INT         NOT NULL,
  review_min  INT         NOT NULL,
  review_max  INT         NOT NULL,
  max_score   INT         NOT NULL,
  updated_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (exam_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hub_questions (
  id               INT          NOT NULL AUTO_INCREMENT,
  exam_type        VARCHAR(16)  NOT NULL,
  question_id      VARCHAR(32)  NOT NULL,
  question_number  VARCHAR(16)  NOT NULL,
  question_text    TEXT         NOT NULL,
  question_type    VARCHAR(32)  NULL,
  points           INT          NOT NULL DEFAULT 1,
  correct_answer   TEXT         NULL,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_hub_questions_qid (question_id),
  KEY idx_hub_questions_exam (exam_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  is_primary    TINYINT(1)   NOT NULL DEFAULT 0,
  joined_at     DATE         NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_civ_characters_discord (discord_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  insured           TINYINT(1)   NOT NULL DEFAULT 0,
  registered_until  DATE         NULL,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_civ_vehicles_plate (plate),
  KEY idx_civ_vehicles_owner (owner_character)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_civ_properties_owner (owner_character)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_civ_licences_number (licence_number),
  KEY idx_civ_licences_holder (holder_character)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS civ_businesses (
  id          VARCHAR(64)  NOT NULL,
  name        VARCHAR(128) NOT NULL,
  category    VARCHAR(64)  NULL,
  owner_name  VARCHAR(128) NULL,
  district    VARCHAR(64)  NULL,
  phone       VARCHAR(32)  NULL,
  hiring      TINYINT(1)   NOT NULL DEFAULT 0,
  blurb       TEXT         NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_civ_businesses_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_civ_jobs_posted (posted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS civ_classifieds (
  id           VARCHAR(64)  NOT NULL,
  title        VARCHAR(128) NOT NULL,
  category     VARCHAR(64)  NULL,
  price        VARCHAR(64)  NULL,
  seller_name  VARCHAR(128) NULL,
  phone        VARCHAR(32)  NULL,
  posted_at    DATE         NULL,
  blurb        TEXT         NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_civ_classifieds_posted (posted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS civ_penal_code (
  code        VARCHAR(16)  NOT NULL,
  title       VARCHAR(128) NOT NULL,
  degree      VARCHAR(32)  NOT NULL,
  fine        VARCHAR(32)  NULL,
  jail_time   VARCHAR(32)  NULL,
  points      INT          NOT NULL DEFAULT 0,
  notes       TEXT         NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (code),
  KEY idx_civ_penal_degree (degree)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Community roster (written by the Discord bot)
-- ---------------------------------------------------------------------------

-- One row per member holding a mapped Discord role. `discord_id` is unique
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
  synced_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source          VARCHAR(32)  NOT NULL DEFAULT 'discord-sync',
  PRIMARY KEY (id),
  UNIQUE KEY uq_roster_discord (discord_id),
  KEY idx_roster_department (department),
  KEY idx_roster_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id),
  UNIQUE KEY uq_roster_role_key (role_key),
  KEY idx_roster_role_department (department),
  KEY idx_roster_role_kind (kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Append-only record of what the bot changed, so a wrong rank can be traced.
CREATE TABLE IF NOT EXISTS roster_sync_log (
  id              INT          NOT NULL AUTO_INCREMENT,
  discord_id      VARCHAR(20)  NULL,
  character_name  VARCHAR(128) NULL,
  action          VARCHAR(32)  NOT NULL,
  detail          TEXT         NULL,
  actor           VARCHAR(64)  NOT NULL DEFAULT 'roster-bot',
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_roster_log_discord (discord_id),
  KEY idx_roster_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Permission grants (edited from the Permissions page)
-- ---------------------------------------------------------------------------

-- One row per (permission, Discord role) pair. An empty table means the shipped
-- defaults apply, so a fresh install is neither wide open nor locked out.
CREATE TABLE IF NOT EXISTS permission_grants (
  permission_key  VARCHAR(64) NOT NULL,
  role_key        VARCHAR(64) NOT NULL,
  granted_by      VARCHAR(20) NULL,
  granted_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (permission_key, role_key),
  KEY idx_permission_grants_role (role_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- LOA is stored on the roster row: the return date lives here rather than in the
-- bot, so a restart or redeploy cannot lose a pending return.
ALTER TABLE roster_members
  ADD COLUMN IF NOT EXISTS loa_until  DATE NULL,
  ADD COLUMN IF NOT EXISTS loa_reason TEXT NULL;

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
  config      JSON        NOT NULL,
  updated_by  VARCHAR(20) NULL,
  created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The config each save replaced, so a department that breaks its own site can
-- restore the previous version from the Builder Portal instead of filing a
-- ticket. Trimmed to the newest 50 per department on every write — Builder
-- sessions auto-save far more often than anyone reads back.
CREATE TABLE IF NOT EXISTS department_config_versions (
  id             INT          NOT NULL AUTO_INCREMENT,
  department_id  VARCHAR(64)  NOT NULL,
  config         JSON         NOT NULL,
  label          VARCHAR(160) NULL,
  actor          VARCHAR(20)  NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_dept_versions_dept (department_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Append-only record of who changed what on a department site.
CREATE TABLE IF NOT EXISTS department_audit_log (
  id             INT          NOT NULL AUTO_INCREMENT,
  department_id  VARCHAR(64)  NOT NULL,
  actor          VARCHAR(20)  NULL,
  actor_name     VARCHAR(128) NULL,
  action         VARCHAR(64)  NOT NULL,
  summary        VARCHAR(512) NULL,
  at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_dept_audit_dept (department_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  ADD COLUMN IF NOT EXISTS online        TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes         TEXT         NULL,
  ADD COLUMN IF NOT EXISTS vacant        TINYINT(1)   NOT NULL DEFAULT 0;

-- Who is on probation and which administrator is signing off on them. Read
-- beside the staff roster but kept apart from it: it is a different list, and a
-- join would make every roster read carry it.
CREATE TABLE IF NOT EXISTS hub_training (
  id          VARCHAR(32)  NOT NULL,
  trainee     VARCHAR(128) NOT NULL,
  admin_name  VARCHAR(128) NOT NULL,
  since       DATE         NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Forms and exams
-- ---------------------------------------------------------------------------

-- One row per form. The whole document — questions, answer key, thresholds and
-- who may take or review it — is JSON, so adding a question type needs no
-- migration. An empty table means the seeds in server/src/formsSeed.js apply.
CREATE TABLE IF NOT EXISTS forms (
  id          VARCHAR(64) NOT NULL,
  audience    VARCHAR(16) NOT NULL DEFAULT 'staff',
  document    JSON        NOT NULL,
  updated_by  VARCHAR(20) NULL,
  created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_forms_audience (audience)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Answers only. The score is never stored: it is computed from the form on
-- every read, so correcting an answer key re-grades the whole history instead
-- of leaving old results wrong. subject_name is NULL for an anonymous form —
-- the identity is not recorded rather than recorded and hidden.
CREATE TABLE IF NOT EXISTS form_submissions (
  id                  VARCHAR(64)  NOT NULL,
  form_id             VARCHAR(64)  NOT NULL,
  subject_name        VARCHAR(128) NULL,
  subject_discord_id  VARCHAR(20)  NULL,
  answers             JSON         NOT NULL,
  submitted_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_form_submissions_form (form_id, submitted_at),
  KEY idx_form_submissions_discord (subject_discord_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A reviewer's score for one written answer, kept apart from the submission so
-- the original auto-grade is never overwritten — the machine's result and the
-- human's adjustment to it are two different facts.
CREATE TABLE IF NOT EXISTS form_reviews (
  submission_id  VARCHAR(64) NOT NULL,
  question_id    VARCHAR(64) NOT NULL,
  awarded        INT         NOT NULL DEFAULT 0,
  reviewer       VARCHAR(20) NULL,
  reviewed_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (submission_id, question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  opens_at            DATETIME     NOT NULL,
  closes_at           DATETIME     NOT NULL,
  published           TINYINT(1)   NOT NULL DEFAULT 0,
  published_at        TIMESTAMP    NULL,
  cancelled           TINYINT(1)   NOT NULL DEFAULT 0,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_promotion_votes_closes (closes_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One ballot per voter per vote, so changing your mind updates rather than
-- appends. Ballots are their own table because voting is the concurrent
-- operation here — two people voting at once on a single JSON document would
-- lose one of them.
CREATE TABLE IF NOT EXISTS promotion_ballots (
  vote_id           VARCHAR(64)  NOT NULL,
  voter_discord_id  VARCHAR(20)  NOT NULL,
  voter_name        VARCHAR(128) NULL,
  choice            VARCHAR(16)  NOT NULL,
  reason            VARCHAR(512) NULL,
  cast_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (vote_id, voter_discord_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Board settings, currently just the live-result visibility rules.
CREATE TABLE IF NOT EXISTS promotion_settings (
  name        VARCHAR(64) NOT NULL,
  value       JSON        NOT NULL,
  updated_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
