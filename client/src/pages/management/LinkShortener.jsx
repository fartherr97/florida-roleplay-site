import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Globe, Link2, Pencil, Plus, Power, Trash2, X } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import Badge from "../../components/ui/Badge";
import CopyField from "../../components/ui/CopyField";
import { TextInput } from "../../components/ui/TextInput";
import { useAuth } from "../../context/useAuth";
import { api } from "../../lib/api";

/**
 * The community URL shortener.
 *
 * Paste a long URL, pick a set-up subdomain, optionally set a custom slug, and
 * get a short link back. Everything here is gated by shortener.use (Department
 * Heads, dev leadership, Directorship and Ownership); adding the subdomains
 * links live on is Ownership-only (shortener.admin). The redirect itself is
 * served by the API host, so a bare short link resolves without loading the app.
 */
/**
 * Normalise a slug as it's typed: lowercase, and every run of anything that
 * isn't a letter or digit becomes a single dash — so "Training Document" and
 * "Training_document" both head toward "training-document". A trailing dash is
 * left in place so multi-word slugs can still be typed; the server trims the
 * edges to the canonical form on save.
 */
function cleanSlug(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80);
}

export default function LinkShortener() {
  const { hasPermission } = useAuth();
  const canAdmin = hasPermission("shortener.admin");

  const [links, setLinks] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.links().then((res) => {
      if (!active) return;
      setLinks(res?.links ?? []);
      setDomains(res?.domains ?? []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
  const activeDomains = useMemo(() => domains.filter((d) => d.active), [domains]);

  return (
    <Section innerClassName="max-w-5xl">
      <PageHeader
        eyebrow="Emergency Services"
        title="Link Shortener"
        subtitle="Turn a long URL into a short, on-brand link on one of our subdomains. Short links redirect instantly for anyone who opens them."
        backTo="/"
        backLabel="Home"
      />

      {(notice || error) && (
        <p
          className={`mb-5 rounded-xl px-4 py-3 text-sm ring-1 ring-inset ${
            error
              ? "bg-rose-500/10 text-rose-300 ring-rose-400/25"
              : "bg-emerald-500/10 text-emerald-200 ring-emerald-400/25"
          }`}
        >
          {error || notice}
        </p>
      )}

      {activeDomains.length === 0 && !loading && (
        <Card className="mb-6 p-5">
          <p className="text-sm text-slate-300">
            No subdomains are set up yet, so links can't be created.{" "}
            {canAdmin
              ? "Add one below to get started."
              : "Ask an Owner to add one in the Subdomains section."}
          </p>
        </Card>
      )}

      <CreateLink
        domains={activeDomains}
        onDone={(msg) => {
          setError("");
          setNotice(msg);
          refresh();
        }}
        onError={(msg) => {
          setNotice("");
          setError(msg);
        }}
      />

      <LinkTable
        links={links}
        loading={loading}
        onEdit={setEditing}
        onChanged={(msg) => {
          setError("");
          setNotice(msg);
          refresh();
        }}
        onError={(msg) => {
          setNotice("");
          setError(msg);
        }}
      />

      {canAdmin && (
        <DomainManager
          domains={domains}
          onChanged={(msg) => {
            setError("");
            setNotice(msg);
            refresh();
          }}
          onError={(msg) => {
            setNotice("");
            setError(msg);
          }}
        />
      )}

      {editing && (
        <EditLinkModal
          link={editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            setError("");
            setNotice(msg);
            refresh();
          }}
        />
      )}
    </Section>
  );
}

/** The paste-a-URL form. */
function CreateLink({ domains, onDone, onError }) {
  const [targetUrl, setTargetUrl] = useState("");
  const [host, setHost] = useState("");
  const [slug, setSlug] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!host && domains[0]) setHost(domains[0].host);
  }, [domains, host]);

  const submit = async (event) => {
    event.preventDefault();
    if (!targetUrl.trim() || !host || !cleanSlug(slug)) return;
    setBusy(true);
    try {
      const res = await api.createLink({ targetUrl: targetUrl.trim(), host, slug: cleanSlug(slug), note: note.trim() });
      if (res?.ok === false) {
        onError(res.message || "Couldn't create that short link.");
        return;
      }
      setTargetUrl("");
      setSlug("");
      setNote("");
      onDone(`Short link created: ${res.link?.shortUrl ?? ""}`);
    } catch (err) {
      onError(err?.message || "Couldn't create that short link.");
    } finally {
      setBusy(false);
    }
  };

  if (domains.length === 0) return null;

  return (
    <Card className="mb-6 p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-white">
        <Link2 className="size-4 text-primary-300" />
        New short link
      </h3>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Long URL" htmlFor="ls-url">
          <TextInput
            id="ls-url"
            type="url"
            placeholder="https://example.com/some/really/long/path"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
          <Field label="Subdomain" htmlFor="ls-host">
            <Select
              id="ls-host"
              value={host}
              onChange={setHost}
              options={domains.map((d) => ({ value: d.host, label: d.host }))}
            />
          </Field>
          <Field
            label="Slug (required)"
            htmlFor="ls-slug"
            hint="Lowercase words with dashes — spaces and capitals are converted automatically. e.g. training-document"
          >
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-slate-500">{host}/</span>
              <TextInput
                id="ls-slug"
                placeholder="training-document"
                value={slug}
                onChange={(e) => setSlug(cleanSlug(e.target.value))}
                className="flex-1"
                required
              />
            </div>
          </Field>
        </div>
        <Field label="Note (optional)" htmlFor="ls-note" hint="A reminder of what this link is for. Only staff see it.">
          <TextInput id="ls-note" placeholder="Summer event signup" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={busy || !targetUrl.trim() || !host || !cleanSlug(slug)}>
            <Plus className="size-4" />
            {busy ? "Creating…" : "Create short link"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** The list of existing short links. */
function LinkTable({ links, loading, onEdit, onChanged, onError }) {
  const act = async (fn, okMsg) => {
    try {
      const res = await fn();
      if (res?.ok === false) return onError(res.message || "That didn't work.");
      return onChanged(okMsg);
    } catch (err) {
      return onError(err?.message || "That didn't work.");
    }
  };

  if (loading) return <Card className="p-8 text-center text-sm text-slate-400">Loading…</Card>;
  if (links.length === 0)
    return <Card className="p-8 text-center text-sm text-slate-400">No short links yet.</Card>;

  return (
    <div className="space-y-3">
      {links.map((link) => (
        <Card key={link.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <CopyField value={link.shortUrl} codeClassName="text-primary-300 font-semibold" />
                {!link.active && <Badge tone="slate">Disabled</Badge>}
                <Badge tone="slate">{link.clicks} {link.clicks === 1 ? "click" : "clicks"}</Badge>
              </div>
              <a
                href={link.targetUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 flex items-center gap-1 truncate text-xs text-slate-400 hover:text-slate-200"
              >
                <ExternalLink className="size-3 shrink-0" />
                <span className="truncate">{link.targetUrl}</span>
              </a>
              {link.note && <p className="mt-1 text-xs text-slate-500">{link.note}</p>}
              {link.createdByName && (
                <p className="mt-1 text-[11px] text-slate-600">Created by {link.createdByName}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onEdit(link)}
                title="Edit"
                className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  act(() => api.updateLink(link.id, { active: !link.active }), link.active ? "Link disabled." : "Link enabled.")
                }
                title={link.active ? "Disable" : "Enable"}
                className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <Power className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Remove ${link.shortUrl}? Anyone with the link will get a 404.`)) {
                    act(() => api.deleteLink(link.id), "Link removed.");
                  }
                }}
                title="Remove"
                className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Edit a link's target, slug or note. */
function EditLinkModal({ link, onClose, onSaved }) {
  const [targetUrl, setTargetUrl] = useState(link.targetUrl);
  const [slug, setSlug] = useState(link.slug);
  const [note, setNote] = useState(link.note ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.updateLink(link.id, { targetUrl: targetUrl.trim(), slug: cleanSlug(slug), note: note.trim() });
      if (res?.ok === false) {
        setError(res.message || "Couldn't save.");
        setBusy(false);
        return;
      }
      onSaved("Short link updated.");
    } catch (err) {
      setError(err?.message || "Couldn't save.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-white">Edit short link</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-white">
            <X className="size-4" />
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-500">{link.host}/</p>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Long URL" htmlFor="el-url">
            <TextInput id="el-url" type="url" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} required />
          </Field>
          <Field label="Slug" htmlFor="el-slug" hint="Lowercase words with dashes, e.g. training-document.">
            <TextInput
              id="el-slug"
              value={slug}
              onChange={(e) => setSlug(cleanSlug(e.target.value))}
              required
            />
          </Field>
          <Field label="Note" htmlFor="el-note">
            <TextInput id="el-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          </Field>
          {error && <p className="text-sm font-semibold text-rose-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

/** Ownership-only: the subdomains links live on, with DNS setup instructions. */
function DomainManager({ domains, onChanged, onError }) {
  const [host, setHost] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  // Make the setup example concrete: use whatever host they're typing (falling
  // back to go.flrp.us), and split off the record name (the part before the root).
  const exampleHost = (host.trim() || "go.flrp.us").toLowerCase();
  const exampleName = exampleHost.split(".")[0] || "go";

  const add = async (event) => {
    event.preventDefault();
    if (!host.trim()) return;
    setBusy(true);
    try {
      const res = await api.addLinkDomain({ host: host.trim(), label: label.trim() });
      if (res?.ok === false) return onError(res.message || "Couldn't add that subdomain.");
      setHost("");
      setLabel("");
      return onChanged("Subdomain added. Point its DNS at the site (see the setup steps) and it'll start resolving.");
    } catch (err) {
      return onError(err?.message || "Couldn't add that subdomain.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (domain) => {
    if (!window.confirm(`Remove ${domain.host}? Its short links will stop resolving.`)) return;
    try {
      const res = await api.deleteLinkDomain(domain.id);
      if (res?.ok === false) return onError(res.message || "Couldn't remove that subdomain.");
      return onChanged("Subdomain removed.");
    } catch (err) {
      return onError(err?.message || "Couldn't remove that subdomain.");
    }
  };

  return (
    <Card className="mt-8 p-5">
      <div className="mb-1 flex items-center gap-2">
        <Globe className="size-4 text-slate-400" />
        <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-white">Subdomains</h3>
        <Badge tone="amber">Ownership</Badge>
      </div>
      <p className="mb-4 text-sm text-slate-400">
        The hosts short links live on. Each must be a real subdomain pointed at this site — adding it
        here records the host and lets links be minted on it, but the DNS is a one-time setup you do at
        your registrar.
      </p>

      <div className="mb-5 space-y-2">
        {domains.length === 0 ? (
          <p className="text-sm text-slate-500">None yet.</p>
        ) : (
          domains.map((d) => (
            <div
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.02] px-4 py-2.5 ring-1 ring-inset ring-white/[0.06]"
            >
              <div>
                <span className="font-semibold text-white">{d.host}</span>
                {d.label && <span className="ml-2 text-xs text-slate-500">{d.label}</span>}
              </div>
              <button
                type="button"
                onClick={() => remove(d)}
                title="Remove subdomain"
                className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <Field label="Subdomain host" htmlFor="dm-host" className="min-w-56 flex-1">
          <TextInput id="dm-host" placeholder="go.flrp.us" value={host} onChange={(e) => setHost(e.target.value)} />
        </Field>
        <Field label="Label (optional)" htmlFor="dm-label" className="min-w-40 flex-1">
          <TextInput id="dm-label" placeholder="Marketing links" value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy || !host.trim()}>
          <Plus className="size-4" />
          {busy ? "Adding…" : "Add"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-4 text-xs font-semibold text-primary-300 hover:text-primary-200"
      >
        {open ? "Hide" : "Show"} DNS setup steps
      </button>
      {open && (
        <div className="mt-3 rounded-xl bg-white/[0.02] p-4 ring-1 ring-inset ring-white/[0.06]">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            One-time DNS setup
          </p>
          <ol className="space-y-4 text-sm text-slate-400">
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-500/15 text-xs font-bold text-primary-300">
                1
              </span>
              <div className="space-y-2">
                <p className="font-semibold text-white">Add a DNS record at your registrar</p>
                <p>
                  In your DNS provider (Cloudflare, Namecheap, etc.), create a CNAME record that points
                  the subdomain at the same target your main site already uses. On Cloudflare, keep the
                  proxy on (the orange cloud).
                </p>
                <div className="rounded-lg bg-black/30 px-3 py-2 font-mono text-xs text-slate-300 ring-1 ring-inset ring-white/[0.06]">
                  <div>Type&nbsp;&nbsp;&nbsp;<span className="text-white">CNAME</span></div>
                  <div>Name&nbsp;&nbsp;&nbsp;<span className="text-white">{exampleName}</span>&nbsp;&nbsp;
                    <span className="text-slate-500">(the part before your root domain, for {exampleHost})</span>
                  </div>
                  <div>Target&nbsp;<span className="text-white">same as your main site</span></div>
                </div>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-500/15 text-xs font-bold text-primary-300">
                2
              </span>
              <div className="space-y-1">
                <p className="font-semibold text-white">Add it as a custom domain on your host</p>
                <p>
                  In your hosting provider (Railway, Northflank, etc.), add the full subdomain
                  (<span className="text-slate-200">{exampleHost}</span>) as a custom domain on this
                  site's service. That's what makes it issue an HTTPS certificate for the subdomain.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-500/15 text-xs font-bold text-primary-300">
                3
              </span>
              <div className="space-y-1">
                <p className="font-semibold text-white">Register the host here</p>
                <p>
                  Add the exact host in the field above and save. Once DNS finishes propagating (usually
                  a few minutes), short links on it start resolving — test by opening one.
                </p>
              </div>
            </li>
          </ol>
          <p className="mt-4 border-t border-white/[0.06] pt-3 text-xs text-slate-500">
            <span className="font-semibold text-slate-400">Tip:</span> use a dedicated subdomain — not
            your main site's host — so short slugs never collide with real pages.
          </p>
        </div>
      )}
    </Card>
  );
}
