import { ConfigService } from '@nestjs/config';

export const metaKeys = ['META_ACCESS_TOKEN', 'META_APP_SECRET', 'META_VERIFY_TOKEN', 'META_PHONE_NUMBER_ID', 'META_BUSINESS_ID', 'META_GRAPH_VERSION'] as const;
export function missingMeta(config: ConfigService): string[] { return metaKeys.filter((key) => !config.get<string>(key)); }
