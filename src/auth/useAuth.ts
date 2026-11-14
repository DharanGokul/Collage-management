import { useMemo } from 'react'
import { useStore } from '../store/AppStore'
import { getTenant, portalUrl } from '../lib/tenant'
import { sendEmail, validateEmailSettings } from '../lib/email'
import * as svc from './service'
import { AUTH_DEMO } from './service'
import { pushMailbox, readDeviceToken, writeDeviceToken } from './storage'
import type { Database } from '../types'
import type { AccountRole, Directory, Person } from './types'

const lc = (s: string) => s.trim().toLowerCase()

function buildDirectory(db: Database, tenantId: string): Directory {
  const adminEmail = getTenant(tenantId)?.adminEmail ?? db.adminProfile.email
  const admin: Person = { subjectId: 'admin', name: db.adminProfile.name || 'Administrator', email: adminEmail, active: true }
  const staff = (s: Database['staff'][number]): Person => ({ subjectId: s.id, name: s.name, email: s.email, active: s.status === 'active' })
  const acct = (s: Database['accountants'][number]): Person => ({ subjectId: s.id, name: s.name, email: s.email, active: s.status === 'active' })
  const student = (s: Database['students'][number]): Person => ({ subjectId: s.id, name: s.name, email: s.email, active: s.status === 'active' })
  const d = db.domain
  // Links in emails use the college's own verified domain when it has one, never the platform's.
  const origin = `${window.location.origin}${window.location.pathname}`
  const verified = d.domainStatus === 'verified' && !!d.customDomain
  const linkBase = verified && window.location.hostname !== d.customDomain && !/^(localhost|127\.)/.test(window.location.hostname) ? `${portalUrl(d.subdomain, d.customDomain, true)}/` : origin

  return {
    scope: tenantId,
    linkBase,
    brand: { name: db.branding.collegeName, supportEmail: db.branding.supportEmail },
    find(role, identifier) {
      const id = lc(identifier)
      if (!id) return null
      if (role === 'admin') return id === lc(adminEmail) ? admin : null // the registry's admin email is authoritative; the seed profile address must not work in a provisioned college
      if (role === 'staff') {
        const s = db.staff.find((x) => lc(x.email) === id || lc(x.empId) === id)
        return s ? staff(s) : null
      }
      if (role === 'accountant') {
        const a = db.accountants.find((x) => lc(x.email) === id || lc(x.empId) === id)
        return a ? acct(a) : null
      }
      if (role === 'student') {
        const s = db.students.find((x) => lc(x.rollNo) === id || lc(x.email) === id)
        return s ? student(s) : null
      }
      return null
    },
    findByEmail(email) {
      const id = lc(email)
      if (id === lc(adminEmail)) return { role: 'admin' as AccountRole, person: admin }
      const s = db.staff.find((x) => lc(x.email) === id)
      if (s) return { role: 'staff' as AccountRole, person: staff(s) }
      const a = db.accountants.find((x) => lc(x.email) === id)
      if (a) return { role: 'accountant' as AccountRole, person: acct(a) }
      const st = db.students.find((x) => lc(x.email) === id)
      return st ? { role: 'student' as AccountRole, person: student(st) } : null
    },
    async deliver(mail) {
      if (AUTH_DEMO) pushMailbox(tenantId, mail)
      // When the college has configured real e-mail, the same message goes out through it.
      if (!validateEmailSettings(db.email)) {
        const res = await sendEmail(db.email, { to: [mail.to], subject: mail.subject, body: mail.body }).catch(() => null)
        if (res && !res.ok && !AUTH_DEMO) throw new Error(res.error ?? 'Email could not be sent')
      }
    },
  }
}

/** Auth API bound to the current college. Every method is async and maps to one backend endpoint. */
export function useAuth() {
  const { db, tenant } = useStore()
  const scope = tenant.id
  const dir = useMemo(() => buildDirectory(db, scope), [db, scope])
  return useMemo(
    () => ({
      scope,
      dir,
      async signIn(input: Omit<svc.SignInInput, 'deviceToken'>) {
        const res = await svc.signIn(dir, { ...input, deviceToken: readDeviceToken(scope) })
        return res
      },
      async verifyOtp(input: { challengeId: string; code: string; trustDevice: boolean }) {
        const res = await svc.verifyOtp(dir, input)
        if (res.deviceToken) writeDeviceToken(scope, res.deviceToken)
        return res
      },
      resendOtp: (challengeId: string) => svc.resendOtp(dir, challengeId),
      verifyEmail: (token: string) => svc.verifyEmail(dir, token),
      resendVerification: (email: string) => svc.resendVerification(dir, email),
      requestPasswordReset: (email: string) => svc.requestPasswordReset(dir, email),
      inspectToken: (token: string, kind: 'password_reset' | 'invite') => svc.inspectToken(dir, token, kind),
      resetPassword: (token: string, password: string) => svc.resetPassword(dir, token, password),
      activateAccount: (token: string, password: string) => svc.activateAccount(dir, token, password),
      changePassword: (aid: string, current: string, next: string) => svc.changePassword(dir, { aid }, current, next),
    }),
    [dir, scope],
  )
}
