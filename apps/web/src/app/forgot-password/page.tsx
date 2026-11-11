'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

export default function ForgotPasswordPage() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(new FormData(form).get('email')).trim();
    setPending(true);
    setSent(false);
    setError('');
    try {
      const response = await fetch('/api/session/recovery/request', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        setError(response.status === 429 ? 'Too many requests. Please try again later.' : 'Password recovery is unavailable. Please try again.');
        return;
      }
      form.reset();
      setSent(true);
    } catch { setError('Could not connect. Check your connection and try again.'); }
    finally { setPending(false); }
  }

  return (
    <main className="account-page">
      <Link className="eyebrow" href="/">Whattsapp Automatization</Link>
      <h1>Reset your password.</h1>
      <p>Enter your email to request a password reset link.</p>
      {sent && <p className="form-feedback" role="status">If an account is eligible, you will receive a password reset email. Check your inbox and spam folder.</p>}
      <form className="account-card" onSubmit={requestRecovery} aria-busy={pending}>
        <label htmlFor="recovery-email">Email</label>
        <input id="recovery-email" name="email" type="email" autoComplete="email" required maxLength={254} disabled={pending} />
        {error && <p className="form-feedback" role="alert">{error}</p>}
        <button type="submit" disabled={pending}>{pending ? 'Sending request…' : 'Send reset link'}</button>
      </form>
      <p className="account-links"><Link href="/login">Back to sign in</Link></p>
    </main>
  );
}
