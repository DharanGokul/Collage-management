import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, KeyRound, LinkIcon, UserCheck } from 'lucide-react'
import { Button } from '../../components/ui'
import { useAuth } from '../../auth/useAuth'
import { AuthError } from '../../auth/types'
import { checkPassword } from '../../auth/policy'
import { AuthShell, PasswordField, StatusHead } from './parts'

/** One page for both "reset a forgotten password" and "activate an invited account": the token decides which. */
export default function SetPassword({ mode }: { mode: 'reset' | 'activate' }) {
  const auth = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const kind = mode === 'reset' ? 'password_reset' : 'invite'
  const [who, setWho] = useState<{ email: string; name: string } | null>(null)
  const [state, setState] = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking')
  const [invalidMsg, setInvalidMsg] = useState('')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    auth
      .inspectToken(token, kind)
      .then((r) => alive && (setWho(r), setState('ready')))
      .catch((e) => alive && (setInvalidMsg(e instanceof AuthError ? e.message : 'This link is not valid.'), setState('invalid')))
    return () => { alive = false }
  }, [auth, token, kind])

  const personal = who ? [who.name] : []
  const check = checkPassword(pw, personal)
  const mismatch = confirm.length > 0 && confirm !== pw

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!check.ok) return setError('Choose a stronger password — see the checklist below.')
    if (pw !== confirm) return setError('The two passwords do not match.')
    setBusy(true)
    setError(null)
    try {
      if (mode === 'reset') await auth.resetPassword(token, pw)
      else await auth.activateAccount(token, pw)
      setState('done')
    } catch (err) {
      if (err instanceof AuthError && err.code === 'invalid_link') {
        setInvalidMsg(err.message)
        setState('invalid')
      } else setError(err instanceof AuthError ? err.message : 'Could not save your password. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'reset' ? 'Choose a new password' : 'Activate your account'

  return (
    <AuthShell>
      {state === 'checking' && <div className="stack"><StatusHead icon={<span className="spinner" />} title="Checking your link…" /></div>}
      {state === 'invalid' && (
        <div className="stack">
          <StatusHead icon={<LinkIcon size={24} />} tone="warn" title="This link can't be used">{invalidMsg}</StatusHead>
          {mode === 'reset' ? <Button onClick={() => nav('/forgot-password')}>Request a new link</Button> : <Button onClick={() => nav('/login')}>Sign in to get a new activation link</Button>}
          <p className="tiny center"><Link to="/login" className="link">← Back to sign in</Link></p>
        </div>
      )}
      {state === 'done' && (
        <div className="stack">
          <StatusHead icon={<CheckCircle2 size={24} />} tone="ok" title={mode === 'reset' ? 'Password updated' : 'Account activated'}>
            {mode === 'reset' ? 'You can now sign in with your new password. Other browsers were signed out.' : 'Your account is ready. Sign in with the password you just chose.'}
          </StatusHead>
          <Button onClick={() => nav('/login')}>Go to sign in</Button>
        </div>
      )}
      {state === 'ready' && who && (
        <form className="stack" onSubmit={submit} noValidate>
          <StatusHead icon={mode === 'reset' ? <KeyRound size={24} /> : <UserCheck size={24} />} title={title}>
            For <strong>{who.name}</strong> · {who.email}
          </StatusHead>
          <PasswordField label="New password" value={pw} onChange={(v) => { setPw(v); setError(null) }} autoComplete="new-password" meter personal={personal} />
          <PasswordField label="Confirm password" value={confirm} onChange={(v) => { setConfirm(v); setError(null) }} autoComplete="new-password" error={mismatch ? 'Does not match' : null} />
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <Button type="submit" className="w-full" loading={busy} disabled={!check.ok || pw !== confirm}>{mode === 'reset' ? 'Update password' : 'Activate account'}</Button>
        </form>
      )}
    </AuthShell>
  )
}
