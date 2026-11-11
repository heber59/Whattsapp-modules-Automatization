'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/session/login', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: String(fields.get('email')).trim(), password: String(fields.get('password')) }),
      });
      if (!response.ok) {
        setError(response.status === 401 ? 'Check your email and password.'
          : response.status === 429 ? 'Too many attempts. Please try again later.'
            : 'Sign-in is unavailable. Please try again.');
        return;
      }
      form.reset();
      router.replace('/businesses');
    } catch {
      setError('Could not connect. Check your connection and try again.');
    } finally { setPending(false); }
  }

  return (
    <main className="account-page">
      <Link className="eyebrow" href="/">Whattsapp Automatization</Link>
      <h1>Welcome back.</h1>
      <p>Sign in to manage your businesses.</p>
      {searchParams.get('session') === 'ended' && <p className="form-feedback" role="status">Signed out on this browser. Remote session revocation could not be confirmed.</p>}
      <form className="account-card" onSubmit={login} aria-busy={pending}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required maxLength={254} disabled={pending} />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} disabled={pending} />
        {error && <p className="form-feedback" role="alert">{error}</p>}
        <button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="account-links"><Link href="/forgot-password">Forgot your password?</Link></p>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<main className="account-page"><p role="status">Loading sign-in…</p></main>}><LoginForm /></Suspense>;
}
