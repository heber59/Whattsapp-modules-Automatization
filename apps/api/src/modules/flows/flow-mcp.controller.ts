import { Body, Controller, Get, Header, Headers, HttpException, Param, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { CurrentUser } from '../../shared/auth/auth.decorators';
import type { Principal } from '../../shared/auth/auth.types';
import { FlowToolsService } from './flow-tools.service';

const rpc = z.object({ jsonrpc: z.literal('2.0'), id: z.union([z.string().max(100), z.number().finite()]).optional(),
  method: z.string().min(1).max(100), params: z.record(z.string(), z.unknown()).optional() }).strict();
const protocolVersion = '2025-11-25';
type Reply = { status(code: number): Reply; json(body: unknown): void; end(): void };

@Controller('businesses/:businessId/mcp')
export class FlowMcpController {
  constructor(private readonly tools: FlowToolsService, private readonly config: ConfigService) {}

  @Get()
  stream(@Res() response: Reply) { response.status(405).end(); }

  @Post()
  @Header('Cache-Control', 'no-store')
  async handle(@CurrentUser() user: Principal, @Param('businessId') business: string, @Body() body: unknown,
    @Headers('origin') origin: string | undefined, @Headers('mcp-protocol-version') version: string | undefined,
    @Res() response: Reply) {
    const parsed = rpc.safeParse(body);
    const id = parsed.success ? parsed.data.id ?? null : null;
    const error = (code: number, message: string, status = 200) => response.status(status).json({ jsonrpc: '2.0', id, error: { code, message } });
    if (origin && origin !== this.config.get<string>('WEB_ORIGIN')) return error(-32600, 'Origin is not allowed', 403);
    if (!parsed.success) return error(-32600, 'Invalid JSON-RPC request', 400);
    if (version && version !== protocolVersion) return error(-32600, 'Supported MCP protocol version: ' + protocolVersion, 400);
    const { method, params } = parsed.data;
    if (parsed.data.id === undefined) {
      if (!method.startsWith('notifications/')) return error(-32600, 'Requests require an id', 400);
      return response.status(202).end();
    }
    try {
      let result: unknown;
      switch (method) {
        case 'initialize':
          result = { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'wa-flow-tools', version: '1.0.0' } };
          break;
        case 'ping': result = {}; break;
        case 'tools/list': result = { tools: this.tools.list() }; break;
        case 'tools/call': {
          const input = z.object({ name: z.string(), arguments: z.unknown().optional(), _meta: z.unknown().optional() }).strict().safeParse(params);
          if (!input.success) return error(-32602, 'Invalid tool call');
          try {
            const output = await this.tools.call(user, business, input.data.name, input.data.arguments ?? {});
            result = { content: [{ type: 'text', text: JSON.stringify(output) }], structuredContent: output };
          } catch (failure) {
            if (!(failure instanceof HttpException)) throw failure;
            result = { isError: true, content: [{ type: 'text', text: failure.message }] };
          }
          break;
        }
        default: return error(-32601, 'Method not found');
      }
      return response.status(200).json({ jsonrpc: '2.0', id, result });
    } catch { return error(-32603, 'Flow tool request failed'); }
  }
}
