import Badge from "../ui/Badge";

/** Maps an exam result status onto the shared Badge tones. */
const TONES = {
  Pass: "green",
  "Needs Review": "amber",
  Fail: "rose",
};

export default function ExamStatusBadge({ status }) {
  return (
    <Badge tone={TONES[status] ?? "slate"} dot>
      {status || "No Score"}
    </Badge>
  );
}
