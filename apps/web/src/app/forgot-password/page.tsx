'use client';

import Link from 'next/link';
import { usePortal } from '../portal';
import { useState, type FormEvent } from 'react';

export default function ForgotPasswordPage() {
  const { t } = usePortal();
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
        setError(response.status === 429 ? t('Too many requests. Please try again later.', 'Demasiadas solicitudes. Intenta más tarde.') : t('Password recovery is unavailable. Please try again.', 'La recuperación no está disponible. Intenta de nuevo.'));
        return;
      }
      form.reset();
      setSent(true);
    } catch { setError(t('Could not connect. Check your connection and try again.', 'No pudimos conectar. Revisa tu conexión e intenta de nuevo.')); }
    finally { setPending(false); }
  }

  return (
    <main className="account-page">
      <Link className="eyebrow" href="/">Whattsapp Automatization</Link>
      <h1>{t('Reset your password.', 'Restablece tu contraseña.')}</h1>
      <p>{t('Enter your email to request a password reset link.', 'Ingresa tu correo para solicitar un enlace de recuperación.')}</p>
      {sent && <p className="form-feedback" role="status">{t('If an account is eligible, you will receive a password reset email. Check your inbox and spam folder.', 'Si la cuenta es válida, recibirás un correo para restablecer tu contraseña. Revisa también la carpeta de spam.')}</p>}
      <form className="account-card" onSubmit={requestRecovery} aria-busy={pending}>
        <label htmlFor="recovery-email">{t('Email', 'Correo electrónico')}</label>
        <input id="recovery-email" name="email" type="email" autoComplete="email" required maxLength={254} disabled={pending} />
        {error && <p className="form-feedback" role="alert">{error}</p>}
        <button type="submit" disabled={pending}>{pending ? t('Sending request…', 'Enviando solicitud…') : t('Send reset link', 'Enviar enlace')}</button>
      </form>
      <p className="account-links"><Link href="/login">{t('Back to sign in', 'Volver al ingreso')}</Link></p>
    </main>
  );
}
