'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';

type Identity = { id: string };
type PortalState = {
  language: 'en' | 'es'; t: (en: string, es: string) => string;
  user: Identity | null; checking: boolean; sessionError: boolean;
  refresh: () => Promise<boolean>; openLogin: (next?: string) => void;
};
const PortalContext = createContext<PortalState | null>(null);
export function usePortal() {
  const value = useContext(PortalContext);
  if (!value) throw new Error('Portal provider is required');
  return value;
}

export function Portal({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [dark, setDark] = useState(false);
  const [user, setUser] = useState<Identity | null>(null);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState(false);
  const [destination, setDestination] = useState('/businesses');
  const dialog = useRef<HTMLDialogElement>(null);
  const requestVersion = useRef(0);
  const pathname = usePathname();
  const router = useRouter();
  const t = useCallback((en: string, es: string) => language === 'es' ? es : en, [language]);
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    setChecking(true);
    try {
      const response = await fetch('/api/session', { cache: 'no-store' });
      if (!response.ok && response.status !== 401) throw new Error('Session unavailable');
      const identity = response.ok ? await response.json() as Identity : null;
      if (version !== requestVersion.current) return false;
      setUser(identity);
      setSessionError(false);
      return response.ok;
    } catch { if (version === requestVersion.current) { setUser(null); setSessionError(true); } return false; }
    finally { if (version === requestVersion.current) setChecking(false); }
  }, []);
  useEffect(() => { queueMicrotask(() => { void refresh(); }); }, [refresh, pathname]);
  useEffect(() => {
    try {
      const savedLanguage = localStorage.getItem('wa.language');
      const savedTheme = localStorage.getItem('wa.theme');
      queueMicrotask(() => {
        if (savedLanguage === 'es' || savedLanguage === 'en') setLanguage(savedLanguage);
        setDark(savedTheme ? savedTheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
      });
    } catch { /* Preferences remain usable when storage is unavailable. */ }
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, [dark]);
  function openLogin(next = '/businesses') {
    setDestination(next);
    dialog.current?.showModal();
  }
  function preference(kind: 'language' | 'theme', value: string) {
    try { localStorage.setItem('wa.' + kind, value); } catch { /* Optional persistence. */ }
  }
  return <PortalContext.Provider value={{ language, t, user, checking, sessionError, refresh, openLogin }}>
    <header className="portal-header">
      <Link className="brand" href="/" aria-label="Whattsapp Automatization"><span className="brand-mark">w<span>↗</span></span><span>Whattsapp<span className="brand-sub">AUTOMATIZATION</span></span></Link>
      <nav className="main-nav" aria-label={t('Main navigation', 'Navegación principal')}>
        <Link href="/#solutions">{t('Solutions', 'Soluciones')}</Link>
        <Link href="/#purpose">{t('Our purpose', 'Nuestro propósito')}</Link>
        <Link href="/#plans">{t('Plans', 'Planes')}</Link>
        <Link href="/#contact">{t('Contact', 'Contacto')}</Link>
        <Link href="/operations" aria-current={pathname === '/operations' ? 'page' : undefined}>Operations</Link>
        <Link href="/flows" aria-current={pathname === '/flows' ? 'page' : undefined}>{t('Flow studio', 'Estudio de flujos')}</Link>
      </nav>
      <div className="header-actions">
        <div className="language-switch" role="group" aria-label={t('Language', 'Idioma')}>
          {(['en', 'es'] as const).map(lang => <button key={lang} aria-pressed={language === lang} onClick={() => { setLanguage(lang); preference('language', lang); }}>{lang.toUpperCase()}</button>)}
        </div>
        <button className="theme-switch" aria-label={t(dark ? 'Switch to light theme' : 'Switch to dark theme', dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro')} aria-pressed={dark} onClick={() => { setDark(!dark); preference('theme', dark ? 'light' : 'dark'); }}>{dark ? '☀' : '☾'}</button>
        {user ? <Link className="button-link compact" href="/businesses">{t('My workspace', 'Mi espacio')}</Link> : <button className="compact" onClick={() => openLogin()}>{t('Sign in', 'Ingresar')} <span aria-hidden="true">↗</span></button>}
      </div>
    </header>
    {children}
    <footer className="portal-footer"><div><Link className="brand" href="/">Whattsapp Automatization<span className="green-dot" /></Link><p>{t('Built for the businesses behind every conversation.', 'Para los negocios detrás de cada conversación.')}</p></div><div className="footer-contact"><Link href="/#contact">{t('Contact Heber Santiago', 'Contactar a Heber Santiago')} ↗</Link><span>{t('For businesses', 'Para negocios')}</span></div><section aria-label={t('Copyright', 'Derechos de autor')} className="copyright"><strong>{t('Copyright', 'Derechos de autor')}</strong><span>© {new Date().getFullYear()} Heber Santiago Alvarez Rincon.</span><span>{t('All rights reserved.', 'Todos los derechos reservados.')}</span></section></footer>
    <dialog ref={dialog} aria-label={t("Sign in", "Ingresar")} className="login-dialog" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <button className="dialog-close" aria-label={t('Close sign in', 'Cerrar ingreso')} onClick={() => dialog.current?.close()}>×</button>
      <LoginForm onSuccess={() => { dialog.current?.close(); router.push(destination); }} />
    </dialog>
  </PortalContext.Provider>;
}

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { t, refresh } = usePortal();
  const formId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setPending(true); setError('');
    try {
      const response = await fetch('/api/session/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: String(fields.get('email')).trim(), password: String(fields.get('password')) }) });
      if (!response.ok) { setError(response.status === 401 ? 'credentials' : response.status === 429 ? 'limited' : 'unavailable'); return; }
      form.reset();
      if (await refresh()) onSuccess(); else setError('unavailable');
    } catch { setError('unavailable'); }
    finally { setPending(false); }
  }
  return <div className="login-content">
    <span className="section-kicker">{t('YOUR WORKSPACE', 'TU ESPACIO DE TRABAJO')}</span>
    <h2>{t('Good to see you.', 'Qué bueno verte.')}</h2>
    <p>{t('Sign in to bring your next conversation to life.', 'Ingresa para dar vida a tu próxima conversación.')}</p>
    <form className="account-card" onSubmit={login} aria-busy={pending}>
      <label htmlFor={formId + "-email"}>{t('Email address', 'Correo electrónico')}</label>
      <input id={formId + "-email"} name="email" type="email" autoComplete="username" placeholder="you@business.com" required maxLength={254} disabled={pending} />
      <label htmlFor={formId + "-password"}>{t('Password', 'Contraseña')}</label>
      <input id={formId + "-password"} name="password" type="password" autoComplete="current-password" required maxLength={1024} disabled={pending} />
      {error && <p className="form-feedback" role="alert">{error === 'credentials' ? t('Check your email and password.', 'Revisa tu correo y contraseña.') : error === 'limited' ? t('Too many attempts. Try again later.', 'Demasiados intentos. Intenta más tarde.') : t('Sign-in is unavailable. Please try again.', 'El ingreso no está disponible. Intenta de nuevo.')}</p>}
      <button type="submit" disabled={pending}>{pending ? t('Signing in…', 'Ingresando…') : t('Enter my workspace', 'Entrar a mi espacio')} <span aria-hidden="true">→</span></button>
    </form>
    <Link href="/forgot-password" onClick={event => event.currentTarget.closest('dialog')?.close()}>{t('Forgot your password?', '¿Olvidaste tu contraseña?')}</Link>
    <p className="account-links">{t('New here?', '¿Primera vez aquí?')} <Link href="/signup" onClick={event => event.currentTarget.closest('dialog')?.close()}>{t('Create an account', 'Crear una cuenta')}</Link></p>
  </div>;
}

export function WorkspaceGate({ children }: { children: ReactNode }) {
  const { t, user, checking, sessionError, refresh, openLogin } = usePortal();
  if (checking) return <main className="account-page"><p role="status">{t('Opening your workspace…', 'Abriendo tu espacio…')}</p></main>;
  if (!user) return <main className="workspace-gate"><span className="section-kicker">FLOW STUDIO</span><h1>{t('Your next great conversation starts here.', 'Tu próxima gran conversación empieza aquí.')}</h1><p>{sessionError ? t('We could not check your session. Please retry.', 'No pudimos verificar tu sesión. Intenta de nuevo.') : t('Sign in to create a flow and try it in the customer preview.', 'Ingresa para crear un flujo y probarlo en la vista del cliente.')}</p>{sessionError ? <button onClick={() => void refresh()}>{t('Try again', 'Intentar de nuevo')}</button> : <button onClick={() => openLogin('/flows')}>{t('Sign in to create a flow', 'Ingresar para crear un flujo')} →</button>}</main>;
  return children;
}
