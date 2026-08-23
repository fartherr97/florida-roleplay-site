import FormsCenter from "../../components/forms/FormsCenter";

/**
 * The Civilian Hub's forms — the whitelist knowledge check, certification
 * assessments and the community feedback form.
 */
export default function CivForms() {
  return (
    <FormsCenter
      audience="civilian"
      eyebrow="Civilian Hub"
      title="Forms & Assessments"
      subtitle="Whitelist and certification assessments, plus the community feedback form. Everything here is open to any signed-in member unless it says otherwise."
    />
  );
}
