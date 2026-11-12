'use client';

import Link from 'next/link';
import { usePortal } from '../portal';
import { useEffect, useRef, useState, type FormEvent } from 'react';

export default function ResetPasswordPage() {
  const { t } = usePortal();
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
      setError(t('The passwords do not match.', 'Las contraseñas no coinciden.'));
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
          setError(response.status === 429 ? t('Too many attempts. Please try again later.', 'Demasiados intentos. Intenta más tarde.') : t('Could not reset your password. Please try again or request a new link.', 'No pudimos cambiar la contraseña. Intenta de nuevo o solicita otro enlace.'));
        }
        return;
      }
      token.current = '';
      form.reset();
      setComplete(true);
    } catch { setError(t('Could not connect. Check your connection and try again.', 'No pudimos conectar. Revisa tu conexión e intenta de nuevo.')); }
    finally { setPending(false); }
  }

  return (
    <main className="account-page">
      <Link className="eyebrow" href="/">Whattsapp Automatization</Link>
      <h1>{t('Choose a new password.', 'Elige una contraseña nueva.')}</h1>
      {ready === null && <p role="status">{t('Checking your reset link…', 'Verificando tu enlace…')}</p>}
      {complete ? <>
        <p className="form-feedback" role="status">{t('Your password has been updated. Sign in with your new password.', 'Tu contraseña fue actualizada. Ingresa con la nueva contraseña.')}</p>
        <Link className="button-link" href="/login">{t('Sign in', 'Ingresar')}</Link>
      </> : ready === false ? <>
        <p className="form-feedback" role="alert">{t('This reset link is missing, invalid, or expired. Request a new link to continue.', 'Este enlace no es válido o ha vencido. Solicita uno nuevo para continuar.')}</p>
        <Link className="button-link" href="/forgot-password">{t('Request a new reset link', 'Solicitar un enlace nuevo')}</Link>
      </> : ready && <>
        <p>{t('Use at least 8 characters. After resetting, sign in with your new password.', 'Usa al menos 8 caracteres. Después, ingresa con tu nueva contraseña.')}</p>
        <form className="account-card" onSubmit={resetPassword} aria-busy={pending}>
          <label htmlFor="new-password">{t('New password', 'Nueva contraseña')}</label>
          <input id="new-password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={1024} required disabled={pending} />
          <label htmlFor="confirm-password">{t('Confirm new password', 'Confirma la nueva contraseña')}</label>
          <input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={1024} required disabled={pending} />
          {error && <p className="form-feedback" role="alert">{error}</p>}
          <button type="submit" disabled={pending}>{pending ? t('Resetting password…', 'Actualizando contraseña…') : t('Reset password', 'Restablecer contraseña')}</button>
        </form>
      </>}
      <p className="account-links"><Link href="/login">{t('Back to sign in', 'Volver al ingreso')}</Link></p>
    </main>
  );
}
