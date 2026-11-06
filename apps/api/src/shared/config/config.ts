import { z } from 'zod';

function hasProtocol(value: string, protocols: string[]): boolean {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const urlWithProtocols = (protocols: string[]) => z.string().refine(
  (value) => hasProtocol(value, protocols),
  'URL o protocolo de conexión inválido',
);

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  WEB_ORIGIN: urlWithProtocols(['http:', 'https:']).refine(
    (value) => {
      try { return new URL(value).origin === value; } catch { return false; }
    },
    'WEB_ORIGIN debe ser un origen HTTP sin ruta',
  ),
  DATABASE_URL: urlWithProtocols(['postgres:', 'postgresql:']),
  REDIS_URL: urlWithProtocols(['redis:', 'rediss:']),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(input: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error('Configuración inválida: ' + keys.join(', '));
  }
  return result.data;
}
