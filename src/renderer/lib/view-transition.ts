import type { MouseEvent } from 'react'

let navigationRequest = 0

function activeViewTransition() {
  if (typeof document === 'undefined') return undefined

  return (
    document as Document & {
      activeViewTransition?: {
        finished: Promise<void>
        skipTransition: () => void
      }
    }
  ).activeViewTransition
}

export function navigateAfterViewTransition(
  to: string,
  navigate: (to: string) => void,
  event?: MouseEvent<HTMLAnchorElement>
): void {
  const request = ++navigationRequest
  if (
    event &&
    (event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !activeViewTransition())
  )
    return

  event?.preventDefault()
  void finishViewTransitionAnimations().then(() => {
    if (request === navigationRequest) navigate(to)
  })
}

export async function finishViewTransitionAnimations(): Promise<void> {
  if (
    typeof document === 'undefined' ||
    typeof document.getAnimations !== 'function'
  )
    return

  const activeTransition = activeViewTransition()
  if (activeTransition) {
    try {
      activeTransition.skipTransition()
      await activeTransition.finished.catch(() => {})
      // The pseudo-element tree can outlive the transition by one frame.
      const deadline = performance.now() + 120
      while (performance.now() < deadline && hasViewTransitionAnimations()) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve())
        )
      }
    } catch {
      // The active transition can finish between reading it and skipping it.
    }
  }

  for (const animation of document.getAnimations()) {
    const pseudoElement =
      animation.effect instanceof KeyframeEffect
        ? animation.effect.pseudoElement
        : null
    if (!pseudoElement?.startsWith('::view-transition')) continue

    try {
      animation.finish()
    } catch {
      // A transition can complete between getAnimations() and finish().
    }
  }
}

function hasViewTransitionAnimations(): boolean {
  return document.getAnimations().some((animation) => {
    const pseudoElement =
      animation.effect instanceof KeyframeEffect
        ? animation.effect.pseudoElement
        : null
    return pseudoElement?.startsWith('::view-transition')
  })
}
