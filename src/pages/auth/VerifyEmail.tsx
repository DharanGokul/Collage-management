import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, LinkIcon, MailCheck } from 'lucide-react'
import { Button, Field } from '../../components/ui'
import { useAuth } from '../../auth/useAuth'
import { AuthError } from '../../auth/types'
import { isValidEmail } from '../../lib/utils'
import { AuthShell, StatusHead } from './parts'

/** Landing page of the "verify your email" link. */
export default function VerifyEmail() {
  const auth = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [state, setState] = useState<'checking' | 'ok' | 'invalid'>('checking')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [resent, setResent] = useState(false)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return // the link is single-use: do not spend it twice under StrictMode
    ran.current = true
    auth
      .verifyEmail(token)
      .then(() => setState('ok'))
      .catch((e) => {
        setMessage(e instanceof AuthError ? e.message : 'This link is not valid.')
        setState('invalid')
      })
  }, [auth, token])

  const resend = async (e: FormEvent) => {
    e.preventDefault()
    if (!isValidEmail(email.trim())) return setMessage('Enter the email address on your account.')
    await auth.resendVerification(email.trim())
    setResent(true)
  }

  return (
    <AuthShell>
      {state === 'checking' && <div className="stack"><StatusHead icon={<span className="spinner" />} title="Verifying your email…" /></div>}
      {state === 'ok' && (
        <div className="stack">
          <StatusHead icon={<CheckCircle2 size={24} />} tone="ok" title="Email verified">Thanks — your address is confirmed. You can sign in now.</StatusHead>
          <Button onClick={() => nav('/login')}>Continue to sign in</Button>
        </div>
      )}
      {state === 'invalid' && (
        <form className="stack" onSubmit={resend} noValidate>
          <StatusHead icon={resent ? <MailCheck size={24} /> : <LinkIcon size={24} />} tone={resent ? 'accent' : 'warn'} title={resent ? 'Check your email' : "This link can't be used"}>
            {resent ? 'If an account needs verifying, a new link is on its way.' : message}
          </StatusHead>
          {!resent && (
            <>
              <Field label="Send me a new link">{(id) => <input id={id} className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" autoComplete="email" autoCapitalize="none" />}</Field>
              <Button type="submit" className="w-full">Send verification link</Button>
            </>
          )}
          <p className="tiny center"><Link to="/login" className="link">← Back to sign in</Link></p>
        </form>
      )}
    </AuthShell>
  )
}
