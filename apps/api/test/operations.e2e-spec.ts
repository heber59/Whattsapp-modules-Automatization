import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { NotificationSenderService } from '../src/modules/whatsapp/notification-sender.service';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { FlowStep } from '@wa/contracts';
import { DatabaseService } from '../src/shared/database/database.service';
import { migrate } from '../src/shared/database/migrate';
import { FlowsService } from '../src/modules/flows/flows.service';
import { BusinessesService } from '../src/modules/businesses/businesses.service';
import { OperationsService } from '../src/modules/operations/operations.service';
import { WhatsAppRuntimeService } from '../src/modules/whatsapp/whatsapp-runtime.service';
import { WhatsAppSenderService } from '../src/modules/whatsapp/whatsapp-sender.service';
import { MetaGateway } from '../src/modules/whatsapp/meta.gateway';

test('Flow operations persist custom fields, ordered media, approval and safe human recovery', { timeout: 30000 }, async () => {
  const url = process.env.DATABASE_URL!;
  assert(['localhost','127.0.0.1'].includes(new URL(url).hostname));
  await migrate(url);
  const user = randomUUID(), business = randomUUID(), flow = randomUUID();
  const phone = String(Date.now()), sender = '573001234567';
  const settings = new ConfigService({ DATABASE_URL: url,META_PHONE_NUMBER_ID:phone,META_BUSINESS_ID:business });
  const db = new DatabaseService(settings);
  let externalMode: 'ok' | 'rate' | 'disconnect' = 'rate';
  const externalMessages: Record<string,unknown>[] = [];
  const provider = createServer(async (request,response) => {
    let raw=''; for await (const chunk of request) raw += String(chunk);
    externalMessages.push(JSON.parse(raw));
    if (externalMode === 'disconnect') { request.socket.destroy(); return; }
    response.setHeader('Content-Type','application/json');
    if (externalMode === 'rate') { response.writeHead(429).end('{}'); return; }
    response.end(JSON.stringify({messages:[{id:'alert.'+randomUUID()}]}));
  });
  await new Promise<void>(resolve => provider.listen(0,'127.0.0.1',resolve));
  settings.set('META_GRAPH_ORIGIN','http://127.0.0.1:'+(provider.address() as AddressInfo).port);
  settings.set('META_GRAPH_VERSION','v23.0'); settings.set('META_ACCESS_TOKEN','simulator-token');
  const externalGateway = new MetaGateway(settings);
  const alerts = new NotificationSenderService(db,settings,externalGateway);
  const step = (id: string, kind: FlowStep['kind'], text: string, next?: string, config?: FlowStep['config']): FlowStep => ({ id,kind,text,x:0,y:0,choices:next ? [{label:'Next',to:next}] : [],config });
  const steps: FlowStep[] = [step('start','Start','Welcome','name'),step('name','Input','Your name?','pdf',{variable:'name',required:true}),
    step('pdf','Document','Shirts','price',{url:'https://example.com/shirts.pdf',filename:'shirts.pdf'}),
    step('price','Calculate','Total','order',{variable:'total',expression:{op:'add',args:[45000,5000]}}),
    step('order','Order','Awaiting approval','notify',{confirmation:'human',fields:{name:{var:'name'},total:{var:'total'}}}),
    step('notify','Notify','Approved {{name}}','end',{recipient:'+573009998877',message:'Order for {{name}}',notificationChannel:'whatsapp',templateName:'owner_order_alert',templateLanguage:'es_CO'}),step('end','End','Confirmed {{name}}')];
  const flows = { publishedSnapshot: async () => ({steps}) } as unknown as FlowsService;
  let role = 'owner';
  const businesses = { find: async (_principal: unknown, id: string) => { assert.equal(id,business); return {role}; } } as unknown as BusinessesService;
  const operations = new OperationsService(db,businesses);
  const principal = {subject:user,email:null};
  const runtime = new WhatsAppRuntimeService(db,flows,settings);
  const sends: {text:string;media:unknown}[] = [];
  const gateway = { send: async (_phone: string,_recipient: string,text: string,media:unknown) => { sends.push({text,media}); return {state:'sent',id:'provider.'+randomUUID()}; } } as unknown as MetaGateway;
  const senderService = new WhatsAppSenderService(db,settings,gateway);
  try {
    await db.query('INSERT INTO app.users(id,auth_user_id) VALUES($1,$1)', [user]);
    await db.query("INSERT INTO app.businesses(id,name,created_by) VALUES($1,'Operations fixture',$2)", [business,user]);
    await db.query("INSERT INTO app.flows(id,business_id,name,steps) VALUES($1,$2,'Fixture',$3)", [flow,business,JSON.stringify(steps)]);
    await db.query("INSERT INTO app.flow_versions(business_id,flow_id,version,source_revision,name,steps) VALUES($1,$2,1,1,'Fixture',$3)", [business,flow,JSON.stringify(steps)]);
    await db.query('INSERT INTO app.whatsapp_channels(phone_number_id,business_id,flow_id,version) VALUES($1,$2,$3,1)', [phone,business,flow]);
    const inbound = async (text: string) => { await db.query('INSERT INTO app.whatsapp_inbox(id,phone_number_id,sender,text,sent_at) VALUES($1,$2,$3,$4,now())', [randomUUID(),phone,sender,text]); await runtime.processOne(); };
    await inbound('Hello'); await senderService.sendOne();
    assert.match(sends[0]!.text,/Your name/);
    await inbound('Ana');
    let snapshot = await operations.snapshot(principal,business);
    assert.equal(snapshot.orders.length,1);
    assert.equal(snapshot.orders[0]!.state,'pending_approval');
    assert.equal(snapshot.orders[0]!.total,50000);
    assert.equal(snapshot.orders[0]!.data.name,'Ana');
    await assert.rejects(operations.action(principal,business,{type:'resume',sender}), /Decide pending orders/);
    await operations.action(principal,business,{type:'pause',sender});
    assert.equal(await senderService.sendOne(),false, 'Manual pause blocks queued bot notices and media');
    await db.query('UPDATE app.whatsapp_conversations SET operator_paused=false WHERE business_id=$1', [business]);
    while (await senderService.sendOne()) { /* Drain persisted outbound actions. */ }
    assert(sends.some(send => (send.media as {type?:string})?.type === 'document'));
    await operations.action(principal,business,{type:'confirm_order',id:snapshot.orders[0]!.id});
    await runtime.processOne();
    snapshot = await operations.snapshot(principal,business);
    assert.equal(snapshot.orders.length,1); assert.equal(snapshot.orders[0]!.state,'confirmed');
    assert.equal(snapshot.notifications[0]!.text,'Order for Ana');
    assert.equal(snapshot.notifications[0]!.deliveryState,'pending');
    await alerts.sendOne();
    assert.equal((await operations.snapshot(principal,business)).notifications[0]!.deliveryState,'retry');
    assert.deepEqual(externalMessages[0], {messaging_product:'whatsapp',recipient_type:'individual',to:'573009998877',type:'template',template:{name:'owner_order_alert',language:{code:'es_CO'},components:[{type:'body',parameters:[{type:'text',text:'Order for Ana'}]}]}});
    externalMode='ok';
    await db.query('UPDATE app.operation_notifications SET available_at=now() WHERE business_id=$1', [business]);
    await new NotificationSenderService(db,settings,externalGateway).sendOne();
    assert.equal((await operations.snapshot(principal,business)).notifications[0]!.deliveryState,'sent');
    assert.equal(await alerts.sendOne(),false);
    await db.query(`INSERT INTO app.operation_notifications(business_id,sender,inbox_id,step_id,recipient,text,delivery_state,payload) SELECT business_id,sender,inbox_id,'uncertain_alert',recipient,text,'pending',payload FROM app.operation_notifications WHERE business_id=$1 LIMIT 1`, [business]);
    externalMode='disconnect'; await alerts.sendOne();
    snapshot=await operations.snapshot(principal,business);
    const uncertainAlert=snapshot.notifications.find(notification => notification.deliveryState === 'manual_review')!;
    assert(uncertainAlert); assert.equal(await alerts.sendOne(),false);
    role='operator';
    await assert.rejects(operations.action(principal,business,{type:'notification_review_discard',id:uncertainAlert.id}), /Owners or administrators/);
    role='owner';
    await operations.action(principal,business,{type:'notification_review_discard',id:uncertainAlert.id});
    assert.equal((await operations.snapshot(principal,business)).notifications.find(notification => notification.id === uncertainAlert.id)!.deliveryState,'discarded');
    while (await senderService.sendOne()) { /* Drain confirmation. */ }
    assert(sends.some(send => /Confirmed Ana/.test(send.text)));
    await operations.action(principal,business,{type:'reply',sender,text:'Advisor here'});
    await inbound('Thanks');
    assert.equal((await operations.snapshot(principal,business)).conversations[0]!.operatorPaused,true);
    await senderService.sendOne(); assert.equal(sends.at(-1)!.text,'Advisor here');
    await db.query(`UPDATE app.whatsapp_outbox SET state='manual_review' WHERE id=(SELECT id FROM app.whatsapp_outbox WHERE phone_number_id=$1 ORDER BY created_at DESC LIMIT 1)`, [phone]);
    await assert.rejects(operations.action(principal,business,{type:'resume',sender}), /Resolve uncertain/);
    snapshot = await operations.snapshot(principal,business);
    role = 'operator';
    await assert.rejects(operations.action(principal,business,{type:'review_discard',id:snapshot.deliveries[0]!.id}), /Owners or administrators/);
    role = 'owner';
    await operations.action(principal,business,{type:'review_discard',id:snapshot.deliveries[0]!.id});
    await operations.action(principal,business,{type:'resume',sender});
    const history = await operations.history(principal,business,sender);
    assert(history.messages.some(message => message.text === 'Thanks'));
    // Cancellation is data for a configurable branch, not an implicit success.
    const orderStep = steps.find(item => item.id === 'order')!;
    orderStep.choices[0]!.to = 'decision';
    steps.push({id:'decision',kind:'Condition',text:'Decision',x:0,y:0,config:{condition:{left:{var:'orderStatus'},operator:'eq',right:'cancelled'}},choices:[{label:'Cancelled',to:'cancelled'},{label:'Confirmed',to:'notify'}]});
    steps.push(step('cancelled','End','Order cancelled'));
    await inbound('Hello again'); await inbound('Luis');
    snapshot = await operations.snapshot(principal,business);
    const pending = snapshot.orders.find(order => order.state === 'pending_approval')!;
    await operations.action(principal,business,{type:'pause',sender});
    await operations.action(principal,business,{type:'cancel_order',id:pending.id});
    assert.equal((await operations.snapshot(principal,business)).conversations[0]!.operatorPaused,true);
    await operations.action(principal,business,{type:'resume',sender});
    await runtime.processOne();
    assert.equal((await operations.snapshot(principal,business)).conversations[0]!.variables.orderStatus,'cancelled');
    while (await senderService.sendOne()) { /* Drain cancellation branch. */ }
    assert(sends.some(send => /Order cancelled/.test(send.text)));
    assert.equal((await operations.snapshot(principal,business)).orders.length,2);
  } finally {
    provider.closeAllConnections(); provider.close();
    await db.query('DELETE FROM app.businesses WHERE id=$1', [business]);
    await db.query('DELETE FROM app.users WHERE id=$1', [user]);
    await db.onModuleDestroy();
  }
});
