'use client';
import { useState } from 'react';
import { parseFlowDefinition, type FlowNodeConfig, type FlowStepKind } from '@wa/contracts';
export function defaultConfig(kind:FlowStepKind):FlowNodeConfig|undefined {
 switch(kind){
 case 'Input':return {variable:'customer_name',inputType:'text',required:true};
 case 'Set':return {variable:'value',value:''};
 case 'Calculate':return {variable:'total',expression:{op:'add',args:[{var:'subtotal'},{var:'shipping'}]}};
 case 'Condition':return {condition:{left:{var:'location'},operator:'eq',right:'local'}};
 case 'Document':return {url:'https://example.com/catalog.pdf',filename:'catalog.pdf'};
 case 'Image':return {url:'https://example.com/product.jpg'};
 case 'Catalog':return {variable:'product',products:[{id:'shirt',name:'Shirt',price:50000}]};
 case 'Cart':return {cartOperation:'add',quantity:1};
 case 'Order':return {confirmation:'automatic',fields:{name:{var:'customer_name'},total:{var:'total'}}};
 case 'Notify':case 'Handoff':return {notificationChannel:'inbox',recipient:'owner',message:'Customer {{customer_name}} needs attention.'};
 default:return undefined;
 }
}
const descriptions:Partial<Record<FlowStepKind,string>>={Input:'Save a customer answer to a variable. Choose the data and validation your business needs.',Set:'Assign a literal value or variable expression.',Calculate:'Use add, subtract, multiply, or divide with numeric values and variables. No executable code.',Condition:'The first connection is true; the second is false.',Document:'Send a publicly reachable HTTPS PDF/document.',Image:'Send a publicly reachable HTTPS image.',Catalog:'Define available products and prices. The business controls availability.',Cart:'Add or remove a selected product, or clear the cart.',Order:'Choose automatic confirmation or human approval and select the data to persist.',Notify:'Notify the business owner or responsible advisor in the workspace or on WhatsApp.',Handoff:'Pause the bot and notify the responsible operator. The connection is the continuation after controlled resumption.'};
export function NodeConfigEditor({kind,config,onChange,onValidity}:{kind:FlowStepKind;config?:FlowNodeConfig;onChange:(c:FlowNodeConfig)=>void;onValidity:(valid:boolean)=>void}){
 const [raw,setRaw]=useState(()=>JSON.stringify(config??defaultConfig(kind)??{},null,2));
 const [error,setError]=useState('');
 const update=(change:Partial<FlowNodeConfig>)=>{const next={...config,...change};onChange(next);setRaw(JSON.stringify(next,null,2));setError('');onValidity(true);};
 if(!descriptions[kind])return null;
 return <section className="node-config"><p>{descriptions[kind]}</p>
 {['Input','Set','Calculate','Catalog'].includes(kind)&&<label>Variable<input value={config?.variable??''} maxLength={80} onChange={e=>update({variable:e.target.value})}/></label>}
 {kind==='Input'&&<><label>Answer type<select value={config?.inputType??'text'} onChange={e=>update({inputType:e.target.value as FlowNodeConfig['inputType']})}>{['text','number','email','phone'].map(v=><option key={v}>{v}</option>)}</select></label><label><input type="checkbox" checked={config?.required??false} onChange={e=>update({required:e.target.checked})}/>Required answer</label>{(['min','max'] as const).map(field=><label key={field}>{field==='min'?'Minimum':'Maximum'} length/value<input type="number" value={config?.[field]??''} onChange={e=>update({[field]:e.target.value===''?undefined:Number(e.target.value)})}/></label>)}</>}
 {['Document','Image'].includes(kind)&&<><label>Media URL<input type="url" value={config?.url??''} onChange={e=>update({url:e.target.value})}/></label>{kind==='Document'&&<label>Filename<input value={config?.filename??''} onChange={e=>update({filename:e.target.value})}/></label>}</>}
 {kind==='Order'&&<label>Confirmation<select value={config?.confirmation??'automatic'} onChange={e=>update({confirmation:e.target.value as 'automatic'|'human'})}><option value="automatic">Automatic</option><option value="human">Human approval</option></select></label>}
 {['Notify','Handoff'].includes(kind)&&<>
 <label>Send notification to<select value={config?.notificationChannel??'inbox'} onChange={e=>update({notificationChannel:e.target.value as 'inbox'|'whatsapp',recipient:e.target.value==='inbox'?'owner':'',...(e.target.value==='whatsapp'?{templateLanguage:config?.templateLanguage??'en_US'}:{})})}><option value="inbox">Business workspace</option><option value="whatsapp">Owner or advisor WhatsApp</option></select></label>
 {config?.notificationChannel==='whatsapp'?<>
 <label>Owner or advisor phone<input type="tel" autoComplete="off" placeholder="+573001234567" pattern="\+[1-9][0-9]{6,14}" value={config?.recipient??''} onChange={e=>update({recipient:e.target.value})}/></label>
 <p>Use a phone number that agreed to receive these alerts. Configure an approved WhatsApp message template with one body field for the notification below.</p>
 <label>Approved template name<input placeholder="advisor_notification" value={config?.templateName??''} maxLength={512} onChange={e=>update({templateName:e.target.value})}/></label>
 <label>Template language<input placeholder="en_US" value={config?.templateLanguage??''} maxLength={16} onChange={e=>update({templateLanguage:e.target.value})}/></label>
 </>:<label>Workspace recipient<input value={config?.recipient??'owner'} onChange={e=>update({recipient:e.target.value})}/></label>}
 <label>Notification text<textarea value={config?.message??''} maxLength={config?.notificationChannel==='whatsapp'?1024:4000} onChange={e=>update({message:e.target.value})}/></label>
 </>}
 {kind==='Cart'&&<label>Operation<select value={config?.cartOperation??'add'} onChange={e=>update({cartOperation:e.target.value as 'add'|'remove'|'clear'})}>{['add','remove','clear'].map(v=><option key={v}>{v}</option>)}</select></label>}
 <label>Configuration JSON<textarea rows={12} spellCheck={false} value={raw} onChange={e=>{const value=e.target.value;setRaw(value);try{const parsed:unknown=JSON.parse(value);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Use a JSON object.');const definition=parseFlowDefinition({schemaVersion:1,name:'Node',steps:[{id:'config',kind,text:'',x:0,y:0,choices:[],config:parsed}]});onChange(definition.steps[0]!.config!);setError('');onValidity(true);}catch{setError('Invalid JSON or node configuration. Fix it before saving or changing steps.');onValidity(false);}}}/></label>
 <small>Variables: {'{{customer_name}}'}. Expressions: {'{"var":"shipping"}'} or {'{"op":"add","args":[1000,{"var":"shipping"}]}'}.</small>{error&&<p role="alert">{error}</p>}
 </section>
}
