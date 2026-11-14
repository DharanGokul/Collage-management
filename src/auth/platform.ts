import type { Directory } from './types'
import { pushMailbox } from './storage'

/** Auth scope of the platform operator (the super admin), separate from every college. */
export const PLATFORM_SCOPE = 'platform'
export const SUPER_ADMIN_EMAIL: string = import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'super@campusone.app'

export function platformDirectory(): Directory {
  return {
    scope: PLATFORM_SCOPE,
    linkBase: `${window.location.origin}${window.location.pathname}`,
    brand: { name: 'Campus One platform', supportEmail: '' },
    find: (role, id) => (role === 'super' && id.trim().toLowerCase() === SUPER_ADMIN_EMAIL ? { subjectId: 'super', name: 'Platform admin', email: SUPER_ADMIN_EMAIL, active: true } : null),
    findByEmail: (email) => (email.trim().toLowerCase() === SUPER_ADMIN_EMAIL ? { role: 'super', person: { subjectId: 'super', name: 'Platform admin', email: SUPER_ADMIN_EMAIL, active: true } } : null),
    deliver: async (m) => pushMailbox(PLATFORM_SCOPE, m),
  }
}
