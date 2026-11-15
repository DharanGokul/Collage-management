import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, KeyRound, MailCheck } from 'lucide-react'
import { Button, Field } from '../../components/ui'
import { useAuth } from '../../auth/useAuth'
import { AuthError } from '../../auth/types'
import { AuthShell, StatusHead } from './parts'

export default function ForgotPassword() {
  const auth = useAuth()
  const [who, setWho] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (who.trim().length < 3) return setError('Enter your email, roll number or employee ID.')
    setBusy(true)
    setError(null)
    try {
      await auth.requestPasswordReset(who.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Could not send the email. Please try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      {sent ? (
        <div className="stack">
          <StatusHead icon={<MailCheck size={24} />} title="Check your email">
            If an account exists for <strong>{who.trim()}</strong>, a reset link is on its way to the email address on file. It works for 1 hour.
          </StatusHead>
          <Button variant="secondary" onClick={() => { setSent(false) }}>Try a different ID</Button>
          <p className="tiny center"><Link to="/login" className="link">← Back to sign in</Link></p>
        </div>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <StatusHead icon={<KeyRound size={24} />} title="Forgot your password?">Enter your email, roll number or employee ID. We will send a link to the email address on file.</StatusHead>
          <Field label="Email, roll number or employee ID" error={error}>
            {(id) => <input id={id} className="input" value={who} onChange={(e) => { setWho(e.target.value); setError(null) }} autoComplete="username" autoCapitalize="none" spellCheck={false} aria-invalid={!!error} />}
          </Field>
          <Button type="submit" className="w-full" loading={busy}>Send reset link</Button>
          <p className="tiny center"><Link to="/login" className="link"><ArrowLeft size={12} aria-hidden /> Back to sign in</Link></p>
        </form>
      )}
    </AuthShell>
  )
}
