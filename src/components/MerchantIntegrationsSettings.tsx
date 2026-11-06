import { useEffect, useState } from 'react';
import { CheckCircle2, Link2, Loader2, PlugZap, ShieldCheck, Trash2, XCircle } from 'lucide-react';

type Provider = 'steadfast' | 'pathao' | 'woocommerce' | 'shopify';
type Integration = {
  provider: Provider;
  config: Record<string, unknown>;
  isActive: boolean;
  lastTestedAt: string | null;
  lastTestStatus: 'connected' | 'failed' | null;
  lastTestMessage: string | null;
  configured: boolean;
};

const PROVIDERS: { id: Provider; name: string; group: 'Courier' | 'Store'; description: string }[] = [
  { id: 'steadfast', name: 'Steadfast', group: 'Courier', description: 'Automated parcel booking and tracking.' },
  { id: 'pathao', name: 'Pathao Courier', group: 'Courier', description: 'Book parcels using your Pathao merchant store.' },
  { id: 'woocommerce', name: 'WooCommerce', group: 'Store', description: 'Connect your store REST API to sync tracking details.' },
  { id: 'shopify', name: 'Shopify', group: 'Store', description: 'Connect your Shopify Admin API to sync tracking details.' },
];

const initialForms: Record<Provider, Record<string, string>> = {
  steadfast: { apiKey: '', secretKey: '' },
  pathao: { environment: 'production', clientId: '', clientSecret: '', username: '', password: '', storeId: '' },
  woocommerce: { storeUrl: '', consumerKey: '', consumerSecret: '' },
  shopify: { shopDomain: '', accessToken: '' },
};

async function callApi(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || 'Integration request failed.');
    Object.assign(error, { code: payload.code, requiredPlan: payload.requiredPlan });
    throw error;
  }
  return payload;
}

export default function MerchantIntegrationsSettings({ activePackage, onNotify }: {
  activePackage: 'basic' | 'standard' | 'premium';
  onNotify: (message: string) => void;
}) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [forms, setForms] = useState(initialForms);
  const [testing, setTesting] = useState<Provider | null>(null);
  const [saving, setSaving] = useState<Provider | null>(null);
  const [removing, setRemoving] = useState<Provider | null>(null);
  const [autoBook, setAutoBook] = useState<Record<'steadfast' | 'pathao', boolean>>({ steadfast: true, pathao: true });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tested, setTested] = useState<Provider[]>([]);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const payload = await callApi('/api/merchant/integrations');
      setIntegrations(payload.integrations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load integrations.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  function update(provider: Provider, field: string, value: string) {
    setForms(current => ({ ...current, [provider]: { ...current[provider], [field]: value } }));
    setTested(current => current.filter(item => item !== provider));
  }

  async function test(provider: Provider) {
    setTesting(provider);
    setError('');
    try {
      const credentials = { ...forms[provider], storeId: provider === 'pathao' ? Number(forms.pathao.storeId) : undefined };
      await callApi(`/api/merchant/integrations/${provider}/test`, 'POST', { credentials });
      setTested(current => [...new Set([...current, provider])]);
      onNotify(`${PROVIDERS.find(item => item.id === provider)?.name} connection verified.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed.');
    } finally {
      setTesting(null);
    }
  }

  async function save(provider: Provider) {
    if (!tested.includes(provider)) {
      setError('Test the connection successfully before saving.');
      return;
    }
    setSaving(provider);
    setError('');
    try {
      const credentials = { ...forms[provider], storeId: provider === 'pathao' ? Number(forms.pathao.storeId) : undefined };
      await callApi(`/api/merchant/integrations/${provider}`, 'PUT', {
        credentials,
        config: { autoBook: provider === 'steadfast' || provider === 'pathao' ? autoBook[provider] : undefined },
      });
      setForms(current => ({ ...current, [provider]: initialForms[provider] }));
      setTested(current => current.filter(item => item !== provider));
      await refresh();
      onNotify('Integration securely saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save integration.');
    } finally {
      setSaving(null);
    }
  }

  async function remove(provider: Provider) {
    setRemoving(provider);
    try {
      await callApi(`/api/merchant/integrations/${provider}`, 'DELETE');
      await refresh();
      onNotify('Integration removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove integration.');
    } finally {
      setRemoving(null);
    }
  }

  function input(provider: Provider, field: string, label: string, type = 'text', placeholder = '') {
    return (
      <label className="md-integration-field" key={field}>
        <span>{label}</span>
        <input
          type={type}
          value={forms[provider][field] || ''}
          onChange={event => update(provider, field, event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
    );
  }

  function providerCard(provider: typeof PROVIDERS[number]) {
    const saved = integrations.find(item => item.provider === provider.id);
    const locked = provider.group === 'Courier' && activePackage === 'basic';
    const busy = testing === provider.id || saving === provider.id || removing === provider.id;
    return (
      <article className="md-card md-integration-card" key={provider.id}>
        <div className="md-card-top">
          <div><strong>{provider.name}</strong><p className="md-muted">{provider.description}</p></div>
          {saved?.isActive ? <span className="md-badge ok">Connected</span> : <span className="md-badge">Not connected</span>}
        </div>
        {locked ? (
          <div className="md-integration-locked">
            <ShieldCheck size={20} />
            <div><strong>Standard or Premium required</strong><p className="md-muted">Courier API connections and automatic booking are available from Standard.</p></div>
            <button className="md-primary" onClick={() => onNotify('Upgrade to Standard to unlock courier integrations.')}>Upgrade to Standard</button>
          </div>
        ) : (
          <>
            {provider.id === 'steadfast' && <div className="md-integration-grid">
              {input('steadfast', 'apiKey', 'API Key', 'password', 'Enter Steadfast API Key')}
              {input('steadfast', 'secretKey', 'Secret Key', 'password', 'Enter Steadfast Secret Key')}
            </div>}
            {provider.id === 'pathao' && <div className="md-integration-grid">
              <label className="md-integration-field"><span>Environment</span><select value={forms.pathao.environment} onChange={e => update('pathao', 'environment', e.target.value)}><option value="production">Production</option><option value="sandbox">Sandbox</option></select></label>
              {input('pathao', 'clientId', 'Client ID')}
              {input('pathao', 'clientSecret', 'Client Secret', 'password')}
              {input('pathao', 'username', 'Merchant Email', 'email')}
              {input('pathao', 'password', 'Merchant Password', 'password')}
              {input('pathao', 'storeId', 'Pathao Store ID', 'number')}
              <p className="md-muted md-integration-help">For Pathao bookings, the store webhook must include Pathao city, zone and area IDs as shipping metadata.</p>
            </div>}
            {provider.id === 'woocommerce' && <div className="md-integration-grid">
              {input('woocommerce', 'storeUrl', 'Store URL', 'url', 'https://yourstore.com')}
              {input('woocommerce', 'consumerKey', 'Consumer Key', 'password')}
              {input('woocommerce', 'consumerSecret', 'Consumer Secret', 'password')}
            </div>}
            {provider.id === 'shopify' && <div className="md-integration-grid">
              {input('shopify', 'shopDomain', 'Shop Domain', 'text', 'your-store.myshopify.com')}
              {input('shopify', 'accessToken', 'Admin API Access Token', 'password')}
            </div>}
            {(provider.group === 'Courier') && (
              <label className="md-integration-toggle">
                <input type="checkbox" checked={autoBook[provider.id as 'steadfast' | 'pathao']} onChange={e => setAutoBook(current => ({ ...current, [provider.id]: e.target.checked }))} />
                <span>Automatically book verified orders with {provider.name}</span>
              </label>
            )}
            {saved?.lastTestedAt && <p className="md-muted">Last verified: {new Date(saved.lastTestedAt).toLocaleString()}</p>}
            <div className="md-integration-actions">
              <button className="md-secondary" onClick={() => void test(provider.id)} disabled={busy}>
                {testing === provider.id ? <Loader2 className="md-spin" size={15} /> : <PlugZap size={15} />} Test Connection
              </button>
              <button className="md-primary" onClick={() => void save(provider.id)} disabled={busy || !tested.includes(provider.id)}>
                {saving === provider.id ? <Loader2 className="md-spin" size={15} /> : <CheckCircle2 size={15} />} Save Securely
              </button>
              {saved?.configured && <button className="md-secondary" onClick={() => void remove(provider.id)} disabled={busy}><Trash2 size={15} /> Remove</button>}
            </div>
            {tested.includes(provider.id) && <p className="md-success"><CheckCircle2 size={15} /> Connection test passed. Save to store encrypted credentials.</p>}
          </>
        )}
      </article>
    );
  }

  return (
    <section className="md-integrations-settings">
      <p className="md-eyebrow">WORKSPACE SETTINGS</p>
      <h1 className="md-title">Integrations</h1>
      <p className="md-sub">Connect your store and courier accounts. Credentials are encrypted before they are stored and are never sent back to this screen.</p>
      {error && <p className="md-error" role="alert"><XCircle size={16} /> {error}</p>}
      {loading ? <p className="md-muted">Loading saved connections…</p> : null}
      <div className="md-integration-section"><h2><PlugZap size={18} /> Courier connections</h2><p className="md-muted">Test your API keys before enabling automatic parcel booking.</p>{PROVIDERS.filter(item => item.group === 'Courier').map(providerCard)}</div>
      <div className="md-integration-section"><h2><Link2 size={18} /> Store connections</h2><p className="md-muted">Connect your store so tracking details can be synced back after courier booking.</p>{PROVIDERS.filter(item => item.group === 'Store').map(providerCard)}</div>
    </section>
  );
}
