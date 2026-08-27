import Section from "../../components/layout/Section";
import AccessDenied from "../../components/auth/AccessDenied";
import HubRoster from "../hub/HubRoster";
import { useAuth } from "../../context/useAuth";
import { SITE } from "../../data/mockData";

/**
 * The dev team roster — the staff roster, projected from the bot, pointed at the
 * community's development roster and tinted violet. The dev ranks (Development
 * Director, Assistant Development Director, Lead / Senior / Developer) live in
 * the bot dashboard the same way staff ranks do, so this reads whoever holds one
 * rather than a second list typed here.
 */
export default function DevRoster() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <AccessDenied reason="signed-out" />;

  return (
    <Section className="max-w-7xl">
      <HubRoster
        slugs={["development", "dev", "developer", "dev-team", "dev_team", "development-team"]}
        nameMatch={/dev/i}
        fallbackToFirst={false}
        title={`${SITE.name} · Dev Team Roster`}
        label="dev team roster"
        accent={{ callsign: "text-violet-300", position: "text-violet-300" }}
      />
    </Section>
  );
}
