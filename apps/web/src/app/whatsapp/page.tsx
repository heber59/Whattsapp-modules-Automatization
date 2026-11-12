'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePortal, WorkspaceGate } from '../portal';
import { ChannelSetup } from '../../features/whatsapp/channel-setup';

type Business = { id: string; name: string; role: 'owner' | 'admin' | 'operator' };
export default function WhatsAppPage() { return <WorkspaceGate><WhatsAppWorkspace /></WorkspaceGate>; }
function WhatsAppWorkspace() {
  const { t } = usePortal();
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/businesses', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Businesses unavailable');
      const data = await response.json() as Business[];
      if (!controller.signal.aborted) { setBusinesses(data); setError(false); }
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [reload]);
  const business = businesses?.find(item => item.id === selected);
  return <main className="account-page"><Link className="eyebrow" href="/businesses">← {t('My workspace', 'Mi espacio')}</Link><h1>{t('Bring the conversation to WhatsApp.', 'Lleva la conversación a WhatsApp.')}</h1><p>{t('Choose the business that will use the server-configured pilot number.', 'Elige el negocio que usará el número del piloto configurado en el servidor.')}</p>{error && <div role="alert" className="form-feedback"><p>{t('Could not load your businesses.', 'No pudimos cargar tus negocios.')}</p><button onClick={() => setReload(value => value + 1)}>{t('Try again', 'Intentar de nuevo')}</button></div>}{!businesses && !error && <p role="status">{t('Loading businesses…', 'Cargando negocios…')}</p>}{businesses && <><label className="channel-business-label" htmlFor="whatsapp-business">{t('Business', 'Negocio')}</label><select className="channel-business-select" id="whatsapp-business" value={selected} onChange={event => setSelected(event.target.value)}><option value="">{t('Choose a business', 'Elige un negocio')}</option>{businesses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{!businesses.length && <p><Link href="/businesses">{t('Create a business to get started', 'Crea un negocio para empezar')} →</Link></p>}{business && <ChannelSetup key={business.id} businessId={business.id} role={business.role} />}</>}</main>;
}
