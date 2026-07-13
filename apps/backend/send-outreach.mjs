/**
 * send-outreach.mjs — надсилає 3 B2B-листи оптовикам через SMTP.
 *
 * Запуск (з папки apps/backend):
 *   node --env-file=.env send-outreach.mjs
 *
 * Вимоги: Node.js >= 20, заповнений .env (MAIL_SMTP_HOST, MAIL_ACCOUNTS, ...)
 *
 * За замовчуванням відправляє від першого облікового запису в MAIL_ACCOUNTS.
 * Щоб відправляти від business@novastore.com.ua — спочатку створи цей ящик
 * у cPanel і додай його до MAIL_ACCOUNTS в .env.
 */

import nodemailer from "nodemailer"
import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const emailsDir = resolve(__dirname, "../../docs/outreach-emails")

// ── Читаємо конфіг зі змінних середовища (.env) ──────────────────────────────

const accounts = JSON.parse(process.env.MAIL_ACCOUNTS || "[]")
if (!accounts.length) {
  console.error("❌  MAIL_ACCOUNTS не знайдено в .env")
  process.exit(1)
}

// Використовуємо business@ як відправника, якщо він є в MAIL_ACCOUNTS
const sender =
  accounts.find((a) => a.email === "business@novastore.com.ua") || accounts[0]

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_SMTP_HOST || "127.0.0.1",
  port: Number(process.env.MAIL_SMTP_PORT || 465),
  secure: (process.env.MAIL_SECURE || "false").toLowerCase() === "true",
  auth:
    (process.env.MAIL_SMTP_AUTH || "false").toLowerCase() === "true"
      ? { user: sender.login, pass: sender.password }
      : undefined,
  tls: {
    rejectUnauthorized:
      (process.env.MAIL_TLS_REJECT_UNAUTHORIZED || "true").toLowerCase() !== "false",
  },
})

// ── Список листів ─────────────────────────────────────────────────────────────

const EMAILS = [
  {
    to: "midnightmaiter@duck.com", //partner@itsellopt.com.ua
    subject:
      "Співпраця з NOVA Store — опт/дропшипінг: кабелі, аксесуари, зарядні",
    file: "1-itsellopt.html",
  },
  {
    to: "midnightmaiter@duck.com", // gadgetplanet.com.ua@gmail.com
    subject: "Питання щодо оптової співпраці з NOVA Store",
    file: "2-gadgetplanet.html",
  },
  {
    to: "midnightmaiter@duck.com", // ac@kosmotech.ua
    subject:
      "NOVA Store — партнерство з Kosmotech: опт по кабелях, аксесуарах, павербанках і пам'яті",
    file: "3-kosmotech.html",
  },
]

// ── Відправка ─────────────────────────────────────────────────────────────────

console.log(`\n📨  Відправник: ${sender.name || "NOVA Store"} <${sender.email}>`)
console.log(`🌐  SMTP: ${process.env.MAIL_SMTP_HOST}:${process.env.MAIL_SMTP_PORT}\n`)

for (const mail of EMAILS) {
  try {
    const html = readFileSync(resolve(emailsDir, mail.file), "utf8")

    const info = await transporter.sendMail({
      from: {
        name: sender.name || "NOVA Store",
        address: sender.email,
      },
      to: mail.to,
      subject: mail.subject,
      html,
    })

    console.log(`✅  Надіслано → ${mail.to}`)
    console.log(`    MessageId: ${info.messageId}\n`)
  } catch (err) {
    console.error(`❌  Помилка → ${mail.to}: ${err.message}\n`)
  }
}

console.log("Готово.")
