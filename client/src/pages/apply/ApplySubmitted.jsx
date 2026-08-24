import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import Section from "../../components/layout/Section";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import CopyField from "../../components/ui/CopyField";
import { SITE } from "../../data/mockData";

/**
 * The confirmation.
 *
 * Reached only by navigating from a submission that actually succeeded — the
 * reference arrives in router state, and without one this redirects rather than
 * rendering a receipt for something that never happened. A page anybody can open
 * that says "your application is in" is a page that lies.
 */
export default function ApplySubmitted() {
  const { slug } = useParams();
  const { state } = useLocation();

  if (!state?.reference) return <Navigate to={`/apply/${slug}`} replace />;

  return (
    <Section className="max-w-2xl">
      <Card className="p-8 text-center sm:p-10">
        <CheckCircle2 className="mx-auto size-12 text-emerald-400" />
        <h1 className="mt-5 text-2xl font-black tracking-tight text-white sm:text-3xl">
          That is submitted
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
          {state.message}
        </p>

        <div className="mx-auto mt-7 max-w-xs text-left">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            Your reference
          </p>
          <CopyField value={state.reference} />
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Quote this if you ask about it in Discord. It is the only thing that
            identifies your application to command staff.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button as="a" href={SITE.discordInvite} target="_blank" rel="noreferrer noopener" variant="discord">
            Open Discord
          </Button>
          <Button as={Link} to="/apply" variant="secondary">
            Other applications
          </Button>
        </div>
      </Card>
    </Section>
  );
}
