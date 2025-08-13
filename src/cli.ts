#!/usr/bin/env node
import CarerixWebhooksClient, { CreateWebhookRequest, WebhookHeader } from './carerix-webhooks-client';

type ParsedArgs = {
  envFile?: string;
  command?: string;
  params: string[];
  flags: Record<string, string | boolean | string[]>;
};

function printUsage(): void {
  const lines = [
    'Usage: cx-webhooks [--env <path>] <command> [options]',
    '',
    'Commands:',
    '  list                                   List all webhooks',
    '  enable <id>                            Enable a webhook',
    '  disable <id>                           Disable a webhook',
    '  delete <id>                            Delete a webhook',
    '  create --url <url> --event <type> [--event <type> ...] [--header key=value ...]',
    '                                         Create a webhook (at least 1 --event required)',
    '',
    'Options:',
    '  --env <path>                           Path to .env file (default: .env)',
    '  --help                                 Show this help',
  ];
  console.log(lines.join('\n'));
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { params: [], flags: {} } as ParsedArgs;
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return out;
  }

  // Global flags before command
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === '--env' && i + 1 < args.length) {
      out.envFile = args[i + 1];
      i += 2;
      continue;
    }
    // First non-flag is the command
    if (!a.startsWith('-')) break;
    // Unrecognized flag, stop and let command parsing handle
    break;
  }

  // Command
  if (i < args.length) {
    out.command = args[i];
    i += 1;
  }

  // Remaining tokens belong to the command; parse simple flags
  const flags: Record<string, string | boolean | string[]> = {};
  const params: string[] = [];
  const ensureArray = (k: string) => {
    if (!Array.isArray(flags[k])) flags[k] = [] as string[];
    return flags[k] as string[];
  };
  while (i < args.length) {
    const a = args[i];
    if (a === '--env') {
      // Already parsed globally; consume value
      i += 2;
      continue;
    }
    if (a === '--url' && i + 1 < args.length) {
      flags.url = args[i + 1];
      i += 2;
      continue;
    }
    if ((a === '--event' || a === '-e') && i + 1 < args.length) {
      ensureArray('event').push(args[i + 1]);
      i += 2;
      continue;
    }
    if ((a === '--header' || a === '-H') && i + 1 < args.length) {
      ensureArray('header').push(args[i + 1]);
      i += 2;
      continue;
    }
    if (a.startsWith('-')) {
      // boolean flags
      flags[a.replace(/^--?/, '')] = true;
      i += 1;
      continue;
    }
    params.push(a);
    i += 1;
  }
  out.params = params;
  out.flags = flags;
  return out;
}

function parseHeaders(values?: string[] | string | boolean): WebhookHeader[] | undefined {
  if (!values || values === true) return undefined;
  const arr = Array.isArray(values) ? values : [values];
  const out: WebhookHeader[] = [];
  for (const v of arr) {
    const idx = v.indexOf('=');
    if (idx === -1) throw new Error(`Invalid --header value: ${v}. Expected key=value.`);
    const name = v.slice(0, idx).trim();
    const value = v.slice(idx + 1).trim();
    if (!name) throw new Error(`Invalid --header value: ${v}. Name is empty.`);
    out.push({ name, value });
  }
  return out.length ? out : undefined;
}

async function main() {
  const parsed = parseArgs(process.argv);
  if (!parsed.command) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const envFile = parsed.envFile || '.env';
  let client: CarerixWebhooksClient;
  try {
    client = CarerixWebhooksClient.fromEnv(envFile);
  } catch (e) {
    console.error((e as Error).message);
    process.exitCode = 1;
    return;
  }

  const cmd = parsed.command;
  try {
    switch (cmd) {
      case 'list': {
        const items = await client.listWebhooks();
        if (!items.length) {
          console.log('No webhooks found.');
          return;
        }
        for (const w of items) {
          const events = (w.filters || []).map((f) => f.eventType).join(', ');
          const enabled = w.enabled === undefined ? '' : (w.enabled ? 'enabled' : 'disabled');
          console.log(`${w.id}  ${enabled}  ${w.url}  [${events}]`);
        }
        return;
      }
      case 'enable': {
        const id = parsed.params[0];
        if (!id) throw new Error('Missing <id>. Usage: cx-webhooks enable <id>');
        const res = await client.enableWebhook(id);
        console.log(`Enabled webhook ${res.id}`);
        return;
      }
      case 'disable': {
        const id = parsed.params[0];
        if (!id) throw new Error('Missing <id>. Usage: cx-webhooks disable <id>');
        const res = await client.disableWebhook(id);
        console.log(`Disabled webhook ${res.id}`);
        return;
      }
      case 'delete': {
        const id = parsed.params[0];
        if (!id) throw new Error('Missing <id>. Usage: cx-webhooks delete <id>');
        await client.deleteWebhook(id);
        console.log(`Deleted webhook ${id}`);
        return;
      }
      case 'create': {
        const url = parsed.flags.url as string | undefined;
        const events = (parsed.flags.event as string[] | undefined) || [];
        if (!url) throw new Error('Missing --url.');
        if (!events.length) throw new Error('At least one --event is required.');
        const headers = parseHeaders(parsed.flags.header);
        const req: CreateWebhookRequest = {
          url,
          filters: events.map((eventType) => ({ eventType })),
          customHeaders: headers,
        };
        const res = await client.createWebhook(req);
        console.log(`Created webhook ${res.id}`);
        return;
      }
      default:
        printUsage();
        process.exitCode = 1;
    }
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
  }
}

main();

