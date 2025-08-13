import CarerixWebhooksClient from './index';

async function main() {
  // Load env from .env in project root
  const client = CarerixWebhooksClient.fromEnv('.env');
  const url = process.env.CX_WEBHOOK_URL;
  if (!url) throw new Error('Missing CX_WEBHOOK_URL in environment/.env');
  const apiKey = process.env.CX_WEBHOOK_API_KEY;
  if (!apiKey) throw new Error('Missing CX_WEBHOOK_API_KEY in environment/.env');

  console.log('Listing webhooks ...');
  let list = await client.listWebhooks();
  console.log(`Found ${list.length} webhook(s).`);
  list.forEach((webhook) => {
    console.log(`- ${webhook.id}`);
  });

  console.log('Creating webhook ...');
  const created = await client.createWebhook({
    url,
    filters: [
      { eventType: 'cremployee:created' },
      { eventType: 'cremployee:updated' },
      { eventType: 'crmatch:created' },
      { eventType: 'crmatch:updated' },
      { eventType: 'crjob:updated' },
    ],
    customHeaders: [
      { name: 'x-api-key', value: apiKey },
    ],
  });
  console.log('Created webhook:', created);

  console.log('Listing webhooks ...');
  list = await client.listWebhooks();
  console.log(`Found ${list.length} webhook(s).`);
  list.forEach((webhook) => {
    console.log(`- ${webhook.id}`);
  });

  console.log('Enabling webhook ...');
  const enabled = await client.enableWebhook(created.id);
  console.log('Enabled webhook:', enabled);

  // console.log('Disabling webhook ...');
  // const disabled = await client.disableWebhook(created.id);
  // console.log('Disabled webhook:', disabled);

  // console.log('Deleting webhook ...');
  // await client.deleteWebhook(created.id);
  // console.log('Deleted webhook:', created.id);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
