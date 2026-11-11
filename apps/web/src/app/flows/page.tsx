'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import './flows.css';

type Kind = 'Start' | 'Message' | 'Menu' | 'End';
type Choice = { label: string; to: string };
type Step = { id: string; kind: Kind; text: string; x: number; y: number; choices: Choice[] };
const kinds: Kind[] = ['Start','Message','Menu','End'];
const key = 'wa.playground.v1';
const example: Step[] = [
  { id:'a', kind:'Start', text:'Welcome', x:25,y:35, choices:[{label:'Next',to:'b'}] },
  { id:'b', kind:'Menu', text:'How can we help?', x:270,y:35, choices:[{label:'Store hours',to:'c'},{label:'Pickup',to:'d'}] },
  { id:'c', kind:'Message', text:'We open at 9 AM.', x:520,y:35, choices:[{label:'Next',to:'e'}] },
  { id:'d', kind:'Message', text:'Pickup is available at the counter.', x:520,y:180, choices:[{label:'Next',to:'e'}] },
  { id:'e', kind:'End', text:'See you soon!', x:770,y:90, choices:[] },
];
function check(steps: Step[]) {
  const start = steps.filter(s => s.kind === 'Start');
  if (start.length !== 1) return 'Add exactly one Start step.';
  for (const s of steps) {
    if (!s.text.trim()) return 'Give each step some text.';
    if (s.kind === 'Menu' && !s.choices.length) return 'Add a reply to each menu.';
    if (s.choices.some(c => !c.label.trim() || !steps.some(t => t.id === c.to))) return 'Connect each outgoing reply and give it a label.';
  }
  const reachable = new Set([start[0]!.id]);
  for (const id of reachable) steps.find(s => s.id === id)?.choices.forEach(c => reachable.add(c.to));
  if (reachable.size !== steps.length) return 'Connect every step to the path from Start.';
  const finish = new Set(steps.filter(s => s.kind === 'End').map(s => s.id));
  for (let i=0;i<steps.length;i++) for (const s of steps) if (s.choices.some(c => finish.has(c.to))) finish.add(s.id);
  if (finish.size !== steps.length) return 'Each step needs a path to an End.';
  return '';
}
function validDraft(value: unknown): value is Step[] {
  return Array.isArray(value) && value.every(s => s && kinds.includes(s.kind) && typeof s.id === 'string' && typeof s.text === 'string' && Number.isFinite(s.x) && Number.isFinite(s.y) && Array.isArray(s.choices) && s.choices.every((c:Choice) => c && typeof c.label === 'string' && typeof c.to === 'string'));
}
export default function Playground() {
  const [steps,setSteps] = useState<Step[]>([]);
  const [selected,select] = useState('');
  const [ready,setReady] = useState(false);
  const [storageError,setStorageError] = useState(false);
  const [error,setError] = useState('');
  const [chat,setChat] = useState<{text:string;user?:boolean}[]>([]);
  const [at,setAt] = useState('');
  const drag = useRef<{id:string;x:number;y:number;left:number;top:number}|null>(null);
  useEffect(() => {
    let loaded: Step[] = [];
    try { const saved = JSON.parse(localStorage.getItem(key) ?? '[]'); if(validDraft(saved)) loaded=saved; } catch {}
    queueMicrotask(() => {setSteps(loaded); select(loaded[0]?.id ?? ''); setReady(true);});
  },[]);
  useEffect(() => {
    if (!ready) return;
    try {localStorage.setItem(key,JSON.stringify(steps)); queueMicrotask(()=>setStorageError(false));} catch {queueMicrotask(()=>setStorageError(true));}
  },[steps,ready]);
  const active=steps.find(s=>s.id===selected);
  const current=steps.find(s=>s.id===at);
  function edit(next:Step[]) {setSteps(next);setError('');setChat([]);setAt('');}
  function patch(change:Partial<Step>) {edit(steps.map(s=>s.id===selected?{...s,...change}:s));}
  function add(kind:Kind) {
    const s:Step={id:crypto.randomUUID(),kind,text:kind==='Menu'?'Choose an option':kind,x:25+(steps.length%4)*245,y:35+Math.floor(steps.length/4)*145,choices:kind==='End'?[]:[{label:kind==='Menu'?'Option 1':'Next',to:''}]};
    edit([...steps,s]);select(s.id);
  }
  function play(id:string, reply?:string) {
    const lines=reply?[...chat,{text:reply,user:true}]:[];
    const seen=new Set<string>();
    let s=steps.find(t=>t.id===id);
    while(s){
      if(seen.has(s.id)){setError('This path loops before the customer can reply. Change a connection and try again.');break;}
      seen.add(s.id);
      if(s.kind!=='Start')lines.push({text:s.text});
      if(s.kind==='Menu'||s.kind==='End'){setAt(s.id);setChat(lines);return;}
      const target=s.choices[0]?.to; s=steps.find(t=>t.id===target);
    }
    setAt('');setChat(lines);
  }
  const width=Math.max(600,...steps.map(s=>s.x+225)), height=Math.max(280,...steps.map(s=>s.y+115));
  return <main className="studio"><Link href="/">← Home</Link><header><div><h1>Flow playground</h1><p>{storageError?'Browser storage unavailable.': 'Draft saved on this device'}</p></div><button disabled={!ready} onClick={()=>{if(!steps.length || window.confirm('Replace this draft with the example?')){edit(example);select('b');}}}>Load example</button></header>
    <div className="tools" aria-label="Add steps">{kinds.map(k=><button key={k} disabled={!ready} onClick={()=>add(k)}>+ {k}</button>)}</div>
    <div className="board"><div style={{width,height,position:'relative'}}>
    {!steps.length && <p className="hint">Add a Start step or load the example to try a conversation.</p>}
    <svg width={width} height={height} aria-hidden="true"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8" fill="var(--tourmaline)"/></marker></defs>{steps.flatMap(s=>s.choices.map((c,i)=>{const t=steps.find(v=>v.id===c.to);return t && <path key={s.id+i} d={`M${s.x+185} ${s.y+32} C${s.x+228} ${s.y+32}, ${t.x-45} ${t.y+32}, ${t.x} ${t.y+32}`} stroke="var(--tourmaline)" fill="none" markerEnd="url(#arrow)"/>;}))}</svg>
    {steps.map((s,i)=><button key={s.id} className="node" style={{left:s.x,top:s.y}} aria-pressed={s.id===selected} onClick={()=>select(s.id)}
      onPointerDown={e=>{select(s.id);e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:s.id,x:e.clientX,y:e.clientY,left:s.x,top:s.y};}}
      onPointerMove={e=>{const d=drag.current;if(d?.id===s.id)setSteps(prev=>prev.map(v=>v.id===d.id?{...v,x:Math.max(0,d.left+e.clientX-d.x),y:Math.max(0,d.top+e.clientY-d.y)}:v));}}
      onPointerUp={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}><small>{i+1} · {s.kind}</small><strong>{s.text}</strong></button>)}</div></div>
    <div className="panels"><article><h2>Step settings</h2>{active?<><label>Step text<input value={active.text} onChange={e=>patch({text:e.target.value})}/></label>
    {active.choices.map((c,i)=><div className="edge" key={i}>{active.kind==='Menu' && <label>Reply {i+1}<input value={c.label} onChange={e=>patch({choices:active.choices.map((v,j)=>j===i?{...v,label:e.target.value}:v)})}/></label>}
    <label>Go to<select value={c.to} onChange={e=>patch({choices:active.choices.map((v,j)=>j===i?{...v,to:e.target.value}:v)})}><option value="">Choose a step</option>{steps.map((s,j)=><option key={s.id} value={s.id}>{j+1} · {s.text}</option>)}</select></label>
    {active.kind==='Menu' && <button onClick={()=>patch({choices:active.choices.filter((_,j)=>j!==i)})}>Remove reply {i+1}</button>}</div>)}
    {active.kind==='Menu' && <button onClick={()=>patch({choices:[...active.choices,{label:'New reply',to:''}]})}>Add reply</button>}
    <button onClick={()=>{edit(steps.filter(s=>s.id!==active.id).map(s=>({...s,choices:s.choices.map(c=>c.to===active.id?{...c,to:''}:c)})));select('');}}>Delete step</button></>:<p>Select a step on the canvas to edit it.</p>}</article>
    <article><h2>Customer preview</h2><button onClick={()=>{const issue=check(steps);setError(issue);if(!issue)play(steps.find(s=>s.kind==='Start')!.id);}}>{chat.length?'Restart preview':'Run preview'}</button>
    {error && <p role="alert">{error}</p>}<div aria-live="polite">{chat.map((l,i)=><p className={l.user?'reply':'bubble'} key={i}>{l.text}</p>)}{current?.kind==='Menu'&&current.choices.map((c,i)=><button key={i} onClick={()=>play(c.to,c.label)}>{c.label}</button>)}{current?.kind==='End'&&<small>Conversation ended</small>}</div></article></div></main>;
}
