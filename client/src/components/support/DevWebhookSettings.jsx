import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import Button from '../ui/Button';

export default function DevWebhookSettings() {
  const [status, setStatus] = useState(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    api.devWebhookStatus().then(data => { if (active) setStatus(data); })
      .catch(() => { if (active) setError('Unable to load webhook settings.'); });
    return () => { active = false; };
  }, []);
  async function save(event) {
    event.preventDefault(); setSaving(true); setError('');
    try { setStatus(await api.saveDevWebhook(url)); setUrl(''); }
    catch (e) { setError(e.message || 'Unable to save webhook.'); }
    finally { setSaving(false); }
  }
  return <form onSubmit={save} className="mb-8 rounded-xl border border-amber-500/25 bg-white/5 p-5">
    <h2 className="font-semibold text-white">Dev ticket Discord notifications</h2>
    <p className="mt-2 text-sm text-slate-400">Every new ticket announces its title, opener and link, and pings the three configured development roles.</p>
    <p role="status" className="my-3 text-sm text-amber-300">{status ? status.configured ? 'Webhook configured' : 'No webhook configured' : 'Loading settings…'}</p>
    <label className="block text-sm text-slate-300">Discord webhook URL
      <input type="password" autoComplete="off" required value={url} onChange={e => setUrl(e.target.value)} placeholder="Paste a webhook URL to set or replace it"
        className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white" />
    </label>
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    <Button type="submit" className="mt-3" disabled={saving || !status || !url.trim()}>{saving ? 'Saving…' : 'Save webhook'}</Button>
  </form>;
}
