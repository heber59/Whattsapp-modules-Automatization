'use client';

import { useEffect, useRef, useState } from 'react';
import type { Step } from './flow-model';
import type { FlowDetail, FlowSummary, PublishedFlowVersion } from '@wa/contracts';
import { key, validDraft, validateFlow } from './flow-model';

type Business = { id: string; name: string; role: 'owner' | 'admin' | 'operator' };
type Flow = FlowDetail;
type Summary = FlowSummary;
type Translate = (en: string, es: string) => string;
const snapshot = (name: string, steps: Step[]) => JSON.stringify({ name, steps });

export function useFlowPersistence(userId: string, steps: Step[], setSteps: (steps: Step[]) => void, t: Translate) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState('');
  const [flows, setFlows] = useState<Summary[]>([]);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [name, setName] = useState('Untitled flow');
  const [saved, setSaved] = useState(snapshot('Untitled flow', []));
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [localDraft, setLocalDraft] = useState<Step[] | null>(null);
  const [recovery, setRecovery] = useState<{ name: string; steps: Step[] } | null>(null);
  const [storageError, setStorageError] = useState(false);
  const request = useRef(0);
  const current = useRef({ name, steps });
  useEffect(() => { current.current = { name, steps }; }, [name, steps]);
  const dirty = snapshot(name, steps) !== saved;
  const writable = businesses.find(b => b.id === businessId)?.role !== 'operator';
  const storageKey = businessId ? `${key}.server-recovery.${userId}.${businessId}.${flow?.id ?? 'new'}` : '';

  function failure(status: number) {
    if (status === 400) return t('Check the flow limits: 200 steps, 4,000 characters per step, 20 replies per step, 200 characters per reply, and 64 KiB per request. Published flows must pass graph validation.', 'Revisa los límites: 200 pasos, 4.000 caracteres por paso, 20 respuestas por paso, 200 caracteres por respuesta y 64 KiB por solicitud. Los flujos publicados deben pasar la validación.');
    return status === 409 ? t('This flow changed on the server. Your edits are preserved. Reload the server draft before saving again, or copy your work into a new flow.', 'El flujo cambió en el servidor. Tus cambios se conservan. Recarga el borrador del servidor antes de guardar de nuevo o copia tu trabajo a un flujo nuevo.') : status === 401 ? t('Your session expired. Sign in again; your edits remain on this device.', 'Tu sesión venció. Ingresa de nuevo; tus cambios permanecen en este dispositivo.') : status === 403 ? t('You do not have permission to change flows in this business.', 'No tienes permiso para cambiar los flujos de este negocio.') : t('The request could not be completed. Your current edits have been kept. Please try again.', 'No se pudo completar la solicitud. Tus cambios actuales se conservan. Intenta de nuevo.');
  }
  function discard() { return !dirty || window.confirm(t('Leave your unsaved edits? A recovery copy stays on this device when browser storage is available.', '¿Dejar tus cambios sin guardar? Se conserva una copia de recuperación en este dispositivo si el navegador lo permite.')); }
  function apply(next: Flow | null) {
    setFlow(next); setName(next?.name ?? 'Untitled flow'); setSteps(next?.steps ?? []); setSaved(snapshot(next?.name ?? 'Untitled flow', next?.steps ?? [])); setNotice(''); setError('');
  }
  async function chooseBusiness(id: string, force = false) {
    if (!id || busy || (!force && !discard())) return;
    const version = ++request.current;
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/businesses/${id}/flows`, { cache: 'no-store' });
      if (!response.ok) throw new Error(failure(response.status));
      const data = await response.json() as { flows: Summary[] };
      if (version !== request.current) return;
      setBusinessId(id); setFlows(data.flows); apply(null);
    } catch (cause) { if (version === request.current) setError(cause instanceof Error ? cause.message : failure(503)); }
    finally { if (version === request.current) setLoading(false); }
  }
  async function loadFlow(id: string) {
    if (busy || !discard()) return;
    if (!id) { apply(null); return; }
    const version = ++request.current;
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/businesses/${businessId}/flows/${id}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(failure(response.status));
      const data = await response.json() as { flow: Flow };
      if (version === request.current) apply(data.flow);
    } catch (cause) { if (version === request.current) setError(cause instanceof Error ? cause.message : failure(503)); }
    finally { if (version === request.current) setLoading(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/businesses', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Could not load businesses. Reload this page to try again.');
      const data = await response.json() as Business[];
      if (!controller.signal.aborted) { setBusinesses(data); setLoading(false); }
    }).catch(cause => { if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Could not load businesses.'); setLoading(false); } });
    try { const data: unknown = JSON.parse(localStorage.getItem(`${key}.${userId}`) ?? 'null'); if (validDraft(data) && data.length) queueMicrotask(() => { if (!controller.signal.aborted) setLocalDraft(data); }); } catch { /* Original drafts remain untouched. */ }
    return () => { controller.abort(); };
  }, [userId]);
  useEffect(() => {
    if (!storageKey || loading) return;
    try {
      const data = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as { name?: unknown; steps?: unknown } | null;
      if (data && typeof data.name === 'string' && validDraft(data.steps) && snapshot(data.name, data.steps) !== saved) queueMicrotask(() => setRecovery({ name: data.name as string, steps: data.steps as Step[] }));
      else queueMicrotask(() => setRecovery(null));
    } catch { queueMicrotask(() => setRecovery(null)); }
    // Recovery is inspected only when opening a different server draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, loading]);
  useEffect(() => {
    if (!storageKey || loading || !dirty) return;
    try { localStorage.setItem(storageKey, snapshot(name, steps)); queueMicrotask(() => setStorageError(false)); } catch { queueMicrotask(() => setStorageError(true)); }
  }, [storageKey, loading, dirty, name, steps]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const navigate = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const destination = new URL(anchor.href, location.href);
      if (destination.pathname === location.pathname && destination.search === location.search) return;
      if (!window.confirm('Leave your unsaved edits? A recovery copy stays on this device when browser storage is available.')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', navigate, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', navigate, true); };
  }, [dirty]);
  async function save() {
    if (!businessId || busy || loading || !writable) return;
    const value = { name: name.trim(), steps };
    if (!value.name) { setError(t('Give this flow a name.', 'Dale un nombre al flujo.')); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/businesses/${businessId}/flows${flow ? '/' + flow.id : ''}`, { method: flow ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...value, ...(flow ? { expectedRevision: flow.revision } : {}) }) });
      if (!response.ok) throw new Error(failure(response.status));
      const data = await response.json() as { flow: Flow };
      setFlow(data.flow); setSaved(snapshot(value.name, value.steps));
      if (current.current.name === value.name) setName(data.flow.name);
      setFlows(items => [...items.filter(item => item.id !== data.flow.id), data.flow]);
      setNotice(t('Draft saved on the server. Any newer edits still need saving.', 'Borrador guardado en el servidor. Los cambios posteriores aún deben guardarse.'));
      setRecovery(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : failure(503)); }
    finally { setBusy(false); }
  }
  async function publish() {
    if (!flow || busy || loading || dirty || !writable) return;
    const issue = validateFlow(steps);
    if (issue) { setError(issue); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/businesses/${businessId}/flows/${flow.id}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedRevision: flow.revision }) });
      if (!response.ok) throw new Error(failure(response.status));
      const data = await response.json() as { version: PublishedFlowVersion };
      setFlow(previous => previous ? { ...previous, publishedVersion: data.version.version, publishedRevision: data.version.sourceRevision } : previous);
      setNotice(t('Published an immutable version. This does not connect or start WhatsApp automation.', 'Se publicó una versión inmutable. Esto no conecta ni inicia la automatización de WhatsApp.'));
    } catch (cause) { setError(cause instanceof Error ? cause.message : failure(503)); }
    finally { setBusy(false); }
  }
  function importLocal() { if (localDraft && discard()) { setSteps(structuredClone(localDraft)); setNotice(t('Browser draft imported into the editor. Save it explicitly to store it on the server.', 'Borrador del navegador importado al editor. Guárdalo explícitamente para almacenarlo en el servidor.')); } }
  function restore() { if (recovery && discard()) { setName(recovery.name); setSteps(recovery.steps); setRecovery(null); } }
  return { businesses, businessId, flows, flow, name, setName, dirty, busy, loading, error, notice, writable, localDraft, recovery, storageError, chooseBusiness, loadFlow, save, publish, importLocal, restore, newCopy: () => { setFlow(null); setSaved(''); setNotice(t('This is now a new flow. Save to create a separate server draft.', 'Este es un flujo nuevo. Guarda para crear otro borrador en el servidor.')); } };
}
