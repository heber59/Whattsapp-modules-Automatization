'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

interface Business { id: string; name: string; role: 'owner' | 'admin' | 'operator' }

export function BusinessArea({ businessId }: { businessId?: string }) {
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
          setError(response.status === 404 ? 'This business is unavailable.' : 'Could not load your businesses. Please try again.');
          return;
        }
        const data = await response.json() as Business | Business[];
        if (!controller.signal.aborted) setBusinesses(Array.isArray(data) ? data : [data]);
      } catch {
        if (!controller.signal.aborted) setError('Could not connect. Check your connection and try again.');
      }
    }
    void load();
    return () => controller.abort();
  }, [businessId, reload, router]);

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
        setError(response.status === 429 ? 'Too many requests. Please try again later.' : 'Could not create the business. Please try again.');
        return;
      }
      const business = await response.json() as Business;
      setBusinesses((current) => [...(current ?? []), business]);
      form.reset();
    } catch { setError('Could not connect. Check your connection and try again.'); }
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
        setError('Could not sign out. Please try again.');
        return;
      }
      setBusinesses(null);
      router.replace(response.ok || response.status === 401 ? '/login' : '/login?session=ended');
      router.refresh();
    } catch { setError('Could not connect. Please try signing out again.'); }
    finally { setPending(false); }
  }

  return (
    <main className="account-page">
      <nav className="account-nav" aria-label="Account">
        <Link className="eyebrow" href="/">Whattsapp Automatization</Link>
        <button className="secondary-button" onClick={() => void logout()} disabled={pending}>Sign out</button>
      </nav>
      <h1>{businessId ? 'Your business.' : 'Your businesses.'}</h1>
      {businessId && <Link href="/businesses">← All businesses</Link>}
      {error && <div className="form-feedback" role="alert"><p>{error}</p>
        {!businesses && <button onClick={() => { setError(''); setReload((value) => value + 1); }}>Try again</button>}
      </div>}
      {!businesses && !error && <p role="status">Loading your account…</p>}
      {businesses && <>
        {businessId ? businesses.map((business) => <article className="account-card" key={business.id}>
          <h2>{business.name}</h2><p>Your role: <strong>{business.role}</strong></p>
        </article>) : <>
          <p>Choose a business or create one to get started.</p>
          {businesses.length === 0 ? <p className="empty-state">You have no businesses yet. Create your first one below.</p>
            : <ul className="business-list">{businesses.map((business) => <li key={business.id}>
              <Link href={`/businesses/${encodeURIComponent(business.id)}`}>
                <span>{business.name}</span><span className="role-label">{business.role}</span>
              </Link>
            </li>)}</ul>}
          <form className="account-card" onSubmit={create} aria-busy={pending}>
            <h2>Create a business</h2>
            <label htmlFor="business-name">Business name</label>
            <input id="business-name" name="name" autoComplete="organization" required maxLength={100} disabled={pending} />
            <button type="submit" disabled={pending}>{pending ? 'Please wait…' : 'Create business'}</button>
          </form>
        </>}
      </>}
    </main>
  );
}
