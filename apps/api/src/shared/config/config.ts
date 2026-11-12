import { z } from 'zod';
import { isIP } from 'node:net';

function isProxyAddress(value: string): boolean {
  const [address, prefix, ...extra] = value.split('/');
  const family = isIP(address ?? '');
  if (!family || extra.length) return false;
  if (prefix === undefined) return true;
  return /^\d+$/.test(prefix) && Number(prefix) > 0 && Number(prefix) <= (family === 4 ? 32 : 128);
}

function hasProtocol(value: string, protocols: string[]): boolean {
  try { return protocols.includes(new URL(value).protocol); } catch { return false; }
}

const urlWithProtocols = (protocols: string[]) => z.string().refine(
  (value) => hasProtocol(value, protocols), 'Invalid URL or connection protocol',
);
const optionalText = z.preprocess((value) => value === '' ? undefined : value, z.string().min(1).optional());

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HTTP_HOST: z.string().refine((value) => isIP(value) !== 0, 'HTTP_HOST must be an IP address').default('127.0.0.1'),
  TRUSTED_PROXIES: z.string().default('').transform((value) => value === '' ? [] : value.split(',').map((entry) => entry.trim()))
    .refine((addresses) => addresses.every(isProxyAddress), 'TRUSTED_PROXIES must contain explicit IP addresses or nonzero CIDR ranges'),
  WEB_ORIGIN: urlWithProtocols(['http:', 'https:']).refine(
    (value) => {
      try { return new URL(value).origin === value; } catch { return false; }
    }, 'WEB_ORIGIN must be an HTTP origin without a path',
  ),
  DATABASE_URL: urlWithProtocols(['postgres:', 'postgresql:']),
  REDIS_URL: urlWithProtocols(['redis:', 'rediss:']),
  SUPABASE_URL: optionalText,
  SUPABASE_PUBLISHABLE_KEY: optionalText,
  WEB_AUTH_SECRET: z.preprocess((value) => value === '' ? undefined : value, z.string().min(32).max(512).optional()),
  META_ACCESS_TOKEN: optionalText,
  META_APP_SECRET: optionalText,
  META_VERIFY_TOKEN: optionalText,
  META_PHONE_NUMBER_ID: z.preprocess((value) => value === '' ? undefined : value, z.string().regex(/^[0-9]{5,30}$/).optional()),
  META_BUSINESS_ID: z.preprocess((value) => value === '' ? undefined : value, z.uuid().optional()),
  META_GRAPH_VERSION: z.preprocess((value) => value === '' ? undefined : value, z.string().regex(/^v[0-9]{1,3}\.[0-9]+$/).optional()),
  META_GRAPH_ORIGIN: z.string().default('https://graph.facebook.com'),
  RATE_LIMIT_IP_LIMIT: z.coerce.number().int().min(1).max(100000).default(120),
  RATE_LIMIT_LOGIN_ACCOUNT_LIMIT: z.coerce.number().int().min(1).max(1000).default(5),
  RATE_LIMIT_USER_LIMIT: z.coerce.number().int().min(1).max(100000).default(60),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).max(3600000).default(60000),
  RATE_LIMIT_PREFIX: z.string().regex(/^[a-zA-Z0-9:-]{1,64}$/).default('wa:rate'),
}).superRefine((config, context) => {
  try {
    const origin = new URL(config.META_GRAPH_ORIGIN);
    const test = config.NODE_ENV === 'test' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) && origin.protocol === 'http:';
    if ((!test && origin.origin !== 'https://graph.facebook.com') || origin.origin !== config.META_GRAPH_ORIGIN) throw new Error();
  } catch { context.addIssue({ code: 'custom', path: ['META_GRAPH_ORIGIN'], message: 'Only official Meta origin or local test simulator is allowed' }); }
  if (Boolean(config.SUPABASE_URL) !== Boolean(config.SUPABASE_PUBLISHABLE_KEY)) {
    context.addIssue({ code: 'custom', path: ['SUPABASE_URL'], message: 'Configure both Supabase variables' });
  }
  if (config.SUPABASE_URL) {
    try {
      const url = new URL(config.SUPABASE_URL);
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local && config.NODE_ENV !== 'production')) throw new Error();
      if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
    } catch {
      context.addIssue({ code: 'custom', path: ['SUPABASE_URL'], message: 'Invalid Supabase origin' });
    }
  }
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(input: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error('Invalid configuration: ' + keys.join(', '));
  }
  return result.data;
}
