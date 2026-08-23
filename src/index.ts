/**
 * Host half of dsh-user-question-nav: this plugin is purely client-side,
 * so the host half is a minimal shell that satisfies the DSH plugin contract.
 */
import type { Context } from 'cordis'

export const name = 'dsh-user-question-nav'

export function apply(_ctx: Context): void {
  // No host-side logic: the floating navigation buttons are injected
  // entirely by the client half (src/client/index.ts).
}