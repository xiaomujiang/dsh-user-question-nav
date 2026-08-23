/**
 * Client half of dsh-user-question-nav: injects floating navigation buttons
 * (⏫ previous question / ⏬ next question) into the conversation viewport.
 *
 * Mounting strategy (inspired by dsh-better-sidebar):
 * - Buttons are created and appended to document.body immediately — no
 *   dependency on the conversation scrollport existing yet
 * - Position defaults to the viewport right edge; once the scrollport is
 *   found, position snaps to the conversation area's right edge
 * - A MutationObserver + polling fallback locate the scrollport as soon as
 *   React renders it; no hard refresh needed
 * - Navigation queries [data-chat-flow-kind="user"] elements and scrolls
 *   the target to the viewport center
 */

// ── SVG icons ──────────────────────────────────────────────────────────────

/** Double-chevron-up SVG icon — distinct from the single-chevron "to bottom" button. */
function doubleChevronUpSvg(): string {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 7L8 3L12 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M4 13L8 9L12 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
}

/** Double-chevron-down SVG icon — distinct from the single-chevron "to bottom" button. */
function doubleChevronDownSvg(): string {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 3L8 7L12 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M4 9L8 13L12 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
}

// ── Styles ──────────────────────────────────────────────────────────────────

const BUTTON_STYLE = `
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 100px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-button-floating-fill);
  box-shadow: var(--dsw-shadow-lv2);
  cursor: pointer;
  pointer-events: auto;
  transition: opacity 0.15s, background 0.15s;
`

// ── DOM helpers ─────────────────────────────────────────────────────────────

function findScrollport(): HTMLElement | null {
  const flow = document.querySelector<HTMLElement>('[data-chat-flow]')
  if (flow && flow.isConnected) {
    const scrollDiv = flow.parentElement
    if (scrollDiv) return scrollDiv.closest('[data-conversation-scroll]') ?? scrollDiv
  }
  const ports = document.querySelectorAll<HTMLElement>('[data-conversation-scroll]')
  for (const port of ports) if (port.isConnected) return port
  return null
}

function createNavButton(direction: 'up' | 'down'): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.setAttribute('type', 'button')
  btn.setAttribute('aria-label', direction === 'up' ? '上一个用户问题' : '下一个用户问题')
  btn.setAttribute('data-nav-direction', direction)
  btn.innerHTML = direction === 'up' ? doubleChevronUpSvg() : doubleChevronDownSvg()
  btn.style.cssText = BUTTON_STYLE
  btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--dsw-alias-button-floating-hover)' })
  btn.addEventListener('mouseleave', () => { btn.style.background = 'var(--dsw-alias-button-floating-fill)' })
  return btn
}

function getUserMessages(scrollport: HTMLElement): HTMLElement[] {
  return Array.from(scrollport.querySelectorAll<HTMLElement>('[data-chat-flow-kind="user"]'))
}

function messageTop(msg: HTMLElement, scrollport: HTMLElement): number {
  return msg.getBoundingClientRect().top - scrollport.getBoundingClientRect().top + scrollport.scrollTop
}

function messageCenter(msg: HTMLElement, scrollport: HTMLElement): number {
  return messageTop(msg, scrollport) + msg.getBoundingClientRect().height / 2
}

// ── Navigation ──────────────────────────────────────────────────────────────

function navigateToQuestion(scrollport: HTMLElement, direction: 'up' | 'down'): void {
  const messages = getUserMessages(scrollport)
  if (messages.length === 0) return

  const viewportCenter = scrollport.scrollTop + scrollport.clientHeight / 2
  const buffer = 20
  let target: HTMLElement | null = null

  if (direction === 'up') {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messageCenter(messages[i], scrollport) < viewportCenter - buffer) {
        target = messages[i]; break
      }
    }
    if (!target) target = messages[0]
  } else {
    for (const msg of messages) {
      if (messageCenter(msg, scrollport) > viewportCenter + buffer) {
        target = msg; break
      }
    }
    if (!target) target = messages[messages.length - 1]
  }

  if (target) {
    const scrollTo = messageCenter(target, scrollport) - scrollport.clientHeight / 2
    scrollport.scrollTo({ top: Math.max(0, scrollTo), behavior: 'smooth' })
  }
}

function updateButtonVisibility(
  scrollport: HTMLElement,
  upBtn: HTMLButtonElement,
  downBtn: HTMLButtonElement,
): void {
  const messages = getUserMessages(scrollport)
  if (messages.length === 0) {
    setDimmed(upBtn, true)
    setDimmed(downBtn, true)
    return
  }
  const viewportTop = scrollport.scrollTop
  const viewportBottom = viewportTop + scrollport.clientHeight
  const buffer = 20
  let hasAbove = false
  let hasBelow = false
  for (const msg of messages) {
    const top = messageTop(msg, scrollport)
    if (top < viewportTop + buffer) hasAbove = true
    if (top > viewportBottom - buffer) hasBelow = true
  }
  setDimmed(upBtn, !hasAbove)
  setDimmed(downBtn, !hasBelow)
}

function setDimmed(btn: HTMLButtonElement, dimmed: boolean): void {
  btn.style.opacity = dimmed ? '0.35' : '1'
  btn.dataset.dimmed = dimmed ? '1' : ''
}

function showToast(btn: HTMLButtonElement, message: string): void {
  const existing = btn.querySelector('[data-nav-toast]')
  if (existing) existing.remove()

  const toast = document.createElement('span')
  toast.setAttribute('data-nav-toast', '')
  toast.textContent = message
  toast.style.cssText = `
    position: absolute;
    right: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
    white-space: nowrap;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.3;
    color: var(--dsw-alias-label-primary);
    background: var(--dsw-alias-button-floating-fill);
    border: 1px solid var(--dsw-alias-border-l2);
    box-shadow: var(--dsw-shadow-lv2);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 1;
  `
  btn.style.position = 'relative'
  btn.appendChild(toast)
  requestAnimationFrame(() => { toast.style.opacity = '1' })
  setTimeout(() => {
    toast.style.opacity = '0'
    setTimeout(() => toast.remove(), 200)
  }, 1500)
}

// ── Plugin entry ────────────────────────────────────────────────────────────

export const inject: string[] = []

export function apply(ctx: { effect: (cb: () => () => void) => void }): void {
  // ── Create buttons immediately, append to body (like dsh-better-sidebar) ─
  const navContainer = document.createElement('div')
  navContainer.setAttribute('data-user-question-nav', '')
  navContainer.style.cssText = `
    position: fixed;
    z-index: 8;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    pointer-events: none;
  `
  const upBtn = createNavButton('up')
  const downBtn = createNavButton('down')
  navContainer.appendChild(upBtn)
  navContainer.appendChild(downBtn)
  document.body.appendChild(navContainer)

  // Default position: right edge of viewport, vertically centered.
  // Once the scrollport is found, snaps to the conversation area's right edge.
  const updatePosition = (sp?: HTMLElement): void => {
    if (sp) {
      const rect = sp.getBoundingClientRect()
      const gap = 12
      navContainer.style.right = `${window.innerWidth - rect.right + gap}px`
      navContainer.style.top = `${rect.top + rect.height / 2}px`
    } else {
      // Fallback: 48px from viewport right edge, centered
      navContainer.style.right = '48px'
      navContainer.style.top = '50%'
    }
    navContainer.style.transform = 'translateY(-50%)'
  }
  updatePosition()

  // ── Scrollport tracking ─────────────────────────────────────────────────
  let currentScrollport: HTMLElement | null = null
  let scrollCleanup: (() => void) | null = null
  let resizeObserver: ResizeObserver | null = null
  let onResize: (() => void) | null = null

  /** Attach scroll/resize listeners to a scrollport, wire up button clicks. */
  function attachScrollport(sp: HTMLElement): void {
    if (currentScrollport === sp) return
    // Detach from old scrollport
    detachScrollport()

    currentScrollport = sp
    updatePosition(sp)

    onResize = () => updatePosition(sp)
    window.addEventListener('resize', onResize)

    resizeObserver = new ResizeObserver(() => updatePosition(sp))
    resizeObserver.observe(sp)

    const onScroll = (): void => updateButtonVisibility(sp, upBtn, downBtn)
    sp.addEventListener('scroll', onScroll, { passive: true })

    // Click handlers
    const onUpClick = (): void => {
      if (upBtn.dataset.dimmed) {
        showToast(upBtn, '已经是第一个问题')
      } else {
        navigateToQuestion(sp, 'up')
      }
    }
    const onDownClick = (): void => {
      if (downBtn.dataset.dimmed) {
        showToast(downBtn, '已经是最后一个问题')
      } else {
        navigateToQuestion(sp, 'down')
      }
    }
    upBtn.addEventListener('click', onUpClick)
    downBtn.addEventListener('click', onDownClick)

    updateButtonVisibility(sp, upBtn, downBtn)

    scrollCleanup = () => {
      if (onResize) window.removeEventListener('resize', onResize)
      resizeObserver?.disconnect()
      resizeObserver = null
      sp.removeEventListener('scroll', onScroll)
      upBtn.removeEventListener('click', onUpClick)
      downBtn.removeEventListener('click', onDownClick)
    }
  }

  function detachScrollport(): void {
    scrollCleanup?.()
    scrollCleanup = null
    currentScrollport = null
    // Reset to default position
    updatePosition()
    // Restart polling to find the new scrollport (session switch)
    startPolling()
  }

  /** Try to find the scrollport and attach. Called by observer and polling. */
  function tryAttach(): boolean {
    // If the container was removed from body (exotic shell), re-attach
    if (!document.body.contains(navContainer)) {
      document.body.appendChild(navContainer)
    }
    const sp = findScrollport()
    if (sp && sp !== currentScrollport) {
      attachScrollport(sp)
      return true
    }
    // If no scrollport, keep the default position
    if (!currentScrollport) {
      updatePosition()
    }
    return currentScrollport !== null
  }

  // ── Observer + initial try ──────────────────────────────────────────────
  // Fires on DOM mutations: re-attaches when the scrollport appears,
  // disappears (session switch), or the container is removed from body.
  const observer = new MutationObserver(() => {
    const detached = !currentScrollport || !currentScrollport.isConnected
    if (detached || !document.body.contains(navContainer)) {
      tryAttach()
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })

  if (document.readyState !== 'loading') {
    tryAttach()
  } else {
    document.addEventListener('DOMContentLoaded', () => tryAttach(), { once: true })
  }

  // ── Polling fallback (covers the gap between plugin activation and React render,
  //  and session switches where the observer may fire before the new scrollport exists) ─
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let pollAttempts = 0
  const MAX_POLL_ATTEMPTS = 30 // 15 seconds per cycle

  function startPolling(): void {
    if (pollTimer !== null) return
    pollAttempts = 0
    pollTimer = setInterval(() => {
      pollAttempts++
      if (tryAttach() || pollAttempts >= MAX_POLL_ATTEMPTS) {
        if (pollTimer !== null) { clearInterval(pollTimer); pollTimer = null }
      }
    }, 500)
  }

  function stopPolling(): void {
    if (pollTimer !== null) { clearInterval(pollTimer); pollTimer = null }
  }

  // Start the initial polling cycle
  startPolling()

  // ── Cleanup ──────────────────────────────────────────────────────────────
  ctx.effect(() => {
    return () => {
      observer?.disconnect()
      stopPolling()
      detachScrollport()
      navContainer.remove()
    }
  })
}