'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { usePortal } from '../../app/portal';

type Plan = { id: string; name: string; price: number; currency: string; interval: string };

function ContactFields({ prefix, pending }: { prefix: string; pending: boolean }) {
  const { t } = usePortal();
  return <><label htmlFor={prefix + '-email'}>{t('Email address', 'Correo electrónico')}</label><input id={prefix + '-email'} name="email" type="email" autoComplete="email" maxLength={254} disabled={pending} placeholder="you@business.com" /><label htmlFor={prefix + '-phone'}>{t('Phone number', 'Número de teléfono')}</label><input id={prefix + '-phone'} name="phone" type="tel" autoComplete="tel" pattern="\+[1-9][0-9]{7,14}" maxLength={16} disabled={pending} placeholder="+14155552671" aria-describedby={prefix + '-hint'} /><small id={prefix + '-hint'}>{t('Leave an email or phone number. Include the country code, for example +14155552671.', 'Deja un correo o teléfono. Incluye el código de país, por ejemplo +14155552671.')}</small><label className="consent-field"><input name="consent" type="checkbox" required disabled={pending} />{t('I agree to be contacted about this request using the details I provide.', 'Acepto que me contacten sobre esta solicitud usando los datos que proporciono.')}</label></>;
}

function RequestForm({ plan }: { plan?: string }) {
  const { t } = usePortal();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const prefix = plan ? 'plan' : 'contact';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const email = String(fields.get('email') ?? '').trim();
    const phone = String(fields.get('phone') ?? '').trim();
    setError(''); setSent(false);
    if (!email && !phone) { setError(t('Please leave an email or phone number.', 'Deja un correo o número de teléfono.')); return; }
    setPending(true);
    try {
      const body = { email: email || undefined, phone: phone || undefined, consent: fields.get('consent') === 'on', ...(plan ? { plan } : { name: String(fields.get('name') ?? '').trim() || undefined, message: String(fields.get('message') ?? '').trim() || undefined }) };
      const response = await fetch('/api/commercial/' + (plan ? 'purchase-requests' : 'leads'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!response.ok) { setError(response.status === 401 ? t('Please sign in again, then submit your request.', 'Ingresa de nuevo y envía tu solicitud.') : response.status === 429 ? t('Too many requests. Please try later.', 'Demasiadas solicitudes. Intenta más tarde.') : t('We could not save your request. Please try again.', 'No pudimos guardar tu solicitud. Intenta de nuevo.')); return; }
      form.reset(); setSent(true);
    } catch { setError(t('Could not connect. Please try again.', 'No pudimos conectar. Intenta de nuevo.')); }
    finally { setPending(false); }
  }
  return <form className="account-card" onSubmit={submit} aria-busy={pending}>{!plan && <><label htmlFor="contact-name">{t('Name (optional)', 'Nombre (opcional)')}</label><input id="contact-name" name="name" autoComplete="name" maxLength={100} disabled={pending} /></>}<ContactFields prefix={prefix} pending={pending} />{!plan && <><label htmlFor="contact-message">{t('What does your business need? (optional)', '¿Qué necesita tu negocio? (opcional)')}</label><textarea id="contact-message" name="message" maxLength={2000} rows={3} disabled={pending} /></>}{error && <p className="form-feedback" role="alert">{error}</p>}{sent && <p className="form-feedback success" role="status">{plan ? t('Your plan request is saved for personal follow-up. No payment has been taken.', 'Tu solicitud de plan está guardada para seguimiento personal. No se ha realizado ningún cobro.') : t('Request received. Heber Santiago can follow up using the details you provided.', 'Solicitud recibida. Heber Santiago podrá contactarte usando los datos que dejaste.')}</p>}<button disabled={pending}>{pending ? t('Sending…', 'Enviando…') : plan ? t('Save purchase details', 'Guardar datos de compra') : t('Request a conversation', 'Solicitar una conversación')} →</button></form>;
}

export function ContactSection() {
  const { t } = usePortal();
  return <section id="contact" className="contact-section"><div><span className="section-kicker">04 / {t('LET’S TALK', 'CONVERSEMOS')}</span><h2>{t('A person on the other side.', 'Una persona al otro lado.')}</h2><p>{t('Want help finding the right solution? Tell Heber Santiago Alvarez Rincon what your business needs. Leave your email or phone number for a personal conversation about solutions and the right plan.', '¿Necesitas ayuda para encontrar la solución adecuada? Cuéntale a Heber Santiago Alvarez Rincon qué necesita tu negocio. Deja tu correo o teléfono para conversar personalmente sobre soluciones y el plan adecuado.')}</p><p className="contact-note">{t('No account needed. Your details are used to follow up on your request.', 'No necesitas una cuenta. Tus datos se usan para dar seguimiento a tu solicitud.')}</p></div><RequestForm /></section>;
}

export function PlansSection() {
  const { t, user, checking, openLogin } = usePortal();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState('');
  const [buying, setBuying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch('/api/commercial/plans', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('Plans unavailable');
      const data = await response.json() as { plans: Plan[] };
      if (!Array.isArray(data.plans) || !data.plans.every(plan => typeof plan.id === 'string' && typeof plan.name === 'string' && Number.isFinite(plan.price) && plan.price >= 0 && plan.currency === 'COP' && plan.interval === 'month')) throw new Error('Invalid plans');
      if (active) { setPlans(data.plans); setSelected(data.plans[0]?.id ?? ''); setUnavailable(!data.plans.length); }
    }).catch(() => { if (active) setUnavailable(true); });
    return () => { active = false; };
  }, []);
  return <section id="plans" className="plans-section"><div className="section-heading"><div><span className="section-kicker">03 / {t('CHOOSE YOUR PATH', 'ELIGE TU CAMINO')}</span><h2>{t('A plan. Or a conversation.', 'Un plan. O una conversación.')}</h2></div></div>{unavailable ? <p className="form-feedback" role="status">{t('Plans are temporarily unavailable. Leave your details below to discuss options.', 'Los planes no están disponibles temporalmente. Deja tus datos abajo para conversar sobre las opciones.')}</p> : plans.length === 0 ? <p role="status">{t('Loading plans…', 'Cargando planes…')}</p> : <><div className="plan-options" role="group" aria-label={t('Choose a plan', 'Elige un plan')}>{plans.map(plan => <button key={plan.id} className={'plan-option' + (selected === plan.id ? ' selected' : '')} aria-pressed={selected === plan.id} onClick={() => setSelected(plan.id)}><strong>{plan.name}</strong><span className="plan-price">{plan.currency} {new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(plan.price)} <small>{t('/ month', '/ mes')}</small></span><span>{t('Full access to flow creation', 'Acceso completo a la creación de flujos')}</span><span>{t('Personal assistance to optimize your business', 'Asistencia personal para optimizar tu negocio')}</span><span>{t('WhatsApp connection is coming; flow studio is available now.', 'La conexión con WhatsApp está en desarrollo; el estudio de flujos ya está disponible.')}</span></button>)}</div><button className="buy-plan-button" disabled={checking} onClick={() => setBuying(true)}>{t('Buy plan', 'Comprar plan')} →</button>{buying && (checking ? <p role="status">{t('Checking your account…', 'Verificando tu cuenta…')}</p> : user ? <div className="plan-request"><h3>{t('Purchase details:', 'Datos de compra:')} {plans.find(plan => plan.id === selected)?.name}</h3><p>{t('Save your details to continue when payments are available. This does not activate a subscription or charge you.', 'Guarda tus datos para continuar cuando los pagos estén disponibles. Esto no activa una suscripción ni genera un cobro.')}</p><RequestForm key={selected} plan={selected} /></div> : <div className="plan-signin"><p>{t('Sign in or create an account to continue with your purchase. Your selection stays here while you sign in.', 'Ingresa o crea una cuenta para continuar con tu compra. Tu selección se conserva mientras ingresas.')}</p><button onClick={() => openLogin('/#plans')}>{t('Sign in to continue', 'Ingresar para continuar')} →</button><Link href="/signup">{t('Create an account, then return to Plans', 'Crea una cuenta y vuelve a Planes')}</Link></div>)}</>}<p className="account-links"><a href="#contact">{t('Help me find the right solution', 'Ayúdame a encontrar la solución adecuada')} ↓</a></p></section>;
}
