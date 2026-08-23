/**
 * Request body validation. Client-side checks are a convenience only — every
 * POST is re-validated here before anything reaches the database.
 */

/** Discord snowflakes are 17–20 digits. */
const DISCORD_ID = /^\d{17,20}$/;

export function isDiscordId(value) {
  return typeof value === "string" && DISCORD_ID.test(value.trim());
}

/** Returns the trimmed string, or "" for anything that is not a string. */
export function str(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Runs a list of [condition, message] pairs and collects the failures, so a
 * caller gets every problem at once rather than one per round trip.
 */
export function collect(checks) {
  return checks.filter(([ok]) => !ok).map(([, message]) => message);
}

export function validateApplication(body) {
  const type = str(body.type);
  const discordId = str(body.discordId);
  const discordName = str(body.discordName);
  const characterName = str(body.characterName);
  const backstory = str(body.backstory);
  const scenario = str(body.scenario);

  const errors = collect([
    [type.length > 0 && type.length <= 64, "An application type is required."],
    [isDiscordId(discordId), "A valid 17–20 digit Discord user ID is required."],
    [discordName.length >= 2 && discordName.length <= 64, "Discord username must be 2–64 characters."],
    [str(body.age).length <= 32, "Age range is too long."],
    [str(body.experience).length <= 32, "Experience value is too long."],
    [characterName.length >= 3 && characterName.length <= 128, "Character name must be 3–128 characters."],
    [backstory.length >= 120 && backstory.length <= 5000, "Backstory must be 120–5000 characters."],
    [scenario.length >= 120 && scenario.length <= 5000, "Scenario response must be 120–5000 characters."],
    [body.agreed === true, "You must confirm you have read the rules."],
  ]);

  return {
    errors,
    value: {
      type,
      discordId,
      discordName,
      age: str(body.age),
      experience: str(body.experience),
      characterName,
      backstory,
      scenario,
    },
  };
}

export function validateReport(body) {
  const type = str(body.type);
  const discordId = str(body.discordId);
  const involved = str(body.involved);
  const description = str(body.description);

  const errors = collect([
    [type.length > 0 && type.length <= 32, "A report type is required."],
    [isDiscordId(discordId), "A valid 17–20 digit Discord user ID is required."],
    [involved.length >= 2 && involved.length <= 512, "Name at least one person involved (max 512 characters)."],
    [str(body.occurredAt).length <= 128, "The time field is too long."],
    [str(body.evidence).length <= 2000, "Evidence links must be under 2000 characters."],
    [description.length >= 60 && description.length <= 5000, "Description must be 60–5000 characters."],
  ]);

  return {
    errors,
    value: {
      type,
      discordId,
      involved,
      occurredAt: str(body.occurredAt),
      evidence: str(body.evidence),
      description,
    },
  };
}

export function validateAssistantMessage(body) {
  const message = str(body.message);
  const errors = collect([
    [message.length > 0 && message.length <= 1000, "Message must be 1–1000 characters."],
  ]);
  return { errors, value: { message } };
}
