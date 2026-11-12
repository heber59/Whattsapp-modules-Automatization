'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import type { FlowSummary } from '@wa/contracts';
import { usePortal } from '../../app/portal';

type Setup = {
  channel: null | { phoneNumberId: string; flowId: string; version: number; status: 'configured' };
  configuration: { ready: boolean; missing: string[] };
  webhookPath: string;
};
export function ChannelSetup({ businessId, role }: { businessId: string; role: 'owner' | 'admin' | 'operator' }) {
  const { t } = usePortal();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [selection, setSelection] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [reload, setReload] = useState(0);
  const writable = role === 'owner' || role === 'admin';
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { setLoading(true); setError(''); setSaved(false); });
    void Promise.all([
      fetch(`/api/businesses/${businessId}/whatsapp`, { cache: 'no-store', signal: controller.signal }),
      fetch(`/api/businesses/${businessId}/flows`, { cache: 'no-store', signal: controller.signal }),
    ]).then(async ([channelResponse, flowsResponse]) => {
      if (!channelResponse.ok || !flowsResponse.ok) throw new Error('setup');
      const [channel, data] = await Promise.all([channelResponse.json() as Promise<Setup>, flowsResponse.json() as Promise<{ flows: FlowSummary[] }>]);
      if (controller.signal.aborted) return;
      setSetup(channel); setFlows(data.flows);
      const current = channel.channel;
      const matching = data.flows.find(flow => flow.id === current?.flowId && flow.publishedVersion === current.version);
      const initial = matching ?? data.flows.find(flow => flow.publishedVersion !== null);
      setSelection(initial ? `${initial.id}:${initial.publishedVersion}` : '');
    }).catch(() => { if (!controller.signal.aborted) setError('load'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [businessId, reload]);

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!writable || !setup?.configuration.ready || !selection) return;
    const [flowId, rawVersion] = selection.split(':');
    const version = Number(rawVersion);
    if (setup.channel && !window.confirm(t('Use this published version for new conversations? Conversations already in progress keep their existing version.', '¿Usar esta versión publicada para conversaciones nuevas? Las conversaciones en curso conservan su versión actual.'))) return;
    setPending(true); setError(''); setSaved(false);
    try {
      const response = await fetch(`/api/businesses/${businessId}/whatsapp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ flowId, version }) });
      if (!response.ok) { setError(response.status === 409 ? 'conflict' : response.status === 403 ? 'permission' : response.status === 400 || response.status === 404 ? 'version' : response.status === 503 ? 'configuration' : 'save'); return; }
      const refreshed = await fetch(`/api/businesses/${businessId}/whatsapp`, { cache: 'no-store' });
      if (!refreshed.ok) { setError('refresh'); return; }
      setSetup(await refreshed.json() as Setup); setSaved(true);
    } catch { setError('save'); }
    finally { setPending(false); }
  }
  const messages: Record<string, string> = {
    load: t('Could not load WhatsApp setup. Please retry.', 'No pudimos cargar la configuración de WhatsApp. Intenta de nuevo.'),
    conflict: t('This server phone number is already assigned to another business. Ask the administrator to check the pilot configuration.', 'El número de este servidor ya está asignado a otro negocio. Pide al administrador que revise la configuración del piloto.'),
    permission: t('Only business owners and administrators can change this channel.', 'Solo propietarios y administradores del negocio pueden cambiar este canal.'),
    version: t('That published flow version is unavailable. Reload setup and choose a published version from this business.', 'Esa versión publicada no está disponible. Recarga y elige una versión publicada de este negocio.'),
    configuration: t('Server setup is incomplete or unavailable. Ask the administrator to check the Meta configuration.', 'La configuración del servidor está incompleta o no disponible. Pide al administrador que revise la configuración de Meta.'),
    save: t('Could not confirm the channel update. Reload setup to check its current state before trying again.', 'No pudimos confirmar la actualización del canal. Recarga para verificar su estado antes de intentar de nuevo.'),
    refresh: t('The request was accepted, but we could not reload the channel. Refresh setup to confirm its current state.', 'La solicitud fue aceptada, pero no pudimos recargar el canal. Actualiza la configuración para confirmar su estado.'),
  };
  const published = flows.filter(flow => flow.publishedVersion !== null);
  return <section className="account-card whatsapp-setup" aria-label={t('WhatsApp setup', 'Configuración de WhatsApp')}>
    <div className="channel-heading"><h2>{t('WhatsApp channel', 'Canal de WhatsApp')}</h2><button type="button" className="secondary-button compact" disabled={pending || loading} onClick={() => setReload(value => value + 1)}>{t('Refresh setup', 'Actualizar configuración')}</button></div>
    <p>{t('Assign a published flow to the pilot phone number configured on the server. New conversations use the selected version; existing conversations keep their pinned version.', 'Asigna un flujo publicado al número del piloto configurado en el servidor. Las conversaciones nuevas usan la versión seleccionada; las existentes conservan su versión fijada.')}</p>
    {loading ? <p role="status">{t('Loading channel setup…', 'Cargando configuración del canal…')}</p> : setup && <>
      <dl className="channel-details"><div><dt>{t('Server configuration', 'Configuración del servidor')}</dt><dd>{setup.configuration.ready ? t('Required settings present', 'Ajustes requeridos presentes') : t('Setup required', 'Configuración pendiente')}</dd></div><div><dt>{t('Channel assignment', 'Asignación del canal')}</dt><dd>{setup.channel ? t('Registered on this server', 'Registrado en este servidor') : t('Not assigned', 'Sin asignar')}</dd></div>{setup.channel && <><div><dt>{t('Meta phone number ID', 'Identificador del número de Meta')}</dt><dd>{setup.channel.phoneNumberId}</dd></div><div><dt>{t('Assigned published version', 'Versión publicada asignada')}</dt><dd>{flows.find(flow => flow.id === setup.channel?.flowId)?.name ?? setup.channel.flowId} · v{setup.channel.version}</dd></div></>}</dl>
      <p className="channel-note">{t('Registration does not verify Meta connectivity or message delivery. An administrator must configure the public webhook and server credentials before testing with WhatsApp.', 'El registro no verifica la conexión con Meta ni la entrega de mensajes. Un administrador debe configurar el webhook público y las credenciales del servidor antes de probar con WhatsApp.')}</p>
      {!setup.configuration.ready && <div className="channel-prerequisites"><p className="form-feedback" role="status">{t('Not configured yet. Complete the Meta setup before registering a flow.', 'Aún no está configurado. Completa la configuración de Meta antes de registrar un flujo.')}</p><ol><li>{t('Create a Meta developer app and add WhatsApp. Start with its test phone number.', 'Crea una aplicación de desarrollador en Meta y agrega WhatsApp. Empieza con su número de prueba.')}</li><li>{t('Have your server administrator configure the app credentials, pilot phone number, and this business on the server.', 'Pide al administrador del servidor que configure las credenciales de la aplicación, el número del piloto y este negocio en el servidor.')}</li><li>{t('Configure the public webhook in Meta, then return here and refresh setup.', 'Configura el webhook público en Meta, vuelve aquí y actualiza la configuración.')}</li><li>{t('Publish a flow, assign its version below, and test a new WhatsApp conversation.', 'Publica un flujo, asigna su versión abajo y prueba una conversación nueva de WhatsApp.')}</li></ol><p className="channel-note">{t('Credentials belong in server configuration. This page never asks for access tokens or app secrets.', 'Las credenciales pertenecen a la configuración del servidor. Esta página nunca solicita tokens de acceso ni secretos de la aplicación.')}</p></div>}
      {!writable ? <p>{t('Your operator role can view this setup. Ask an owner or administrator to make changes.', 'Tu rol de operador puede ver esta configuración. Pide a un propietario o administrador que haga los cambios.')}</p> : <form onSubmit={connect} aria-busy={pending} className="channel-form"><label htmlFor={`channel-flow-${businessId}`}>{t('Published flow version', 'Versión publicada del flujo')}</label><select id={`channel-flow-${businessId}`} value={selection} disabled={pending || !setup.configuration.ready} required onChange={event => { setSelection(event.target.value); setSaved(false); }}><option value="">{t('Choose a published version', 'Elige una versión publicada')}</option>{published.map(flow => <option key={flow.id} value={`${flow.id}:${flow.publishedVersion}`}>{flow.name} · v{flow.publishedVersion}</option>)}</select>{!published.length && <p>{t('Publish a flow in Flow studio before assigning this channel.', 'Publica un flujo en el estudio antes de asignar este canal.')} <Link href="/flows">{t('Open Flow studio', 'Abrir estudio de flujos')} →</Link></p>}<button disabled={pending || !setup.configuration.ready || !selection || !published.length}>{pending ? t('Saving assignment…', 'Guardando asignación…') : setup.channel ? t('Update flow assignment', 'Actualizar flujo asignado') : t('Register channel assignment', 'Registrar asignación del canal')}</button></form>}
    </>}
    {error && <p className="form-feedback" role="alert">{messages[error]}</p>}
    {saved && <p className="form-feedback success" role="status">{t('Channel assignment saved. Test a new WhatsApp conversation after the administrator completes the Meta webhook setup.', 'Asignación guardada. Prueba una conversación nueva de WhatsApp cuando el administrador complete el webhook de Meta.')}</p>}
  </section>;
}
