'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import './flows.css';

import {
  example,
  key,
  kinds,
  validateFlow,
  validDraft,
  type Step,
  type Kind,
} from './flow-model';
export default function Playground() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [selected, select] = useState('');
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
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
  useEffect(() => {
    let loaded: Step[] = [];
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? '[]');
      if (validDraft(saved)) loaded = saved;
    } catch {}
    queueMicrotask(() => {
      setSteps(loaded);
      select(loaded[0]?.id ?? '');
      setReady(true);
    });
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(key, JSON.stringify(steps));
      queueMicrotask(() => setStorageError(false));
    } catch {
      queueMicrotask(() => setStorageError(true));
    }
  }, [steps, ready]);
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
      text: kind === 'Menu' ? 'Choose an option' : kind,
      x: 25 + (steps.length % 4) * 245,
      y: 35 + Math.floor(steps.length / 4) * 145,
      choices:
        kind === 'End'
          ? []
          : [{ label: kind === 'Menu' ? 'Option 1' : 'Next', to: '' }],
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
  const width = Math.max(600, ...steps.map((step) => step.x + 225)),
    height = Math.max(280, ...steps.map((step) => step.y + 115));
  return (
    <main className="studio">
      <Link href="/">← Home</Link>
      <header>
        <div>
          <h1>Flow playground</h1>
          <p>
            {storageError
              ? 'Browser storage unavailable.'
              : 'Draft saved on this device'}
          </p>
        </div>
        <button
          disabled={!ready}
          onClick={() => {
            if (
              !steps.length ||
              window.confirm('Replace this draft with the example?')
            ) {
              edit(example);
              select('b');
            }
          }}
        >
          Load example
        </button>
      </header>
      <div className="tools" aria-label="Add steps">
        {kinds.map((k) => (
          <button key={k} disabled={!ready} onClick={() => add(k)}>
            + {k}
          </button>
        ))}
      </div>
      <div className="board">
        <div style={{ width, height, position: 'relative' }}>
          {!steps.length && (
            <p className="hint">
              Add a Start step or load the example to try a conversation.
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
                      d={`M${step.x + 185} ${step.y + 32} choice${step.x + 228} ${step.y + 32}, ${targetStep.x - 45} ${targetStep.y + 32}, ${targetStep.x} ${targetStep.y + 32}`}
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
                {i + 1} · {step.kind}
              </small>
              <strong>{step.text}</strong>
            </button>
          ))}
        </div>
      </div>
      <div className="panels">
        <article>
          <h2>Step settings</h2>
          {active ? (
            <>
              <label>
                Step text
                <input
                  value={active.text}
                  onChange={(e) => patch({ text: e.target.value })}
                />
              </label>
              {active.choices.map((choice, i) => (
                <div className="edge" key={i}>
                  {active.kind === 'Menu' && (
                    <label>
                      Reply {i + 1}
                      <input
                        value={choice.label}
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
                    Go to
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
                      <option value="">Choose a step</option>
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
                      Remove reply {i + 1}
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
                        { label: 'New reply', to: '' },
                      ],
                    })
                  }
                >
                  Add reply
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
                Delete step
              </button>
            </>
          ) : (
            <p>Select a step on the canvas to edit it.</p>
          )}
        </article>
        <article>
          <h2>Customer preview</h2>
          <button
            onClick={() => {
              const issue = validateFlow(steps);
              setError(issue);
              if (!issue) play(steps.find((step) => step.kind === 'Start')!.id);
            }}
          >
            {chat.length ? 'Restart preview' : 'Run preview'}
          </button>
          {error && <p role="alert">{error}</p>}
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
            {current?.kind === 'End' && <small>Conversation ended</small>}
          </div>
        </article>
      </div>
    </main>
  );
}
