'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import './flows.css';
import { useFlowPersistence } from './use-flow-persistence';
import { usePortal, WorkspaceGate } from '../portal';

import {
  example,
  kinds,
  validateFlow,
  type Step,
  type Kind,
} from './flow-model';
export default function FlowPage() { const { user } = usePortal(); return <WorkspaceGate><Playground key={user?.id} /></WorkspaceGate>; }

function Playground() {
  const { t, user } = usePortal();
  const messages: Record<string, string> = {
    'Add exactly one Start step.': 'Agrega exactamente un paso de inicio.',
    'Give each step some text.': 'Agrega texto a cada paso.',
    'Add a reply to each menu.': 'Agrega una respuesta a cada menú.',
    'Connect each outgoing reply and give it a label.': 'Conecta cada respuesta y asígnale una etiqueta.',
    'Connect every step to the path from Start.': 'Conecta todos los pasos con el recorrido desde el inicio.',
    'Each step needs a path to an End.': 'Cada paso necesita un recorrido hacia un final.',
    'This path loops before the customer can reply. Change a connection and try again.': 'Este recorrido se repite antes de que el cliente responda. Cambia una conexión e intenta de nuevo.',
    'Welcome': 'Bienvenido', 'How can we help?': '¿Cómo podemos ayudarte?', 'Store hours': 'Horario',
    'Pickup': 'Recogida', 'We open at 9 AM.': 'Abrimos a las 9 a. m.', 'Next': 'Siguiente',
    'Pickup is available at the counter.': 'Puedes recoger tu pedido en el mostrador.', 'See you soon!': '¡Hasta pronto!'
  };
  const translate = (message: string) => t(message, messages[message] ?? message);

  const kindLabel = (kind: Kind) => t(kind, ({ Start: 'Inicio', Message: 'Mensaje', Menu: 'Menú', End: 'Fin' })[kind]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [selected, select] = useState('');
  const [error, setError] = useState('');
  const [chat, setChat] = useState<{ text: string; user?: boolean }[]>([]);
  const [at, setAt] = useState('');
  const drag = useRef<{
    id: string;
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const persistence = useFlowPersistence(user!.id, steps, setSteps, t);
  const ready = !persistence.loading && !!persistence.businessId;
  const editable = ready && persistence.writable;
  useEffect(() => { queueMicrotask(() => { select(''); setChat([]); setAt(''); setError(''); }); }, [persistence.flow?.id, persistence.flow?.revision, persistence.businessId]);
  const active = steps.find((step) => step.id === selected);
  const current = steps.find((step) => step.id === at);
  function edit(next: Step[]) {
    setSteps(next);
    setError('');
    setChat([]);
    setAt('');
  }
  function patch(change: Partial<Step>) {
    edit(
      steps.map((step) =>
        step.id === selected ? { ...step, ...change } : step,
      ),
    );
  }
  function add(kind: Kind) {
    const step: Step = {
      id: crypto.randomUUID(),
      kind,
      text: kind === 'Menu' ? t('Choose an option', 'Elige una opción') : kindLabel(kind),
      x: 25 + (steps.length % 4) * 245,
      y: 35 + Math.floor(steps.length / 4) * 145,
      choices:
        kind === 'End'
          ? []
          : [{ label: kind === 'Menu' ? t('Option 1', 'Opción 1') : t('Next', 'Siguiente'), to: '' }],
    };
    edit([...steps, step]);
    select(step.id);
  }
  function play(id: string, reply?: string) {
    const lines = reply ? [...chat, { text: reply, user: true }] : [];
    const seen = new Set<string>();
    let step = steps.find((targetStep) => targetStep.id === id);
    while (step) {
      if (seen.has(step.id)) {
        setError(
          'This path loops before the customer can reply. Change a connection and try again.',
        );
        break;
      }
      seen.add(step.id);
      if (step.kind !== 'Start') lines.push({ text: step.text });
      if (step.kind === 'Menu' || step.kind === 'End') {
        setAt(step.id);
        setChat(lines);
        return;
      }
      const target = step.choices[0]?.to;
      step = steps.find((targetStep) => targetStep.id === target);
    }
    setAt('');
    setChat(lines);
  }
  const width = Math.max(1100, ...steps.map((step) => step.x + 225)),
    height = Math.max(640, ...steps.map((step) => step.y + 115));
  return (
    <main className="studio">
      <nav className="studio-route-links"><Link className="studio-back" href="/businesses">← {t("My workspace", "Mi espacio")}</Link><Link className="studio-back" href="/whatsapp">{t("WhatsApp setup", "Configurar WhatsApp")} ↗</Link></nav>
      <header>
        <div>
          <h1>{t("Flow studio", "Estudio de flujos")}</h1>
          <p>
            {t('Business drafts and immutable published versions. WhatsApp execution is not connected.', 'Borradores por negocio y versiones publicadas inmutables. La ejecución de WhatsApp no está conectada.')}
          </p>
        </div>
        <button
          disabled={!editable}
          onClick={() => {
            if (
              !steps.length ||
              window.confirm(t('Replace this draft with the example?', '¿Reemplazar este borrador por el ejemplo?'))
            ) {
              edit(example.map(step => ({ ...step, text: translate(step.text), choices: step.choices.map(choice => ({ ...choice, label: translate(choice.label) })) })));
              select('b');
            }
          }}
        >
          {t("Load example", "Cargar ejemplo")}
        </button>
      </header>
      <section className="flow-manager" aria-label={t('Server flow management', 'Gestión de flujos en el servidor')}>
        <div className="flow-manager-fields">
          <label>{t('Business', 'Negocio')}<select value={persistence.businessId} disabled={persistence.busy || persistence.loading} onChange={event => void persistence.chooseBusiness(event.target.value)}><option value="">{t('Choose a business', 'Elige un negocio')}</option>{persistence.businesses.map(business => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label>
          <label>{t('Flow', 'Flujo')}<select value={persistence.flow?.id ?? ''} disabled={!ready || persistence.busy} onChange={event => void persistence.loadFlow(event.target.value)}><option value="">{t('New flow', 'Flujo nuevo')}</option>{persistence.flows.map(flow => <option key={flow.id} value={flow.id}>{flow.name}</option>)}</select></label>
          <label>{t('Flow name', 'Nombre del flujo')}<input value={persistence.name} maxLength={100} disabled={!editable || persistence.busy} onChange={event => persistence.setName(event.target.value)} /></label>
        </div>
        <div className="flow-manager-actions">
          <button disabled={!editable || persistence.busy || !persistence.dirty && !!persistence.flow} onClick={() => void persistence.save()}>{persistence.busy ? t('Please wait…', 'Espera…') : t('Save draft', 'Guardar borrador')}</button>
          <button disabled={!editable || persistence.busy || !persistence.flow || persistence.dirty} onClick={() => void persistence.publish()}>{t('Publish version', 'Publicar versión')}</button>
          {persistence.flow && <button className="secondary-button" disabled={!editable || persistence.busy} onClick={persistence.newCopy}>{t('Copy into a new flow', 'Copiar a un flujo nuevo')}</button>}
          {persistence.flow && <button className="secondary-button" disabled={!ready || persistence.busy} onClick={() => void persistence.loadFlow(persistence.flow!.id)}>{t('Reload server draft', 'Recargar borrador del servidor')}</button>}
        </div>
        <p role="status">{persistence.loading ? t('Loading…', 'Cargando…') : !persistence.businessId ? t('Choose a business to create or open a flow.', 'Elige un negocio para crear o abrir un flujo.') : persistence.dirty ? t('Unsaved changes', 'Cambios sin guardar') : persistence.flow ? t('Draft matches server', 'El borrador coincide con el servidor') : t('New empty draft', 'Nuevo borrador vacío')}{persistence.flow && ` · ${t('Revision', 'Revisión')} ${persistence.flow.revision} · ${t('Published version', 'Versión publicada')} ${persistence.flow.publishedVersion ?? '—'}`}</p>
        {persistence.flow && persistence.dirty && <p>{t('Save your changes before publishing. Published versions never change.', 'Guarda los cambios antes de publicar. Las versiones publicadas nunca cambian.')}</p>}
        {persistence.businessId && !persistence.writable && <p>{t('Your operator role can view flows but cannot save or publish.', 'Tu rol de operador puede ver flujos pero no guardar ni publicar.')}</p>}
        {!persistence.loading && !persistence.businesses.length && <p><Link href="/businesses">{t('Create a business to get started', 'Crea un negocio para empezar')} →</Link></p>}
        {persistence.localDraft && <button className="secondary-button" disabled={!editable || persistence.busy} onClick={persistence.importLocal}>{t('Import original browser draft', 'Importar borrador original del navegador')}</button>}
        {persistence.recovery && <button className="secondary-button" disabled={!editable || persistence.busy} onClick={persistence.restore}>{t('Restore unsaved device copy', 'Restaurar copia local sin guardar')}</button>}
        {persistence.storageError && <p role="alert">{t('Device recovery storage is unavailable. Keep this page open until you save.', 'La recuperación local no está disponible. Mantén esta página abierta hasta guardar.')}</p>}
        {persistence.error && <p className="form-feedback" role="alert">{persistence.error}</p>}
        {persistence.notice && <p role="status">{persistence.notice}</p>}
      </section>
      <fieldset className="flow-editor" disabled={!ready}>
      <div className="tools" aria-label={t("Add steps", "Agregar pasos")}>
        {kinds.map((k) => (
          <button key={k} disabled={!editable || steps.length >= 200} onClick={() => add(k)}>
            + {kindLabel(k)}
          </button>
        ))}
      </div>
      <div className="studio-workspace"><div className="board">
        <div style={{ width, height, position: 'relative' }}>
          {!steps.length && (
            <p className="hint">
              {t("Add a Start step or load the example to try a conversation.", "Agrega un paso de inicio o carga el ejemplo para probar una conversación.")}
            </p>
          )}
          <svg width={width} height={height} aria-hidden="true">
            <defs>
              <marker
                id="arrow"
                markerWidth="8"
                markerHeight="8"
                refX="8"
                refY="4"
                orient="auto"
              >
                <path d="M0 0 L8 4 L0 8" fill="var(--tourmaline)" />
              </marker>
            </defs>
            {steps.flatMap((step) =>
              step.choices.map((choice, i) => {
                const targetStep = steps.find((item) => item.id === choice.to);
                return (
                  targetStep && (
                    <path
                      key={step.id + i}
                      d={`M${step.x + 185} ${step.y + 32} C${step.x + 228} ${step.y + 32}, ${targetStep.x - 45} ${targetStep.y + 32}, ${targetStep.x} ${targetStep.y + 32}`}
                      stroke="var(--tourmaline)"
                      fill="none"
                      markerEnd="url(#arrow)"
                    />
                  )
                );
              }),
            )}
          </svg>
          {steps.map((step, i) => (
            <button
              key={step.id}
              className="node"
              style={{ left: step.x, top: step.y }}
              aria-pressed={step.id === selected}
              onClick={() => select(step.id)}
              onPointerDown={(e) => {
                select(step.id);
                if (!editable) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = {
                  id: step.id,
                  x: e.clientX,
                  y: e.clientY,
                  left: step.x,
                  top: step.y,
                };
              }}
              onPointerMove={(e) => {
                const dragState = drag.current;
                if (dragState?.id === step.id)
                  setSteps((prev) =>
                    prev.map((item) =>
                      item.id === dragState.id
                        ? {
                            ...item,
                            x: Math.max(
                              0,
                              dragState.left + e.clientX - dragState.x,
                            ),
                            y: Math.max(
                              0,
                              dragState.top + e.clientY - dragState.y,
                            ),
                          }
                        : item,
                    ),
                  );
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onLostPointerCapture={() => {
                drag.current = null;
              }}
            >
              <small>
                {i + 1} · {kindLabel(step.kind)}
              </small>
              <strong>{step.text}</strong>
            </button>
          ))}
        </div>
      </div>
      <div className="panels">
        <article>
          <fieldset className="flow-editor" disabled={!editable}><h2>{t("Step settings", "Ajustes del paso")}</h2>
          {active ? (
            <>
              <label>
                {t("Step text", "Texto del paso")}
                <input
                  maxLength={4000} value={active.text}
                  onChange={(e) => patch({ text: e.target.value })}
                />
              </label>
              {active.choices.map((choice, i) => (
                <div className="edge" key={i}>
                  {active.kind === 'Menu' && (
                    <label>
                      {t("Reply", "Respuesta")} {i + 1}
                      <input
                        maxLength={200} value={choice.label}
                        onChange={(e) =>
                          patch({
                            choices: active.choices.map((item, j) =>
                              j === i
                                ? { ...item, label: e.target.value }
                                : item,
                            ),
                          })
                        }
                      />
                    </label>
                  )}
                  <label>
                    {t("Go to", "Ir a")}
                    <select
                      value={choice.to}
                      onChange={(e) =>
                        patch({
                          choices: active.choices.map((item, j) =>
                            j === i ? { ...item, to: e.target.value } : item,
                          ),
                        })
                      }
                    >
                      <option value="">{t("Choose a step", "Elige un paso")}</option>
                      {steps.map((step, j) => (
                        <option key={step.id} value={step.id}>
                          {j + 1} · {step.text}
                        </option>
                      ))}
                    </select>
                  </label>
                  {active.kind === 'Menu' && (
                    <button
                      onClick={() =>
                        patch({
                          choices: active.choices.filter((_, j) => j !== i),
                        })
                      }
                    >
                      {t("Remove reply", "Eliminar respuesta")} {i + 1}
                    </button>
                  )}
                </div>
              ))}
              {active.kind === 'Menu' && (
                <button
                  onClick={() =>
                    patch({
                      choices: [
                        ...active.choices,
                        { label: t('New reply', 'Nueva respuesta'), to: '' },
                      ],
                    })
                  }
                >
                  {t("Add reply", "Agregar respuesta")}
                </button>
              )}
              <button
                onClick={() => {
                  edit(
                    steps
                      .filter((step) => step.id !== active.id)
                      .map((step) => ({
                        ...step,
                        choices: step.choices.map((choice) =>
                          choice.to === active.id
                            ? { ...choice, to: '' }
                            : choice,
                        ),
                      })),
                  );
                  select('');
                }}
              >
                {t("Delete step", "Eliminar paso")}
              </button>
            </>
          ) : (
            <p>{t("Select a step on the canvas to edit it.", "Selecciona un paso en el lienzo para editarlo.")}</p>
          )}
        </fieldset></article>
        <article>
          <h2>{t("Customer preview", "Vista del cliente")}</h2>
          <button
            onClick={() => {
              const issue = validateFlow(steps);
              setError(issue);
              if (!issue) play(steps.find((step) => step.kind === 'Start')!.id);
            }}
          >
            {chat.length ? t('Restart preview', 'Reiniciar vista') : t('Run preview', 'Probar flujo')}
          </button>
          {error && <p role="alert">{translate(error)}</p>}
          <div aria-live="polite">
            {chat.map((l, i) => (
              <p className={l.user ? 'reply' : 'bubble'} key={i}>
                {l.text}
              </p>
            ))}
            {current?.kind === 'Menu' &&
              current.choices.map((choice, i) => (
                <button key={i} onClick={() => play(choice.to, choice.label)}>
                  {choice.label}
                </button>
              ))}
            {current?.kind === 'End' && <small>{t("Conversation ended", "Conversación finalizada")}</small>}
          </div>
        </article>
      </div>
      </div></fieldset></main>
  );
}
