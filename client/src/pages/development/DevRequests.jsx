import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Wrench } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import AccessDenied from "../../components/auth/AccessDenied";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { DEFAULT_REQUEST_TYPES } from "../../lib/devhub";
import { DevRequestRow } from "./DevHome";

/** A member's own development requests. */
export default function DevRequests() {
  const { user, loading } = useAuth();
  const [data, setData] = useState(null);
  const [types, setTypes] = useState(DEFAULT_REQUEST_TYPES);

  useEffect(() => {
    let active = true;
    api.devRequests("mine").then((r) => active && setData(r)).catch(() => active && setData({ requests: [] }));
    api.devRequestTypes().then((r) => active && r?.types?.length && setTypes(r.types)).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const typeMap = useMemo(() => Object.fromEntries(types.map((t) => [t.id, t])), [types]);

  if (loading) return null;
  if (!user) return <AccessDenied reason="signed-out" />;

  const requests = data?.requests ?? [];

  return (
    <Section className="max-w-4xl">
      <PageHeader
        eyebrow="Development"
        title="My requests"
        subtitle="Everything you've opened, newest first."
        actions={
          <Button as={Link} to="/development/new" size="sm">
            <Plus className="size-4" />
            Create request
          </Button>
        }
      />

      {data === null ? (
        <div className="space-y-3">{[0, 1, 2].map((n) => <div key={n} className="h-16 animate-pulse rounded-2xl bg-white/[0.03]" />)}</div>
      ) : requests.length === 0 ? (
        <Card className="p-10 text-center">
          <Wrench className="mx-auto size-6 text-slate-500" />
          <p className="mt-2 text-sm font-semibold text-white">No requests yet.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">Open one for a personal vehicle, a livery or a build.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <DevRequestRow key={request.id} request={request} typeMap={typeMap} />
          ))}
        </div>
      )}
    </Section>
  );
}
