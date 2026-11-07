export interface Principal {
  subject: string;
  email: string | null;
}

export interface AccessRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket: { remoteAddress?: string };
  user?: Principal;
}
