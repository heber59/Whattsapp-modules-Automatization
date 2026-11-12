'use client';

import Link from 'next/link';
import { usePortal } from '../portal';
import { ChannelSetup } from '../../features/whatsapp/channel-setup';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

interface Business { id: string; name: string; role: 'owner' | 'admin' | 'operator' }

export function BusinessArea({ businessId }: { businessId?: string }) {
  const { t, refresh } = usePortal();
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(businessId ? `/api/businesses/${encodeURIComponent(businessId)}` : '/api/businesses', {
          cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          setBusinesses(null);
          router.replace('/login');
          return;
        }
        if (!response.ok) {
          setError(response.status === 404 ? t('This business is unavailable.', 'Este negocio no está disponible.') : t('Could not load your businesses. Please try again.', 'No pudimos cargar tus negocios. Intenta de nuevo.'));
          return;
        }
        const data = await response.json() as Business | Business[];
        if (!controller.signal.aborted) setBusinesses(Array.isArray(data) ? data : [data]);
      } catch {
        if (!controller.signal.aborted) setError(t('Could not connect. Check your connection and try again.', 'No pudimos conectar. Revisa tu conexión e intenta de nuevo.'));
      }
    }
    void load();
    return () => controller.abort();
  }, [businessId, reload, router, t]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get('name')).trim();
    if (!name) return;
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/businesses', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
      });
      if (response.status === 401) {
        setBusinesses(null);
        router.replace('/login');
        return;
      }
      if (!response.ok) {
        setError(response.status === 429 ? t('Too many requests. Please try again later.', 'Demasiadas solicitudes. Intenta más tarde.') : t('Could not create the business. Please try again.', 'No pudimos crear el negocio. Intenta de nuevo.'));
        return;
      }
      const business = await response.json() as Business;
      setBusinesses((current) => [...(current ?? []), business]);
      form.reset();
    } catch { setError(t('Could not connect. Check your connection and try again.', 'No pudimos conectar. Revisa tu conexión e intenta de nuevo.')); }
    finally { setPending(false); }
  }

  async function logout() {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/session/logout', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const result = await response.json().catch(() => null) as { authenticated?: boolean } | null;
      if (!response.ok && response.status !== 401 && result?.authenticated !== false) {
        setError(t('Could not sign out. Please try again.', 'No pudimos cerrar la sesión. Intenta de nuevo.'));
        return;
      }
      setBusinesses(null);
      void refresh();
      router.replace(response.ok || response.status === 401 ? '/login' : '/login?session=ended');
      router.refresh();
    } catch { setError(t('Could not connect. Please try signing out again.', 'No pudimos conectar. Intenta cerrar la sesión de nuevo.')); }
    finally { setPending(false); }
  }

  return (
    <main className="account-page">
      <nav className="account-nav" aria-label={t("Account", "Cuenta")}>
        <Link className="eyebrow" href="/">Whattsapp Automatization</Link>
        <button className="secondary-button" onClick={() => void logout()} disabled={pending}>{t('Sign out', 'Cerrar sesión')}</button>
      </nav>
      <p className="workspace-shortcuts"><Link className="button-link" href="/flows">{t("Create a flow", "Crear un flujo")} ↗</Link><Link className="button-link secondary-button" href="/whatsapp">{t("WhatsApp setup", "Configurar WhatsApp")} ↗</Link></p>
      <h1>{businessId ? t('Your business.', 'Tu negocio.') : t('Your businesses.', 'Tus negocios.')}</h1>
      {businessId && <Link href="/businesses">{t('← All businesses', '← Todos los negocios')}</Link>}
      {error && <div className="form-feedback" role="alert"><p>{error}</p>
        {!businesses && <button onClick={() => { setError(''); setReload((value) => value + 1); }}>{t('Try again', 'Intentar de nuevo')}</button>}
      </div>}
      {!businesses && !error && <p role="status">{t('Loading your account…', 'Cargando tu cuenta…')}</p>}
      {businesses && <>
        {businessId ? businesses.map((business) => <div key={business.id}><article className="account-card">
          <h2>{business.name}</h2><p>{t('Your role: ', 'Tu rol: ')}<strong>{t(business.role, ({owner:"propietario",admin:"administrador",operator:"operador"})[business.role])}</strong></p>
        </article><ChannelSetup businessId={business.id} role={business.role} /></div>) : <>
          <p>{t('Choose a business or create one to get started.', 'Elige un negocio o crea uno para empezar.')}</p>
          {businesses.length === 0 ? <p className="empty-state">{t('You have no businesses yet. Create your first one below.', 'Aún no tienes negocios. Crea el primero aquí.')}</p>
            : <ul className="business-list">{businesses.map((business) => <li key={business.id}>
              <Link href={`/businesses/${encodeURIComponent(business.id)}`}>
                <span>{business.name}</span><span className="role-label">{t(business.role, ({owner:"propietario",admin:"administrador",operator:"operador"})[business.role])}</span>
              </Link>
            </li>)}</ul>}
          <form className="account-card" onSubmit={create} aria-busy={pending}>
            <h2>{t('Create a business', 'Crear un negocio')}</h2>
            <label htmlFor="business-name">{t('Business name', 'Nombre del negocio')}</label>
            <input id="business-name" name="name" autoComplete="organization" required maxLength={100} disabled={pending} />
            <button type="submit" disabled={pending}>{pending ? t('Please wait…', 'Espera un momento…') : t('Create business', 'Crear negocio')}</button>
          </form>
        </>}
      </>}
    </main>
  );
}
