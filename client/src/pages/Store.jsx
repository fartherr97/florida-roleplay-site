import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, ExternalLink, Loader2, ShoppingCart, Store as StoreIcon, XCircle } from "lucide-react";
import Section from "../components/layout/Section";
import PageHeader from "../components/layout/PageHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { api, loginUrl } from "../lib/api";
import { useAuth } from "../context/useAuth";
import { SITE } from "../data/mockData";
import { cn } from "../lib/cn";

/** A price like `$5.00`, or "Free" when Tebex reports nothing to pay. */
function formatPrice(amount, currency) {
  if (amount == null) return null;
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return "Free";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(n);
  } catch {
    return `${currency || "USD"} ${n.toFixed(2)}`;
  }
}

/**
 * The player-facing storefront. Packages, prices and images come from Tebex via
 * our own API; buying one creates a Tebex basket server-side and sends the
 * browser to Tebex's hosted checkout. Nothing is charged or granted here — a
 * purchase is confirmed only by Tebex's webhook.
 */
export default function Store() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState({ status: "loading", configured: false, packages: [], storeUrl: "" });
  const [buying, setBuying] = useState(null);
  const [buyError, setBuyError] = useState("");

  const returnStatus = params.get("status");

  useEffect(() => {
    let active = true;
    api
      .storePackages()
      .then((data) => {
        if (!active) return;
        setState({
          status: "ready",
          configured: Boolean(data?.configured),
          packages: Array.isArray(data?.packages) ? data.packages : [],
          storeUrl: data?.storeUrl || SITE.storeUrl,
        });
      })
      .catch(() => active && setState((s) => ({ ...s, status: "error" })));
    return () => {
      active = false;
    };
  }, []);

  // Group into featured + category sections, preserving server sort order.
  const { featured, sections } = useMemo(() => {
    const feat = state.packages.filter((p) => p.featured);
    const groups = new Map();
    for (const pkg of state.packages) {
      const key = pkg.category?.trim() || "Packages";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(pkg);
    }
    return { featured: feat, sections: [...groups.entries()].map(([name, items]) => ({ name, items })) };
  }, [state.packages]);

  async function buy(pkg) {
    setBuyError("");
    if (!user) {
      window.location.assign(loginUrl(`/store`));
      return;
    }
    setBuying(pkg.tebexPackageId);
    try {
      const res = await api.storeCheckout(pkg.tebexPackageId);
      if (res?.checkoutUrl) {
        window.location.assign(res.checkoutUrl);
        return;
      }
      setBuyError(res?.message || "Couldn't start checkout. Please try again shortly.");
    } catch (err) {
      setBuyError(err?.message || "Couldn't start checkout. Please try again shortly.");
    } finally {
      setBuying(null);
    }
  }

  return (
    <Section>
      <PageHeader
        eyebrow="Support the server"
        title="Store"
        subtitle="Supporter packages cover our hosting and asset licensing. Everything they unlock is quality-of-life — nothing affects in-character balance. Payments are handled securely by Tebex."
      />

      {returnStatus === "complete" && (
        <Banner
          tone="emerald"
          icon={CheckCircle2}
          title="Thanks for your purchase!"
          body="Your payment is being confirmed by Tebex. Perks are granted automatically once it clears — usually within a minute. You can track it under your purchases."
          onDismiss={() => setParams({}, { replace: true })}
        />
      )}
      {returnStatus === "cancel" && (
        <Banner
          tone="amber"
          icon={XCircle}
          title="Checkout cancelled"
          body="No payment was taken. You can pick a package again whenever you're ready."
          onDismiss={() => setParams({}, { replace: true })}
        />
      )}
      {buyError && (
        <Banner tone="rose" icon={XCircle} title="Checkout error" body={buyError} onDismiss={() => setBuyError("")} />
      )}

      {state.status === "loading" && (
        <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
          <Loader2 className="size-5 animate-spin" /> Loading the store…
        </div>
      )}

      {state.status === "error" && (
        <EmptyState
          icon={XCircle}
          title="The store is having a moment"
          body="We couldn't load packages right now. Please refresh in a little while."
          storeUrl={state.storeUrl}
        />
      )}

      {state.status === "ready" && state.packages.length === 0 && (
        <EmptyState
          icon={StoreIcon}
          title="The store is being set up"
          body={
            state.configured
              ? "No packages are published yet. Check back soon — they're on the way."
              : "Our storefront isn't live here yet. In the meantime you can visit our Tebex store directly."
          }
          storeUrl={state.storeUrl}
        />
      )}

      {state.status === "ready" && state.packages.length > 0 && (
        <div className="space-y-12">
          {featured.length > 0 && (
            <div>
              <SectionHeading>Featured</SectionHeading>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {featured.map((pkg) => (
                  <PackageCard key={pkg.tebexPackageId} pkg={pkg} onBuy={buy} buying={buying} highlight />
                ))}
              </div>
            </div>
          )}

          {sections.map((section) => (
            <div key={section.name}>
              <SectionHeading>{section.name}</SectionHeading>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {section.items.map((pkg) => (
                  <PackageCard key={pkg.tebexPackageId} pkg={pkg} onBuy={buy} buying={buying} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-10 text-center text-xs text-slate-500">
        Payments are processed by Tebex, our authorized payment partner. Subscriptions can be cancelled anytime and
        perks stay active until the end of the paid period.
      </p>
    </Section>
  );
}

function SectionHeading({ children }) {
  return <h2 className="mb-5 text-lg font-bold tracking-tight text-white">{children}</h2>;
}

function PackageCard({ pkg, onBuy, buying, highlight }) {
  const price = formatPrice(pkg.price, pkg.currency);
  const isBuying = buying === pkg.tebexPackageId;
  return (
    <Card
      hover
      className={cn("flex flex-col overflow-hidden p-0", highlight && "ring-1 ring-inset ring-primary-400/40")}
    >
      {pkg.imageUrl ? (
        <div className="aspect-[16/9] w-full overflow-hidden bg-white/5">
          <img src={pkg.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
        </div>
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-primary-500/15 to-white/5">
          <ShoppingCart className="size-9 text-primary-300/70" />
        </div>
      )}

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-white">{pkg.name}</h3>
          {highlight && <Badge tone="primary">Featured</Badge>}
        </div>

        {price && (
          <p className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-extrabold tracking-tight text-white">{price}</span>
            {pkg.isSubscription && <span className="text-sm text-slate-500">/ month</span>}
          </p>
        )}

        {pkg.shortDescription && (
          <p className="mt-3 text-sm leading-relaxed text-slate-400">{pkg.shortDescription}</p>
        )}

        <div className="mt-7 flex-1" />

        <Button variant={highlight ? "primary" : "secondary"} block disabled={isBuying} onClick={() => onBuy(pkg)}>
          {isBuying ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Starting checkout…
            </>
          ) : (
            <>
              Buy now
              <ExternalLink className="size-4" />
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, body, storeUrl }) {
  return (
    <Card className="mx-auto max-w-xl p-10 text-center">
      <Icon className="mx-auto size-9 text-slate-500" />
      <h2 className="mt-4 text-lg font-bold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
      {storeUrl && (
        <Button as="a" href={storeUrl} target="_blank" rel="noreferrer noopener" variant="secondary" className="mt-6">
          Visit our Tebex store
          <ExternalLink className="size-4" />
        </Button>
      )}
    </Card>
  );
}

const BANNER_TONES = {
  emerald: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  amber: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  rose: "border-rose-400/30 bg-rose-500/10 text-rose-200",
};

function Banner({ tone, icon: Icon, title, body, onDismiss }) {
  return (
    <div className={cn("mb-8 flex items-start gap-3 rounded-2xl border px-5 py-4", BANNER_TONES[tone])}>
      <Icon className="mt-0.5 size-5 shrink-0" />
      <div className="flex-1">
        <p className="font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm text-slate-300">{body}</p>
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-xs text-slate-400 hover:text-white">
          Dismiss
        </button>
      )}
    </div>
  );
}
