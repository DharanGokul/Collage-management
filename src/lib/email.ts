import type { EmailSettings } from '../types'
import { isValidEmail } from './utils'

/**
 * Custom email sending.
 *
 * Browsers cannot open SMTP connections and provider API keys must never ship
 * to the client, so a real deployment relays mail through a backend. This
 * front-end supports two modes:
 *
 *  - provider = "webhook": every message is POSTed as JSON to `webhookUrl`
 *    (your API / serverless function / Zapier / n8n) which sends it using the
 *    college's SMTP or provider credentials.
 *  - any other provider: the configuration is validated and the send is
 *    simulated, then recorded in the outbox so the full UX can be demoed.
 */

export interface OutgoingEmail {
  to: string[]
  subject: string
  body: string
}

export interface SendResult {
  ok: boolean
  simulated: boolean
  error?: string
}

export function validateEmailSettings(s: EmailSettings): string | null {
  if (!s.fromName.trim()) return 'Sender name is required.'
  if (!isValidEmail(s.fromEmail)) return 'Sender email address is not valid.'
  if (s.replyTo && !isValidEmail(s.replyTo)) return 'Reply-to address is not valid.'
  switch (s.provider) {
    case 'smtp':
      if (!s.smtpHost.trim()) return 'SMTP host is required.'
      if (!s.smtpPort || s.smtpPort < 1 || s.smtpPort > 65535) return 'SMTP port must be between 1 and 65535.'
      if (!s.smtpUser.trim()) return 'SMTP username is required.'
      return null
    case 'sendgrid':
    case 'mailgun':
    case 'ses':
      if (!s.apiKey.trim()) return 'API key is required.'
      if (s.provider === 'mailgun' && !s.domain.trim()) return 'Mailgun sending domain is required.'
      if (s.provider === 'ses' && !s.region.trim()) return 'AWS region is required.'
      return null
    case 'webhook':
      try {
        const u = new URL(s.webhookUrl)
        if (u.protocol !== 'https:' && u.hostname !== 'localhost') return 'Webhook URL must use https.'
      } catch {
        return 'Webhook URL is not a valid URL.'
      }
      return null
  }
}

export async function sendEmail(settings: EmailSettings, msg: OutgoingEmail): Promise<SendResult> {
  const cfgError = validateEmailSettings(settings)
  if (cfgError) return { ok: false, simulated: false, error: cfgError }
  const bad = msg.to.find((t) => !isValidEmail(t))
  if (bad) return { ok: false, simulated: false, error: `Invalid recipient: ${bad}` }
  if (!msg.to.length) return { ok: false, simulated: false, error: 'No recipients.' }

  const body = settings.footer ? `${msg.body}\n\n—\n${settings.footer}` : msg.body

  if (settings.provider === 'webhook') {
    try {
      const res = await fetch(settings.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: { name: settings.fromName, email: settings.fromEmail },
          replyTo: settings.replyTo || undefined,
          to: msg.to,
          subject: msg.subject,
          text: body,
        }),
      })
      if (!res.ok) return { ok: false, simulated: false, error: `Relay responded ${res.status}` }
      return { ok: true, simulated: false }
    } catch (e) {
      return { ok: false, simulated: false, error: e instanceof Error ? e.message : 'Network error' }
    }
  }

  await new Promise((r) => setTimeout(r, 500 + Math.min(1500, msg.to.length * 15)))
  return { ok: true, simulated: true }
}

export const PROVIDERS: { id: EmailSettings['provider']; label: string; hint: string }[] = [
  { id: 'smtp', label: 'Custom SMTP', hint: 'Google Workspace, Microsoft 365, Zoho or your own mail server' },
  { id: 'sendgrid', label: 'SendGrid', hint: 'Twilio SendGrid API' },
  { id: 'mailgun', label: 'Mailgun', hint: 'Mailgun HTTP API' },
  { id: 'ses', label: 'Amazon SES', hint: 'AWS Simple Email Service' },
  { id: 'webhook', label: 'HTTPS relay', hint: 'POST each message to your backend endpoint' },
]
