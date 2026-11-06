import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Principal } from './auth.types';

@Injectable()
export class SupabaseAuthGateway {
  constructor(private readonly config: ConfigService) {}

  private client() {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_PUBLISHABLE_KEY');
    if (!url || !key) throw new ServiceUnavailableException('Autenticación pendiente de configuración');
    // Cliente por operación: ninguna sesión se comparte entre usuarios.
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(3000) }) },
    });
  }

  private unavailable(status?: number): void {
    if (!status || status === 429 || status >= 500) {
      throw new ServiceUnavailableException('Autenticación temporalmente no disponible');
    }
  }

  async verify(token: string): Promise<Principal> {
    const { data, error } = await this.client().auth.getUser(token);
    if (error) {
      this.unavailable(error.status);
      throw new UnauthorizedException('Sesión no válida');
    }
    if (!data.user || data.user.is_anonymous || !z.uuid().safeParse(data.user.id).success) {
      throw new UnauthorizedException('Sesión no válida');
    }
    return { subject: data.user.id, email: data.user.email ?? null };
  }

  async login(email: string, password: string, captchaToken?: string) {
    const { data, error } = await this.client().auth.signInWithPassword({
      email, password, options: captchaToken ? { captchaToken } : undefined,
    });
    if (error) {
      this.unavailable(error.status);
      throw new UnauthorizedException('Correo o contraseña no válidos');
    }
    if (!data.session) throw new UnauthorizedException('Correo o contraseña no válidos');
    return {
      access_token: data.session.access_token,
      token_type: data.session.token_type,
      expires_in: data.session.expires_in,
      expires_at: data.session.expires_at,
    };
  }
}
