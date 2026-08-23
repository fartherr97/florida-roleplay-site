import FormsCenter from "../../components/forms/FormsCenter";

/**
 * The Staff Hub's forms and exams — promotion exams and the team feedback form.
 * The engine and every screen behind this are shared with the Civilian Hub; only
 * the audience differs.
 */
export default function HubForms() {
  return (
    <FormsCenter
      audience="staff"
      eyebrow="Staff Hub"
      title="Forms & Exams"
      subtitle="Promotion exams, assessments and the team feedback form. What you can open depends on the Discord roles you hold."
    />
  );
}
