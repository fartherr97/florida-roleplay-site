import { useEffect, useState } from "react";
import { Loader2, Receipt } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { api, loginUrl } from "../../lib/api";
import { useAuth } from "../../context/useAuth";

function formatPrice(amount, currency) {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(Number(amount));
  } catch {
    return `${currency || "USD"} ${Number(amount).toFixed(2)}`;
  }
}

const PAYMENT_TONE = {
  completed: "green",
  pending: "amber",
  refunded: "slate",
  chargeback: "rose",
  revoked: "rose",
};

const FULFILLMENT_LABEL = {
  fulfilled: "Perks granted",
  pending: "Awaiting payment",
  partial: "Partly granted",
  failed: "Grant failed",
  revoked: "Revoked",
  none: "No perks",
};

/**
 * A player's own store purchases and the state of each — what they bought, when,
 * what they paid, whether the payment cleared, and whether their perks are live.
 * No admin or payment-sensitive detail; just the buyer's own record.
 */
export default function AccountPurchases() {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState({ status: "loading", purchases: [] });

  useEffect(() => {
    if (authLoading) return undefined;
    if (!user) {
      setState({ status: "signed-out", purchases: [] });
      return undefined;
    }
    let active = true;
    api
      .storeMyPurchases()
      .then((data) => active && setState({ status: "ready", purchases: data?.purchases ?? [] }))
      .catch(() => active && setState({ status: "ready", purchases: [] }));
    return () => {
      active = false;
    };
  }, [user, authLoading]);

  return (
    <Section>
      <PageHeader eyebrow="Your account" title="Purchases" subtitle="Everything you've bought from the store, and whether your perks are active." />

      {(state.status === "loading" || authLoading) && (
        <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
          <Loader2 className="size-5 animate-spin" /> Loading your purchases…
        </div>
      )}

      {state.status === "signed-out" && (
        <Card className="mx-auto max-w-lg p-10 text-center">
          <Receipt className="mx-auto size-9 text-slate-500" />
          <h2 className="mt-4 text-lg font-bold text-white">Sign in to see your purchases</h2>
          <p className="mt-2 text-sm text-slate-400">Your store history is tied to your Discord account.</p>
          <Button as="a" href={loginUrl("/account/purchases")} className="mt-6">
            Sign in with Discord
          </Button>
        </Card>
      )}

      {state.status === "ready" && state.purchases.length === 0 && (
        <Card className="mx-auto max-w-lg p-10 text-center">
          <Receipt className="mx-auto size-9 text-slate-500" />
          <h2 className="mt-4 text-lg font-bold text-white">No purchases yet</h2>
          <p className="mt-2 text-sm text-slate-400">When you buy a package from the store, it'll show up here.</p>
          <Button as="a" href="/store" variant="secondary" className="mt-6">
            Browse the store
          </Button>
        </Card>
      )}

      {state.status === "ready" && state.purchases.length > 0 && (
        <div className="space-y-3">
          {state.purchases.map((p) => (
            <Card key={p.id} className="flex flex-wrap items-center gap-4 p-5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">{p.packageName || "Package"}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {p.createdAt ? new Date(p.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—"}
                  {p.isSubscription && " · Subscription"}
                </p>
              </div>
              <span className="text-sm font-semibold text-white">{formatPrice(p.amount, p.currency)}</span>
              <Badge tone={PAYMENT_TONE[p.paymentStatus] ?? "slate"} className="capitalize">
                {p.paymentStatus}
              </Badge>
              <span className="text-xs text-slate-400">{FULFILLMENT_LABEL[p.fulfillmentStatus] ?? p.fulfillmentStatus}</span>
            </Card>
          ))}
        </div>
      )}
    </Section>
  );
}
