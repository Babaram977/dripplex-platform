import http from 'node:http';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import * as z from 'zod/v4';

const PORT = Number(process.env.PORT || 3000);
const MCP_TOKEN = process.env.MCP_TOKEN;
if (!MCP_TOKEN) throw new Error('MCP_TOKEN is required');

const ACCOUNTS = {
  admin: {
    address: process.env.ADMIN_EMAIL || 'admin@dripplex.com',
    user: process.env.ADMIN_EMAIL || 'admin@dripplex.com',
    pass: process.env.ADMIN_EMAIL_PASSWORD,
  },
  support: {
    address: process.env.SUPPORT_EMAIL || 'support@dripplex.com',
    user: process.env.SUPPORT_EMAIL || 'support@dripplex.com',
    pass: process.env.SUPPORT_EMAIL_PASSWORD,
  },
};

const IMAP = { host: process.env.IMAP_HOST || 'mail.dripplex.com', port: 993, secure: true };
const SMTP = { host: process.env.SMTP_HOST || 'mail.dripplex.com', port: 465, secure: true };

function accountConfig(accountName) {
  const account = ACCOUNTS[accountName];
  if (!account) throw new Error(`Unknown account: ${accountName}`);
  return account;
}

async function withImap(accountName, fn) {
  const account = accountConfig(accountName);
  if (!account.pass) throw new Error(`${accountName} mailbox password is not configured`);
  const client = new ImapFlow({ ...IMAP, auth: { user: account.user, pass: account.pass }, logger: false });
  await client.connect();
  try { return await fn(client); } finally { await client.logout().catch(() => {}); }
}

function sanitizeText(text, max = 12000) {
  if (!text) return '';
  return String(text).slice(0, max);
}

async function listEmails({ account, folder = 'INBOX', limit = 20, unreadOnly = false, since }) {
  return withImap(account, async client => {
    const lock = await client.getMailboxLock(folder);
    try {
      const total = client.mailbox.exists || 0;
      if (!total) return [];
      const start = Math.max(1, total - Math.min(limit, 100) + 1);
      const rows = [];
      for await (const msg of client.fetch(`${start}:${total}`, { uid: true, envelope: true, flags: true, internalDate: true })) {
        const seen = msg.flags?.has('\\Seen') ?? true;
        if (unreadOnly && seen) continue;
        const date = msg.internalDate || msg.envelope?.date;
        if (since && date && new Date(date) < new Date(since)) continue;
        rows.push({
          uid: msg.uid,
          unread: !seen,
          date: date ? new Date(date).toISOString() : null,
          subject: msg.envelope?.subject || '',
          from: msg.envelope?.from?.map(x => ({ name: x.name, address: x.address })) || [],
          to: msg.envelope?.to?.map(x => ({ name: x.name, address: x.address })) || [],
          messageId: msg.envelope?.messageId || null,
        });
      }
      return rows.reverse();
    } finally { lock.release(); }
  });
}

async function getEmail({ account, folder = 'INBOX', uid }) {
  return withImap(account, async client => {
    const lock = await client.getMailboxLock(folder);
    try {
      const msg = await client.fetchOne(uid, { uid: true, envelope: true, source: true, flags: true, internalDate: true });
      if (!msg) throw new Error(`Email UID ${uid} not found`);
      const parsed = await simpleParser(msg.source);
      return {
        uid: msg.uid,
        unread: !(msg.flags?.has('\\Seen') ?? true),
        date: msg.internalDate ? new Date(msg.internalDate).toISOString() : null,
        subject: parsed.subject || msg.envelope?.subject || '',
        from: parsed.from?.value || [],
        to: parsed.to?.value || [],
        cc: parsed.cc?.value || [],
        replyTo: parsed.replyTo?.value || [],
        messageId: parsed.messageId || null,
        inReplyTo: parsed.inReplyTo || null,
        text: sanitizeText(parsed.text),
        html: sanitizeText(parsed.html || '', 20000),
        attachments: (parsed.attachments || []).map(a => ({ filename: a.filename, contentType: a.contentType, size: a.size })),
      };
    } finally { lock.release(); }
  });
}

async function sendEmail({ account, to, subject, text, html, inReplyTo, references }) {
  const cfg = accountConfig(account);
  if (!cfg.pass) throw new Error(`${account} mailbox password is not configured`);
  const transporter = nodemailer.createTransport({ ...SMTP, auth: { user: cfg.user, pass: cfg.pass } });
  const info = await transporter.sendMail({ from: cfg.address, to, subject, text, html, inReplyTo, references });
  return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
}

function buildServer() {
  const server = new McpServer({ name: 'dripplex-mail', version: '0.1.0' }, { capabilities: { tools: {} } });

  server.registerTool('dripplex_list_mail', {
    description: 'List recent DrippleX emails from admin@dripplex.com or support@dripplex.com. Metadata only; use get_email for full content.',
    inputSchema: z.object({ account: z.enum(['admin', 'support']), folder: z.string().default('INBOX'), limit: z.number().int().min(1).max(100).default(20), unreadOnly: z.boolean().default(false), since: z.string().datetime().optional() }),
  }, async args => ({ content: [{ type: 'text', text: JSON.stringify(await listEmails(args), null, 2) }] }));

  server.registerTool('dripplex_get_email', {
    description: 'Read one DrippleX email by IMAP UID after it has been identified with list_mail.',
    inputSchema: z.object({ account: z.enum(['admin', 'support']), folder: z.string().default('INBOX'), uid: z.number().int().positive() }),
  }, async args => ({ content: [{ type: 'text', text: JSON.stringify(await getEmail(args), null, 2) }] }));

  server.registerTool('dripplex_send_email', {
    description: 'Send an email from a DrippleX mailbox. Use only after explicit user approval of the exact message.',
    inputSchema: z.object({ account: z.enum(['admin', 'support']), to: z.string().email(), subject: z.string().min(1), text: z.string().min(1), html: z.string().optional(), inReplyTo: z.string().optional(), references: z.array(z.string()).optional() }),
  }, async args => ({ content: [{ type: 'text', text: JSON.stringify(await sendEmail(args), null, 2) }] }));

  server.registerTool('dripplex_health', {
    description: 'Check connectivity/configuration for both DrippleX mailboxes without exposing credentials.',
  }, async () => {
    const result = {};
    for (const account of ['admin', 'support']) {
      try {
        await withImap(account, async client => client.mailboxOpen('INBOX'));
        result[account] = 'ok';
      } catch (error) {
        result[account] = error instanceof Error ? error.message : String(error);
      }
    }
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });

  return server;
}

const handler = createMcpHandler(buildServer, { responseMode: 'json' });
const nodeHandler = toNodeHandler(handler);

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'dripplex-mail-bridge' }));
    return;
  }
  if (req.url?.startsWith('/mcp')) {
    if (req.headers.authorization !== `Bearer ${MCP_TOKEN}`) {
      res.writeHead(401, { 'content-type': 'application/json', 'www-authenticate': 'Bearer' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    void nodeHandler(req, res);
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, '0.0.0.0', () => console.error(`[dripplex-mail-bridge] listening on ${PORT}`));

process.on('SIGTERM', async () => {
  await handler.close().catch(() => {});
  server.close(() => process.exit(0));
});
