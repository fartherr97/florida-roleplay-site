import { createElement } from "react";
import { MessageSquare } from "lucide-react";
import { buildEmbed, fieldVisible } from "../../lib/applicationConfig";
import { ROLE_MAP } from "../../data/rosterData";

const ROLE_NAMES = Object.fromEntries(
  ROLE_MAP.filter((r) => r.roleId).map((r) => [String(r.roleId), r.rankFull || r.rank]),
);

/**
 * What Discord will actually receive, drawn as Discord draws it.
 *
 * Built from the same `buildEmbed` the server queues for the bot, with a sample
 * answer per field — so the thing a department signs off on in the builder is
 * the payload, not a mock-up of it. If a question is too long for an embed field
 * the truncation shows up here, because the truncation happens in buildEmbed.
 *
 * The Approve and Deny buttons are drawn as Discord will render them, and they
 * are inert here for the reason they have to exist there: only a bot
 * application can carry an interactive component, and only it receives the click.
 */
export default function EmbedPreview({ application, className }) {
  const sample = sampleSubmission(application);
  const payload = buildEmbed(application, sample);
  const embed = payload.embeds[0];
  const color = `#${(embed.color ?? 0).toString(16).padStart(6, "0")}`;

  return (
    <div className={className}>
      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
        {createElement(MessageSquare, { className: "size-3.5" })}
        In Discord
      </p>

      <div className="rounded-2xl bg-[#313338] p-4 ring-1 ring-inset ring-black/40">
        {payload.content ? (
          <p className="mb-2 text-sm text-[#dbdee1]">
            {application.discord.pingRoleIds.map((id) => (
              <span key={id} className="mr-1 rounded bg-[#3d4270] px-1 py-0.5 text-[#c9cdfb]">
                @{ROLE_NAMES[id] ?? id}
              </span>
            ))}
          </p>
        ) : (
          <p className="mb-2 text-xs italic text-[#949ba4]">No roles pinged.</p>
        )}

        <div className="overflow-hidden rounded-[4px] bg-[#2b2d31]" style={{ borderLeft: `4px solid ${color}` }}>
          <div className="space-y-2 p-4">
            <p className="text-base font-semibold text-white">{embed.title}</p>
            <div className="space-y-0.5 text-sm leading-relaxed text-[#dbdee1]">
              <DiscordText text={embed.description} />
            </div>

            {embed.fields.length > 0 && (
              <div className="grid gap-3 pt-1 sm:grid-cols-2">
                {embed.fields.map((field, index) => (
                  <div key={`${field.name}-${index}`} className={field.inline ? "" : "sm:col-span-2"}>
                    <p className="text-xs font-bold text-white">{field.name}</p>
                    <div className="break-words text-sm text-[#dbdee1]">
                      <DiscordText text={field.value} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="pt-1 text-[0.7rem] text-[#949ba4]">{embed.footer.text}</p>
          </div>
        </div>

        {payload.components.length > 0 && (
          <div className="mt-2 flex gap-2">
            <span className="rounded bg-[#248046] px-4 py-2 text-sm font-medium text-white">Approve</span>
            <span className="rounded bg-[#da373c] px-4 py-2 text-sm font-medium text-white">Deny</span>
          </div>
        )}
      </div>

      {!application.discord.channelId && (
        <p className="mt-2 text-xs text-amber-300">
          No channel is set, so this has nowhere to be posted.
        </p>
      )}
    </div>
  );
}


/**
 * The subset of Discord's markdown these payloads actually use: bold, inline
 * code, blockquotes, user mentions and role mentions. Rendering it matters —
 * a preview that prints `**Applicant**` and a raw snowflake is showing the wire
 * format, not the message, and the message is the point of the preview.
 */
function DiscordText({ text }) {
  return (
    <>
      {String(text ?? "").split("\n").map((line, lineIndex) => {
        const quote = line.startsWith("> ");
        const body = quote ? line.slice(2) : line;
        return (
          <span
            key={lineIndex}
            className={quote ? "block border-l-4 border-[#4e5058] pl-3 text-[#b5bac1]" : "block"}
          >
            {tokenise(body).map((token, i) => {
              if (token.kind === "bold") {
                return <strong key={i} className="font-semibold text-white">{token.value}</strong>;
              }
              if (token.kind === "code") {
                return (
                  <code key={i} className="rounded bg-[#1e1f22] px-1 py-0.5 font-mono text-[0.85em]">
                    {token.value}
                  </code>
                );
              }
              if (token.kind === "user" || token.kind === "role") {
                const name = token.kind === "role" ? ROLE_NAMES[token.value] ?? token.value : token.value;
                return (
                  <span key={i} className="rounded bg-[#3d4270] px-1 py-0.5 text-[#c9cdfb]">
                    @{name}
                  </span>
                );
              }
              return <span key={i}>{token.value}</span>;
            })}
          </span>
        );
      })}
    </>
  );
}

/** One pass, with `<@&id>` ahead of `<@id>` so a role never matches as a user. */
function tokenise(line) {
  const pattern = /\*\*(.+?)\*\*|`([^`]+)`|<@&(\d+)>|<@!?(\d+)>/g;
  const tokens = [];
  let last = 0;
  let match;
  while ((match = pattern.exec(line)) !== null) {
    if (match.index > last) tokens.push({ kind: "text", value: line.slice(last, match.index) });
    if (match[1] != null) tokens.push({ kind: "bold", value: match[1] });
    else if (match[2] != null) tokens.push({ kind: "code", value: match[2] });
    else if (match[3] != null) tokens.push({ kind: "role", value: match[3] });
    else tokens.push({ kind: "user", value: match[4] });
    last = pattern.lastIndex;
  }
  if (last < line.length) tokens.push({ kind: "text", value: line.slice(last) });
  return tokens;
}

/**
 * A stand-in answer per field, so the preview is full rather than a list of
 * empty questions. Keyed off the field type, and deterministic — a preview that
 * reshuffles on every keystroke is a preview nobody can read.
 */
function sampleSubmission(application) {
  const answers = {};
  for (const section of application.sections ?? []) {
    for (const field of section.fields ?? []) {
      // A real submission only carries one side of a conditional branch, so the
      // preview must too — otherwise it shows an embed that can never happen.
      if (!fieldVisible(field, answers)) continue;
      switch (field.type) {
        case "heading":
        case "statement":
          break;
        case "multiple":
        case "dropdown":
          answers[field.id] = field.options?.[0] ?? "";
          break;
        case "checkboxes":
        case "availability":
          answers[field.id] = (field.options ?? []).slice(0, 2);
          break;
        case "agree":
          answers[field.id] = true;
          break;
        case "scale":
          answers[field.id] = Math.round(((field.min ?? 1) + (field.max ?? 5)) / 2);
          break;
        case "number":
          answers[field.id] = field.min ?? 1;
          break;
        case "age":
          answers[field.id] = Math.max(18, field.min ?? 18);
          break;
        case "date":
          answers[field.id] = "2026-04-01";
          break;
        case "time":
          answers[field.id] = "20:00";
          break;
        case "discord":
          answers[field.id] = "930000000000000002";
          break;
        case "steam":
          answers[field.id] = "steam:110000112345678";
          break;
        case "email":
          answers[field.id] = "applicant@example.com";
          break;
        case "url":
          answers[field.id] = "https://example.com/clip";
          break;
        case "paragraph":
          answers[field.id] = "A sample answer, so the layout shows the way a real one will.";
          break;
        default:
          answers[field.id] = "Sample answer";
      }
    }
  }
  return {
    reference: "APP-260401-A1B",
    applicantName: "Sample Applicant",
    applicantDiscordId: "930000000000000002",
    answers,
    status: "pending",
    submittedAt: "2026-04-01T20:00:00.000Z",
  };
}
