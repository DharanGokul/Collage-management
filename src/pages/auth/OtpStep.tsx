import { useState } from 'react'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { Button } from '../../components/ui'
import { OtpInput, StatusHead, useCountdown } from './parts'
import { AuthError } from '../../auth/types'
import { formatSeconds } from '../../auth/policy'

export interface OtpChallengeInfo {
  challengeId: string
  sentTo: string
  expiresAt: number
  resendAfter: number
}

/** Second step of sign-in: the 6-digit code that was emailed. Used by the college and platform sign-in pages. */
export function OtpStep({ challenge, trustDays, onVerify, onResend, onBack }: {
  challenge: OtpChallengeInfo
  /** Omit to hide the "trust this browser" option. */
  trustDays?: number
  onVerify: (code: string, trust: boolean) => Promise<void>
  onResend: () => Promise<Pick<OtpChallengeInfo, 'expiresAt' | 'resendAfter'>>
  onBack: () => void
}) {
  const [code, setCode] = useState('')
  const [trust, setTrust] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [times, setTimes] = useState({ expiresAt: challenge.expiresAt, resendAfter: challenge.resendAfter })
  const [note, setNote] = useState<string | null>(null)
  const expiresIn = useCountdown(times.expiresAt)
  const resendIn = useCountdown(times.resendAfter)

  const submit = async (value = code) => {
    if (busy) return
    if (value.length < 6) return setError('Enter all 6 digits.')
    setBusy(true)
    setError(null)
    try {
      await onVerify(value, trust)
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Try again.')
      setCode('')
      setBusy(false)
    }
  }

  const resend = async () => {
    setError(null)
    setNote(null)
    try {
      setTimes(await onResend())
      setCode('')
      setNote('A new code is on its way.')
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Could not send a new code.')
    }
  }

  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); void submit() }} noValidate>
      <StatusHead icon={<MailCheck size={24} />} title="Check your email">
        We sent a 6-digit code to <strong>{challenge.sentTo}</strong>.
      </StatusHead>
      <OtpInput value={code} onChange={(v) => { setCode(v); setError(null) }} onComplete={(v) => void submit(v)} disabled={busy} invalid={!!error} />
      <div aria-live="polite" className="stack-s">
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {note && !error && <div className="alert alert-info">{note}</div>}
      </div>
      {trustDays ? (
        <label className="check"><input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} /> Trust this browser for {trustDays} days</label>
      ) : null}
      <Button type="submit" className="w-full" loading={busy} disabled={expiresIn === 0}>Verify and sign in</Button>
      <p className="tiny muted center">
        {expiresIn > 0 ? <>Code expires in {formatSeconds(expiresIn)}. </> : <>This code has expired. </>}
        {resendIn > 0 ? <>Resend available in {resendIn}s.</> : <button type="button" className="link" onClick={resend}>Send a new code</button>}
      </p>
      <p className="tiny center"><button type="button" className="link" onClick={onBack}><ArrowLeft size={12} aria-hidden /> Use a different account</button></p>
    </form>
  )
}
