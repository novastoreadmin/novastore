# NOVA Corporate Mail (local / internal)

A self-hosted mail server + a **Mail** page inside the Medusa admin to read & send mail
between mailboxes like `admin@nova.local`. **Internal-only** — it does not send/receive to
the public internet (by design, since `nova.local` is not a real domain).

## Mailboxes

| Address | Login (IMAP/SMTP user) | Password |
|---|---|---|
| admin@nova.local | admin | admin123 |
| sales@nova.local | sales | sales123 |
| support@nova.local | support | support123 |

> GreenMail's `login:password@domain` syntax means the **login is the local part** (`admin`),
> not the full email — that's why the IMAP username is `admin`, not `admin@nova.local`.

## Ports (host)
- SMTP (send): `localhost:3025`
- IMAP (read): `localhost:3143`
- GreenMail status/API: `localhost:8085`

## How to use
1. Start the mail server (persists with `restart: unless-stopped`):
   ```sh
   docker compose up -d mail
   ```
2. Start the store (`start-store.bat`) and open the admin → **Mail** in the left sidebar.
3. Pick a mailbox in the dropdown, click a message to read it, or hit **Compose** to send.
   Sending from one mailbox to another (e.g. admin → sales) is delivered instantly.
4. **Reply** (button next to Compose, enabled once a message is open) opens the same
   compose drawer prefilled with `Re: <subject>`, the original sender as `To`, and the
   quoted original text/date/sender below two blank lines.
5. **Delete** (button next to Reply, enabled once a message is open) removes the open
   message from the mailbox (IMAP `\Deleted` + expunge — hard delete, no Trash folder)
   and closes the reading pane.

## Add a new mailbox
1. Add it to the `mail` service in `docker-compose.yml` (`-Dgreenmail.users=...,newuser:pass@nova.local`).
2. Add the same account to `apps/backend/src/lib/mail-accounts.ts`.
3. Recreate the container: `docker compose up -d mail`. Restart the backend.

## How it works
- **Mail server:** GreenMail (`docker-compose.yml` → `mail` service).
- **Backend API** (`apps/backend/src/api/admin/mail/`): `GET accounts`, `GET messages`
  (IMAP via imapflow), `GET messages/:uid` (parsed via mailparser),
  `DELETE messages/:uid` (deletes via imapflow `messageDelete`, see
  `apps/backend/src/api/admin/mail/messages/[uid]/route.ts`), `POST messages` (send via
  nodemailer). All under `/admin/*`, so they require an admin session.
- **Client helpers:** `apps/backend/src/lib/mail-client.ts` (`listMessages`, `getMessage`,
  `deleteMessage`, `sendMail`), `mail-accounts.ts`.
- **Admin UI:** `apps/backend/src/admin/routes/mail/page.tsx` (sidebar route) — message
  list, reading pane, and Refresh / Reply / Delete / Compose buttons.

## Going live on a real domain (novastore.com.ua via cPanel)

The store code is env-driven, so switching from local GreenMail to the real cPanel mail
server is just configuration. Two sides:

### A. In cPanel (one-time)
1. **Create the mailbox(es):** cPanel → *Email Accounts* (Облікові записи електронної пошти)
   → **Create** → `admin@novastore.com.ua` with a strong password. Repeat for sales/support.
2. **Get the exact connection settings:** Email Accounts → **Connect Devices**. Note the
   IMAP host (usually `mail.novastore.com.ua`, port **993**, SSL) and SMTP (port **465**, SSL).
3. **Email Deliverability** (tool on the Tools page): make sure **SPF** and **DKIM** show valid
   (green). Click *Repair* if offered. This is required for mail to reach Gmail/Outlook.
4. **DNS / MX:** if the domain's nameservers point to this host, MX is set automatically.
   If DNS is at your registrar, add an **MX** record to the host's mail server plus the **SPF**,
   **DKIM**, and a **DMARC** TXT record (copy the values from Email Deliverability).
5. **Valid SSL:** the domain is currently *self-signed* (the "at risk" warning). Run
   **SSL/TLS Status → Run AutoSSL** to get a free Let's Encrypt cert so TLS verifies cleanly.
   (Until then you can set `MAIL_TLS_REJECT_UNAUTHORIZED=false` as a temporary workaround.)

### B. In the store (apps/backend/.env)
Uncomment and fill the `MAIL_*` block (template already in `.env`). The real pattern used
in production (`MAIL_ACCOUNTS` is a JSON array, one object per mailbox):
```env
MAIL_IMAP_HOST=uashared43.twinservers.net
MAIL_SMTP_HOST=uashared43.twinservers.net
MAIL_IMAP_PORT=993
MAIL_SMTP_PORT=465
MAIL_SECURE=true
MAIL_SMTP_AUTH=true
MAIL_ACCOUNTS=[{"email":"admin@novastore.com.ua","login":"admin@novastore.com.ua","password":"THE_MAILBOX_PASSWORD","label":"Admin"},{"email":"sales@novastore.com.ua","login":"sales@novastore.com.ua","password":"THE_MAILBOX_PASSWORD","label":"Sales"}]
```

On the droplet, after editing `.env`, remember to also copy it to
`.medusa/server/.env.production` and restart pm2 **with `--update-env`** — a plain
`pm2 restart medusa` does not reload environment variables:
```bash
cp ~/novastore/apps/backend/.env ~/novastore/apps/backend/.medusa/server/.env.production
pm2 restart medusa --update-env
```

The admin **Mail** page now reads/sends through the real mailbox. Test by sending to an
external address (e.g. your Gmail) and replying back to confirm two-way delivery. You can
also use cPanel webmail directly at `https://novastore.com.ua/webmail`.

> Note: for real servers `login` is the **full email** and `MAIL_SMTP_AUTH=true` (cPanel
> requires authenticated SMTP). GreenMail used the local part and no auth.

> ⚠️ **Critical gotcha (hit this in production):** the IMAP/SMTP *mailbox* password (the
> one you set in cPanel → Email Accounts when creating `admin@novastore.com.ua`) is a
> **completely separate credential** from the Medusa admin panel login password for the
> same-looking email address. They are two unrelated systems (cPanel mail auth vs. Medusa's
> `auth_identity` table) that happen to share an email string. Using the admin panel
> password in `MAIL_ACCOUNTS` (or vice versa) fails IMAP/SMTP auth with no obvious error —
> always re-copy the password from cPanel → Email Accounts → Connect Devices, don't assume
> it matches the admin login.

## Limitations
- **Internal only.** No mail leaves your machine. To go real (send/receive to the internet)
  you need a real domain + DNS (MX/SPF/DKIM/DMARC); swap GreenMail for docker-mailserver and
  keep the admin UI + API.
- **Mail is in-memory.** GreenMail does not persist messages — recreating/restarting the `mail`
  container clears all inboxes. Fine for local/dev; not for keeping real history.
- Outgoing mail isn't authenticated (GreenMail accepts any sender on its local SMTP).
