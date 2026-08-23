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
