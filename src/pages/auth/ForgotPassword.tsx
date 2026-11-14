import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, KeyRound, MailCheck } from 'lucide-react'
import { Button, Field } from '../../components/ui'
import { useAuth } from '../../auth/useAuth'
import { isValidEmail } from '../../lib/utils'
import { AuthShell, StatusHead } from './parts'

export default function ForgotPassword() {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!isValidEmail(email.trim())) return setError('Enter the email address on your account.')
    setBusy(true)
    setError(null)
    try {
      await auth.requestPasswordReset(email.trim())
      setSent(true)
    } catch {
      setError('Could not send the email. Please try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      {sent ? (
        <div className="stack">
          <StatusHead icon={<MailCheck size={24} />} title="Check your email">
            If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way. It works for 1 hour.
          </StatusHead>
          <Button variant="secondary" onClick={() => { setSent(false) }}>Use a different email</Button>
          <p className="tiny center"><Link to="/login" className="link">← Back to sign in</Link></p>
        </div>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <StatusHead icon={<KeyRound size={24} />} title="Forgot your password?">Enter your account email and we will send you a link to choose a new one.</StatusHead>
          <Field label="Email" error={error}>
            {(id) => <input id={id} className="input" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null) }} autoComplete="email" autoCapitalize="none" spellCheck={false} aria-invalid={!!error} />}
          </Field>
          <Button type="submit" className="w-full" loading={busy}>Send reset link</Button>
          <p className="tiny center"><Link to="/login" className="link"><ArrowLeft size={12} aria-hidden /> Back to sign in</Link></p>
        </form>
      )}
    </AuthShell>
  )
}
