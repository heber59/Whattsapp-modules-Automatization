'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { usePortal } from '../portal';

export default function SignupPage() {
  const { t } = usePortal();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  async function signup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const password = String(fields.get('password'));
    setError(''); setSent(false);
    if (password !== String(fields.get('confirm'))) { setError(t('Passwords must match.', 'Las contraseñas deben coincidir.')); return; }
    setPending(true);
    try {
      const response = await fetch('/api/session/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: String(fields.get('email')).trim(), password }) });
      if (!response.ok) { setError(response.status === 429 ? t('Too many attempts. Please try later.', 'Demasiados intentos. Intenta más tarde.') : response.status === 400 ? t('Check your email and password requirements, then try again.', 'Revisa el correo y los requisitos de contraseña e intenta de nuevo.') : t('Account creation is unavailable. Please try again.', 'No se puede crear la cuenta ahora. Intenta de nuevo.')); return; }
      form.reset(); setSent(true);
    } catch { setError(t('Could not connect. Please try again.', 'No pudimos conectar. Intenta de nuevo.')); }
    finally { setPending(false); }
  }
  return <main className="standalone-login"><span className="section-kicker">{t('YOUR BUSINESS STARTS HERE', 'TU NEGOCIO EMPIEZA AQUÍ')}</span><h1>{t('Make room for possibility.', 'Abre espacio a las posibilidades.')}</h1><p>{t('Create an account to build your workspace and request a plan.', 'Crea una cuenta para organizar tu espacio y solicitar un plan.')}</p>{sent && <p className="form-feedback success" role="status">{t('Registration requested. Check your inbox for a confirmation email if required, then sign in. Already registered? Use sign in or password recovery.', 'Registro solicitado. Revisa tu correo para confirmar la cuenta si se requiere y luego ingresa. ¿Ya tienes cuenta? Ingresa o recupera tu contraseña.')}</p>}<form className="account-card" onSubmit={signup} aria-busy={pending}><label htmlFor="signup-email">{t('Email address', 'Correo electrónico')}</label><input id="signup-email" name="email" type="email" autoComplete="email" required maxLength={254} disabled={pending} /><label htmlFor="signup-password">{t('Password', 'Contraseña')}</label><input id="signup-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={1024} disabled={pending} aria-describedby="password-hint" /><small id="password-hint">{t('Use at least 8 characters. Your account provider may require additional complexity.', 'Usa al menos 8 caracteres. El proveedor de cuentas puede requerir mayor complejidad.')}</small><label htmlFor="signup-confirm">{t('Confirm password', 'Confirmar contraseña')}</label><input id="signup-confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={1024} disabled={pending} />{error && <p className="form-feedback" role="alert">{error}</p>}<button disabled={pending}>{pending ? t('Creating account…', 'Creando cuenta…') : t('Create account', 'Crear cuenta')} →</button></form><p className="account-links"><Link href="/login">{t('Sign in', 'Ingresar')}</Link> · <Link href="/#plans">{t('Explore plans', 'Explorar planes')}</Link></p></main>;
}
