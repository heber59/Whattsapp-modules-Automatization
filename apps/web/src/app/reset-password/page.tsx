'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';

export default function ResetPasswordPage() {
  const token = useRef('');
  const [ready, setReady] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fragment = window.location.hash;
    if (fragment) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      token.current = new URLSearchParams(fragment.slice(1)).get('token_hash') ?? '';
    }
    let active = true;
    void Promise.resolve().then(() => { if (active) setReady(Boolean(token.current)); });
    return () => { active = false; };
  }, []);

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const password = String(fields.get('password'));
    if (password !== String(fields.get('confirmation'))) {
      setError('The passwords do not match.');
      return;
    }
    if (!token.current) {
      setReady(false);
      return;
    }
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/session/recovery/complete', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_hash: token.current, password }),
      });
      if (!response.ok) {
        if (response.status === 401) {
          token.current = '';
          setReady(false);
        } else {
          setError(response.status === 429 ? 'Too many attempts. Please try again later.' : 'Could not reset your password. Please try again or request a new link.');
        }
        return;
      }
      token.current = '';
      form.reset();
      setComplete(true);
    } catch { setError('Could not connect. Check your connection and try again.'); }
    finally { setPending(false); }
  }

  return (
    <main className="account-page">
      <Link className="eyebrow" href="/">Whattsapp Automatization</Link>
      <h1>Choose a new password.</h1>
      {ready === null && <p role="status">Checking your reset link…</p>}
      {complete ? <>
        <p className="form-feedback" role="status">Your password has been updated. Sign in with your new password.</p>
        <Link className="button-link" href="/login">Sign in</Link>
      </> : ready === false ? <>
        <p className="form-feedback" role="alert">This reset link is missing, invalid, or expired. Request a new link to continue.</p>
        <Link className="button-link" href="/forgot-password">Request a new reset link</Link>
      </> : ready && <>
        <p>Use at least 8 characters. After resetting, sign in with your new password.</p>
        <form className="account-card" onSubmit={resetPassword} aria-busy={pending}>
          <label htmlFor="new-password">New password</label>
          <input id="new-password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={1024} required disabled={pending} />
          <label htmlFor="confirm-password">Confirm new password</label>
          <input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={1024} required disabled={pending} />
          {error && <p className="form-feedback" role="alert">{error}</p>}
          <button type="submit" disabled={pending}>{pending ? 'Resetting password…' : 'Reset password'}</button>
        </form>
      </>}
      <p className="account-links"><Link href="/login">Back to sign in</Link></p>
    </main>
  );
}
