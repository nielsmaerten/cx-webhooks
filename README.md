# Carerix Webhooks Client + CLI

TypeScript client and simple CLI for managing Carerix webhooks. The CLI loads configuration from a `.env` file and supports listing, creating, enabling, disabling, and deleting webhooks.

## Requirements
- Node.js 18+ (uses built‑in `fetch`)

## Install / Build
- Install deps: `npm install`
- Build: `npm run build`
- Run CLI locally:
  - `npm run cli -- <args>`
  - or `node dist/cli.js <args>`

When published/linked, the binary name is `cx-webhooks`.

## Prerequisites
- OAuth2 Client with `scope:urn:cx/webhooks:data:manage`
- Webhook application ID
- Follow [these](https://help.carerix.com/en/articles/9362341-creating-your-first-webhook-a-step-by-step-guide-with-popular-examples)  instructions to create your OAuth2 client & application

## Environment
Set these variables in a `.env` file:

```
# Carerix API base
CX_BASE_URL=https://api.carerix.io/webhooks/v1

# OAuth2 Client Credentials (Carerix Identity provider)
CX_AUTH_ENDPOINT=.../protocol/openid-connect/token
CX_CLIENT_ID=...
CX_CLIENT_SECRET=...
CX_SCOPES=urn:cx/webhooks:data:manage

# Target application (UUID)
CX_APPLICATION_ID=...
```


## CLI Usage
```
Usage: cx-webhooks [--env <path>] <command> [options]

Commands:
  list                                   List all webhooks
  enable <id>                            Enable a webhook
  disable <id>                           Disable a webhook
  delete <id>                            Delete a webhook
  create --url <url> --event <type> [--event <type> ...] [--header key=value ...]
                                         Create a webhook (at least 1 --event required)

Options:
  --env <path>                           Path to .env file (default: .env)
  --help                                 Show help
```

### Examples
- List using `.env.dev`:
  - `cx-webhooks --env .env.dev list`
- Enable/Disable/Delete:
  - `cx-webhooks enable 12345`
  - `cx-webhooks disable 12345`
  - `cx-webhooks delete 12345`
- Create (requires at least one `--event`):
  - `cx-webhooks create --url https://example/webhook --event cremployee:created --event crmatch:updated --header x-api-key=secret`

Notes:
- `--event` is repeatable; at least one is required.
- `--header` is optional and repeatable (format: `key=value`).

## Library Usage (TypeScript)
```ts
import CarerixWebhooksClient from 'cx-webhooks';

async function main() {
  // Load config from .env in project root
  const client = CarerixWebhooksClient.fromEnv('.env');

  // List
  const webhooks = await client.listWebhooks();
  console.log(webhooks);

  // Create
  const created = await client.createWebhook({
    url: 'https://example/webhook',
    filters: [{ eventType: 'cremployee:created' }],
    customHeaders: [{ name: 'x-api-key', value: 'secret' }], // optional
  });
  console.log('Created:', created.id);

  // Enable / Disable / Delete
  await client.enableWebhook(created.id);
  await client.disableWebhook(created.id);
  await client.deleteWebhook(created.id);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

## Development
- Build: `npm run build`
- Demo script: `npm run demo` (uses `dist/demo.js` and `.env`)

## License and Warranty
[![No Maintenance Intended](https://img.shields.io/badge/maintenance-none-red.svg)](https://unmaintained.tech/)

This project is licensed under the ISC License. See `LICENSE` for details.


Provided as-is with no warranty or support. I publish this in case it’s useful to others, but I won’t invest work beyond my own needs. Issues and PRs may be ignored.