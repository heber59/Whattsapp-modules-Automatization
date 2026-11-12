import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/shared/database/database.service';
import { migrate } from '../src/shared/database/migrate';
import { validateEnvironment } from '../src/shared/config/config';
import { SupabaseAuthGateway } from '../src/shared/auth/supabase-auth.gateway';

test('MCP authors portable flows with business isolation, simulation, revision conflicts and immutable publication', { timeout: 30000 }, async () => {
  const base = validateEnvironment(process.env);
  assert(['127.0.0.1', 'localhost'].includes(new URL(base.DATABASE_URL).hostname));
  await migrate(base.DATABASE_URL);
  const alice = randomUUID(), bob = randomUUID();
  const settings = new ConfigService({ ...base, RATE_LIMIT_PREFIX: 'mcp:test:' + randomUUID(), RATE_LIMIT_IP_LIMIT: 1000, RATE_LIMIT_USER_LIMIT: 1000 });
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService).useValue(settings)
    .overrideProvider(SupabaseAuthGateway).useValue({ verify: async (token: string) => {
      if (!['alice', 'bob'].includes(token)) throw new UnauthorizedException('Invalid session');
      return { subject: token === 'alice' ? alice : bob, email: token + '@example.invalid' };
    } }).compile();
  const app = module.createNestApplication({ logger: false });
  const businesses: string[] = [];
  try {
    await app.listen(0, '127.0.0.1');
    const origin = 'http://127.0.0.1:' + (app.getHttpServer().address() as AddressInfo).port;
    const request = (path: string, body: unknown, token = 'alice', headers = {}) => fetch(origin + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...headers }, body: JSON.stringify(body),
    });
    const business = (await (await request('/businesses', { name: 'MCP fixture' })).json() as { id: string }).id;
    businesses.push(business);
    const path = '/businesses/' + business + '/mcp';
    const operationsPath = '/businesses/' + business + '/operations';
    assert.equal((await fetch(origin + operationsPath, { headers: { Authorization: 'Bearer bob' } })).status, 404);
    assert.equal((await fetch(origin + operationsPath + '/conversations/573001234567', { headers: { Authorization: 'Bearer bob' } })).status, 404);
    assert.equal((await request(operationsPath + '/actions', { type: 'pause', sender: '573001234567' }, 'bob')).status, 404);
    const invoke = async (name: string, args: unknown, token = 'alice') => {
      const response = await request(path, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, token);
      assert.equal(response.status, 200);
      return await response.json() as { result: { isError?: boolean; structuredContent: Record<string, unknown>; content: { text: string }[] } };
    };
    assert.equal((await request(path, { jsonrpc: '2.0', id: 1, method: 'ping' }, 'bad')).status, 401);
    assert.equal((await request(path, { jsonrpc: '2.0', id: 1, method: 'ping' }, 'alice', { Origin: 'https://evil.example' })).status, 403);
    const init = await (await request(path, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'fixture', version: '1' } } })).json() as { result: { protocolVersion: string } };
    assert.equal(init.result.protocolVersion, '2025-11-25');
    const listed = await (await request(path, { jsonrpc: '2.0', id: 2, method: 'tools/list' })).json() as { result: { tools: { name: string; inputSchema: unknown }[] } };
    assert(listed.result.tools.some(tool => tool.name === 'flow_apply' && tool.inputSchema));
    const next = (to: string) => [{ label: 'Next', to }];
    const definition = { schemaVersion: 1, name: 'Configurable quote', steps: [
      { id: 's', kind: 'Start', text: 'Hello', x: 0, y: 0, choices: next('name') },
      { id: 'name', kind: 'Input', text: 'Your name?', x: 1, y: 0, choices: next('e'), config: { variable: 'customerName', inputType: 'text', required: true } },
      { id: 'e', kind: 'End', text: 'Thanks {{customerName}}', x: 2, y: 0, choices: [] },
    ] };
    assert.equal((await invoke('flow_validate', { definition })).result.structuredContent.valid, true);
    const simulated = await invoke('flow_simulate', { definition, replies: ['Ana'] });
    assert.match(JSON.stringify(simulated.result.structuredContent), /Thanks Ana/);
    const created = await invoke('flow_apply', { definition });
    assert.equal(created.result.isError, undefined);
    const flow = created.result.structuredContent.flow as { id: string; revision: number };
    assert.equal(flow.revision, 1);
    const forbidden = await invoke('flow_read', { flowId: flow.id }, 'bob');
    assert.equal(forbidden.result.isError, true);
    assert.equal((await invoke('flow_apply', { flowId: flow.id, definition })).result.isError, true);
    const diff = await invoke('flow_diff', { flowId: flow.id, definition: { ...definition, name: 'Changed' } });
    assert.equal(diff.result.structuredContent.nameChanged, true);
    assert.equal(diff.result.structuredContent.expectedRevision, 1);
    const published = await invoke('flow_publish', { flowId: flow.id, expectedRevision: 1 });
    assert.equal(published.result.isError, undefined);
    await invoke('flow_apply', { flowId: flow.id, expectedRevision: 1, definition: { ...definition, name: 'Changed' } });
    assert.equal((await invoke('flow_apply', { flowId: flow.id, expectedRevision: 1, definition })).result.isError, true);
    const exported = await invoke('flow_read', { flowId: flow.id, version: 1 });
    assert.deepEqual(exported.result.structuredContent.definition, definition);
    assert.equal((await invoke('constructor', {})).result.isError, true);
  } finally {
    const database = app.get(DatabaseService);
    await database.query('DELETE FROM app.businesses WHERE id=ANY($1::uuid[])', [businesses]);
    await database.query('DELETE FROM app.users WHERE auth_user_id=ANY($1::uuid[])', [[alice, bob]]);
    await app.close();
  }
});
