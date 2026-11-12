import { NotificationSenderService } from '../src/modules/whatsapp/notification-sender.service';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/shared/database/database.service';
import { migrate } from '../src/shared/database/migrate';
import { validateEnvironment } from '../src/shared/config/config';
import { WhatsAppWorkerModule } from '../src/modules/whatsapp/whatsapp-worker.module';
import { WhatsAppWorkerService } from '../src/modules/whatsapp/whatsapp-worker.service';
import { WhatsAppRuntimeService } from '../src/modules/whatsapp/whatsapp-runtime.service';
import { WhatsAppSenderService } from '../src/modules/whatsapp/whatsapp-sender.service';

test('Signed WhatsApp messages execute pinned menus, deduplicate, preserve order and recover durable sends', { timeout: 40000 }, async (t) => {
  const base = validateEnvironment(process.env);
  assert(['127.0.0.1','localhost'].includes(new URL(base.DATABASE_URL).hostname), 'Only local test PostgreSQL is allowed');
  const alice = randomUUID(), bob = randomUUID();
  const sends: { to: string; text: { body: string } }[] = [];
  const providerIds: string[] = [];
  let mode: 'ok' | 'rate' | 'disconnect' = 'ok';
  const provider = createServer(async (request,response) => {
    response.setHeader('Content-Type','application/json');
    if (request.url === '/auth/v1/user') {
      const id = request.headers.authorization === 'Bearer alice' ? alice : bob;
      response.end(JSON.stringify({ id,email: 'fixture@example.invalid',aud: 'authenticated',role: 'authenticated',created_at: '2026-01-01T00:00:00Z',app_metadata: {},user_metadata: {} }));
      return;
    }
    assert.equal(request.url,'/v23.0/123456789/messages');
    assert.equal(request.headers.authorization,'Bearer fixture-meta-token');
    let raw = ''; for await (const chunk of request) raw += String(chunk);
    sends.push(JSON.parse(raw));
    if (mode === 'rate') { response.writeHead(429).end('{}'); return; }
    if (mode === 'disconnect') { request.socket.destroy(); return; }
    const id = 'wamid.fixture.' + randomUUID(); providerIds.push(id);
    response.end(JSON.stringify({ messaging_product: 'whatsapp',messages: [{ id }] }));
  });
  await new Promise<void>((resolve) => provider.listen(0,'127.0.0.1',resolve));
  t.after(() => { provider.closeAllConnections(); provider.close(); });
  const origin = 'http://127.0.0.1:' + (provider.address() as AddressInfo).port;
  const settings = new ConfigService({ ...base,NODE_ENV: 'test', SUPABASE_URL: origin, SUPABASE_PUBLISHABLE_KEY: 'fixture-key',
    RATE_LIMIT_PREFIX: 'wa:test:' + randomUUID(), RATE_LIMIT_IP_LIMIT: 1000,RATE_LIMIT_USER_LIMIT: 1000,
    META_ACCESS_TOKEN: 'fixture-meta-token',META_APP_SECRET: 'fixture-secret',META_VERIFY_TOKEN: 'fixture-verify',
    META_PHONE_NUMBER_ID: '123456789',META_BUSINESS_ID: randomUUID(),META_GRAPH_VERSION: 'v23.0',META_GRAPH_ORIGIN: origin });
  await migrate(base.DATABASE_URL);
  const module = await Test.createTestingModule({ imports: [AppModule,WhatsAppWorkerModule] }).overrideProvider(ConfigService).useValue(settings).compile();
  const app = module.createNestApplication({ rawBody: true,logger: false });
  let business: string | undefined;
  let other: string | undefined;
  try {
    await app.listen(0,'127.0.0.1');
    const worker = app.get(WhatsAppWorkerService);
    await worker.onModuleDestroy();
    const database = app.get(DatabaseService);
    const api = 'http://127.0.0.1:' + (app.getHttpServer().address() as AddressInfo).port;
    const request = (path: string,body?: unknown,token = 'alice',method?: string) => fetch(api+path,{ method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: { Authorization: 'Bearer '+token,'Content-Type': 'application/json' },body: body === undefined ? undefined : JSON.stringify(body) });
    business = (await (await request('/businesses',{ name: 'WhatsApp test' })).json() as { id: string }).id;
    settings.set('META_BUSINESS_ID',business);
    other = (await (await request('/businesses',{ name: 'Other pilot' },'bob')).json() as { id: string }).id;
    const steps = [
      { id: 's',kind: 'Start',text: 'Welcome',x: 0,y: 0,choices: [{ label: 'Next',to: 'm' }] },
      { id: 'm',kind: 'Menu',text: 'Choose',x: 0,y: 0,choices: [{ label: 'Hours',to: 'a' },{ label: 'Finish',to: 'e' }] },
      { id: 'a',kind: 'Message',text: 'Open at nine',x: 0,y: 0,choices: [{ label: 'Next',to: 'm' }] },
      { id: 'e',kind: 'End',text: 'Bye',x: 0,y: 0,choices: [] },
    ];
    const flow = (await (await request('/businesses/'+business+'/flows',{ name: 'Pilot',steps })).json() as { flow: { id: string } }).flow.id;
    const flowPath = '/businesses/'+business+'/flows/'+flow;
    assert.equal((await request(flowPath+'/publish',{ expectedRevision: 1 })).status,201);
    const channelPath = '/businesses/'+business+'/whatsapp';
    assert.equal((await request(channelPath,{ flowId: flow,version: 1,phoneNumberId: 'attacker' })).status,400);
    assert.equal((await request('/businesses/'+other+'/whatsapp',{ flowId: flow,version: 1 },'bob')).status,403);
    assert.equal((await request(channelPath,{ flowId: flow,version: 1 })).status,201);
    const hidden = await (await request('/businesses/'+other+'/whatsapp',undefined,'bob')).json() as { channel: unknown; configuration: { pilotAllowed: boolean } };
    assert.equal(hidden.channel,null); assert.equal(hidden.configuration.pilotAllowed,false);
    assert.equal((await fetch(api+'/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=fixture-verify&hub.challenge=123')).status,200);
    assert.equal(await (await fetch(api+'/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=fixture-verify&hub.challenge=123')).text(),'123');
    assert.equal((await fetch(api+'/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123')).status,403);
    const now = Math.floor(Date.now()/1000);
    const sender = '573001234567';
    const message = (id: string,text: string,from = sender,timestamp = now) => ({ id,from,timestamp: String(timestamp),type: 'text',text: { body: text } });
    const webhook = (messages: unknown[],phone = '123456789',statuses?: unknown[],valid = true) => {
      const raw = JSON.stringify({ object: 'whatsapp_business_account',entry: [{ changes: [{ field: 'messages',value: { metadata: { phone_number_id: phone },messages,statuses } }] }] });
      return fetch(api+'/webhooks/whatsapp',{ method: 'POST',headers: { 'Content-Type': 'application/json','x-hub-signature-256': 'sha256='+createHmac('sha256',valid ? 'fixture-secret' : 'wrong').update(raw).digest('hex') },body: raw });
    };
    assert.equal((await webhook([message('invalid','Hello')],'123456789',undefined,false)).status,403);
    assert.equal((await webhook([message('unknown','Hello')],'987654321')).status,200);
    // Deliberately reverse lexical wamid order inside one provider batch.
    const batch = [message('z-first','Hello'),message('a-second','1')];
    assert.equal((await webhook(batch)).status,200);
    assert.equal((await webhook(batch)).status,200);
    assert.equal((await database.query("SELECT count(*)::int AS count FROM app.whatsapp_inbox WHERE id IN ('z-first','a-second')")).rows[0]!.count,2);
    await worker.runOnce(); await worker.runOnce();
    assert.equal(sends.length,2);
    assert.match(sends[0]!.text.body,/Welcome/); assert.match(sends[1]!.text.body,/Open at nine/);
    assert.equal((await webhook([message('bad-option','bad')])).status,200);
    await worker.runOnce(); assert.match(sends.at(-1)!.text.body,/Please reply/);
    // New publication changes new conversations but leaves existing menu pinned.
    steps[2]!.text = 'Changed hours';
    await request(flowPath,{ name: 'Pilot2',steps,expectedRevision: 1 },'alice','PATCH');
    await request(flowPath+'/publish',{ expectedRevision: 2 });
    await request(channelPath,{ flowId: flow,version: 2 });
    await webhook([message('pinned','Hours')]); await worker.runOnce(); assert.match(sends.at(-1)!.text.body,/Open at nine/);
    await database.query("UPDATE app.whatsapp_conversations SET last_inbound_at=now()-interval '25 hours' WHERE sender=$1",[sender]);
    await webhook([message('fresh','Hello')]); await worker.runOnce();
    assert.equal((await database.query('SELECT version FROM app.whatsapp_conversations WHERE sender=$1',[sender])).rows[0]!.version,2);
    await webhook([message('new-hours','1')]); await worker.runOnce(); assert.match(sends.at(-1)!.text.body,/Changed hours/);
    const lastId = providerIds.at(-1)!;
    await webhook([],'123456789',[{ id: lastId,status: 'read',timestamp: String(now) },{ id: lastId,status: 'new-future-status',timestamp: String(now) }]);
    assert.equal((await database.query('SELECT delivery_status FROM app.whatsapp_outbox WHERE provider_message_id=$1',[lastId])).rows[0]!.delivery_status,'read');
    // Unsupported and stale input produce no response.
    const beforeIgnored = sends.length;
    await webhook([{ ...message('unsupported','Hello'),type: 'image' },message('stale','Hello',sender,now-90000)]);
    await worker.runOnce(); await worker.runOnce(); assert.equal(sends.length,beforeIgnored);
    // A rejected429 is safe to retry; no acceptance was reported.
    mode = 'rate'; await webhook([message('rate','Hello','573001234568')]); await worker.runOnce();
    const pending = await database.query("SELECT state,attempts FROM app.whatsapp_outbox WHERE inbox_id='rate'");
    assert.equal(pending.rows[0]!.state,'pending'); assert.equal(pending.rows[0]!.attempts,1);
    mode = 'ok'; await database.query("UPDATE app.whatsapp_outbox SET available_at=now() WHERE inbox_id='rate'");
    // A new worker object recovers persisted work without an in-memory queue.
    const restarted = new WhatsAppWorkerService(settings,app.get(WhatsAppRuntimeService),app.get(WhatsAppSenderService),app.get(NotificationSenderService));
    await restarted.runOnce();
    assert.equal((await database.query("SELECT state FROM app.whatsapp_outbox WHERE inbox_id='rate'")).rows[0]!.state,'sent');
    // Ambiguous network outcome pauses, rather than blindly resending.
    mode = 'disconnect'; await webhook([message('ambiguous','Hello','573001234569')]); await restarted.runOnce();
    const afterAmbiguous = sends.length;
    await restarted.runOnce(); assert.equal(sends.length,afterAmbiguous);
    assert.equal((await database.query("SELECT state FROM app.whatsapp_outbox WHERE inbox_id='ambiguous'")).rows[0]!.state,'manual_review');
    assert.equal((await database.query("SELECT state FROM app.whatsapp_conversations WHERE sender='573001234569'")).rows[0]!.state,'paused');
    // Crash after claim uses manual review on recovery, with no repeated send.
    mode = 'ok'; await webhook([message('crashed','Hello','573001234570')]);
    await app.get(WhatsAppRuntimeService).processOne();
    await database.query("UPDATE app.whatsapp_outbox SET state='sending',updated_at=now()-interval '3 minutes' WHERE inbox_id='crashed'");
    await restarted.runOnce(); assert.equal(sends.length,afterAmbiguous);
    assert.equal((await database.query("SELECT state FROM app.whatsapp_outbox WHERE inbox_id='crashed'")).rows[0]!.state,'manual_review');
    // Pending replies are not sent outside the customer-service window.
    await webhook([message('expired','Hello','573001234571')]); await app.get(WhatsAppRuntimeService).processOne();
    await database.query("UPDATE app.whatsapp_outbox SET expires_at=now()-interval '1 second' WHERE inbox_id='expired'");
    await restarted.runOnce(); assert.equal(sends.length,afterAmbiguous);
    assert.equal((await database.query("SELECT state FROM app.whatsapp_outbox WHERE inbox_id='expired'")).rows[0]!.state,'expired');
  } finally {
    const database = app.get(DatabaseService);
    if (business || other) await database.query('DELETE FROM app.businesses WHERE id=ANY($1::uuid[])',[[business,other].filter(Boolean)]);
    await database.query('DELETE FROM app.users WHERE auth_user_id=ANY($1::uuid[])',[[alice,bob]]);
    if (providerIds.length) await database.query('DELETE FROM app.whatsapp_status_events WHERE message_id=ANY($1::text[])',[providerIds]);
    await app.close(); provider.closeAllConnections(); await new Promise<void>((resolve) => provider.close(() => resolve()));
  }
});
