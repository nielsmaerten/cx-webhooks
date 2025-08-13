/**
 * Carerix Webhooks TypeScript client
 *
 * - Config via environment variables (optionally loaded from .env)
 * - Supports: create webhook, list webhooks, enable/disable webhook
 *
 * Requirements: Node.js 18+ (built-in fetch) or a global fetch polyfill.
 */

import { readFileSync } from 'fs';

type OAuthConfig = {
  authEndpoint: string;
  clientID: string;
  clientSecret: string;
  scopes?: string;
};

export type CarerixConfig = {
  /** Base API URL for Carerix Webhooks API */
  baseUrl: string; // e.g. https://api.carerix.io/webhooks/v1
  /** Application UUID used in webhook endpoints */
  applicationId: string;
  /** OAuth2 client credentials */
  oauth: OAuthConfig;
};

export type WebhookFilter = {
  eventType: string;
};

export type WebhookHeader = {
  name: string;
  value: string;
};

export type CreateWebhookRequest = {
  url: string;
  _kind?: 'Webhook';
  filters?: WebhookFilter[];
  customHeaders?: WebhookHeader[];
  // Additional fields supported by Carerix API can be added here
};

export type Webhook = {
  id: string;
  url: string;
  enabled?: boolean;
  filters?: WebhookFilter[];
  customHeaders?: WebhookHeader[];
  // other fields as returned by the API
  [key: string]: unknown;
};

export class CarerixWebhooksClient {
  private baseUrl: string;
  private applicationId: string;
  private oauth: OAuthConfig;

  constructor(config: CarerixConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.applicationId = config.applicationId;
    this.oauth = config.oauth;
  }

  /**
   * Construct a client from environment variables. If a `path` is provided,
   * this method will read key=value pairs from that .env file and populate
   * process.env for missing keys.
   *
   * Required env vars:
   * - CX_AUTH_ENDPOINT
   * - CX_CLIENT_ID
   * - CX_CLIENT_SECRET
   * - CX_APPLICATION_ID
   * Optional:
   * - CX_SCOPES (default: undefined)
   * - CX_BASE_URL (default: https://api.carerix.io/webhooks/v1)
   */
  static fromEnv(path?: string): CarerixWebhooksClient {
    if (path) CarerixWebhooksClient.loadEnvFile(path);

    const authEndpoint = requiredEnv('CX_AUTH_ENDPOINT');
    const clientID = requiredEnv('CX_CLIENT_ID');
    const clientSecret = requiredEnv('CX_CLIENT_SECRET');
    const applicationId = requiredEnv('CX_APPLICATION_ID');
    const scopes = process.env.CX_SCOPES;
    const baseUrl = process.env.CX_BASE_URL || 'https://api.carerix.io/webhooks/v1';

    return new CarerixWebhooksClient({
      baseUrl,
      applicationId,
      oauth: { authEndpoint, clientID, clientSecret, scopes },
    });
  }

  /** Normalize various possible id fields from API responses to a single `id` property */
  private static normalizeWebhook(data: any): Webhook {
    const id = data?.id ?? data?._id ?? data?.webhookId ?? data?.uuid;
    return { id, ...data } as Webhook;
  }

  private static loadEnvFile(filePath: string) {
    try {
      const raw = readFileSync(filePath, 'utf-8');
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        let value = trimmed.slice(idx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
          value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
      }
    } catch (e) {
      throw new Error(`Failed to load env file at ${filePath}: ${(e as Error).message}`);
    }
  }

  private async getAccessToken(): Promise<string> {
    const body = new URLSearchParams();
    body.set('grant_type', 'client_credentials');
    body.set('client_id', this.oauth.clientID);
    body.set('client_secret', this.oauth.clientSecret);
    if (this.oauth.scopes) body.set('scope', this.oauth.scopes);

    const res = await fetch(this.oauth.authEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Failed to fetch access token: ${res.status} ${res.statusText} ${text}`);
    }

    const data = (await res.json()) as { access_token: string };
    if (!data?.access_token) {
      throw new Error('No access_token in OAuth response');
    }
    return data.access_token;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    console.log(token);
    return { Authorization: `Bearer ${token}` };
  }

  private appUrl(path: string): string {
    return `${this.baseUrl}/applications/${this.applicationId}${path}`;
  }

  // Public API

  /** Create a new webhook for the configured application */
  async createWebhook(req: CreateWebhookRequest): Promise<Webhook> {
    const headers = await this.authHeaders();
    const res = await fetch(this.appUrl('/webhooks'), {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ _kind: 'Webhook', ...req }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Create webhook failed: ${res.status} ${res.statusText} ${text}`);
    }
    const data = await res.json();
    return CarerixWebhooksClient.normalizeWebhook(data);
  }

  /** List all webhooks for the configured application */
  async listWebhooks(): Promise<Webhook[]> {
    const headers = await this.authHeaders();
    const res = await fetch(this.appUrl('/webhooks'), {
      method: 'GET',
      headers,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`List webhooks failed: ${res.status} ${res.statusText} ${text}`);
    }
    const data = await res.json();
    let items: any[];
    if (Array.isArray(data)) items = data;
    else if (Array.isArray((data as any)?.items)) items = (data as any).items as any[];
    else if (data) items = [data];
    else items = [];
    return items.map((w) => CarerixWebhooksClient.normalizeWebhook(w));
  }

  /** Enable a webhook by id via POST /enable */
  async enableWebhook(webhookId: string): Promise<Webhook> {
    const headers = await this.authHeaders();
    const res = await fetch(
      this.appUrl(`/webhooks/${encodeURIComponent(webhookId)}/enable`),
      { method: 'POST', headers }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Enable webhook failed: ${res.status} ${res.statusText} ${text}`);
    }
    const data = await res.json();
    return CarerixWebhooksClient.normalizeWebhook(data);
  }

  /** Disable a webhook by id via POST /disable */
  async disableWebhook(webhookId: string): Promise<Webhook> {
    const headers = await this.authHeaders();
    const res = await fetch(
      this.appUrl(`/webhooks/${encodeURIComponent(webhookId)}/disable`),
      { method: 'POST', headers }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Disable webhook failed: ${res.status} ${res.statusText} ${text}`);
    }
    const data = await res.json();
    return CarerixWebhooksClient.normalizeWebhook(data);
  }

  /** Delete a webhook by id */
  async deleteWebhook(webhookId: string): Promise<void> {
    const headers = await this.authHeaders();
    const res = await fetch(this.appUrl(`/webhooks/${encodeURIComponent(webhookId)}`), {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Delete webhook failed: ${res.status} ${res.statusText} ${text}`);
    }
  }
}

export default CarerixWebhooksClient;

// Helpers
function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}
