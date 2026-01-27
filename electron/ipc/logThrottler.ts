import type { BrowserWindow } from 'electron'

export type LogSender = (msg: string) => void

/**
 * Creates a log sender for `launcher:log` that:
 * - prefixes logs with a timestamp
 * - throttles noisy high-frequency progress lines
 *
 * Invariants: channel name and log payload are unchanged (string).
 */
export function createThrottledLauncherLogSender(window: BrowserWindow): LogSender {
  const formatTimestamp = () => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  const withTimestamp = (msg: string) => {
    // Avoid double-prefixing if already timestamped.
    if (/^\d{2}:\d{2}:\d{2}\b/.test(msg)) return msg
    return `${formatTimestamp()} ${msg}`
  }

  /**
   * Avoid spamming the renderer with ultra-high-frequency progress logs.
   * Keep important logs (errors, failures, state transitions) intact.
   */
  const LOG_PROGRESS_THROTTLE_MS = 1000
  const LOG_PROGRESS_SUMMARY_MS = 5000
  const logBuckets = new Map<
    string,
    { lastSentAt: number; suppressed: number; lastSummaryAt: number; sample?: string }
  >()

  const stripTimestamp = (s: string) => s.replace(/^\d{2}:\d{2}:\d{2}\s+/, '')

  const isImportantLog = (s: string) => {
    const lower = s.toLowerCase()
    return (
      lower.includes('[fatal]') ||
      lower.includes('[error]') ||
      lower.includes(' error') ||
      lower.includes('failed') ||
      lower.includes('exception') ||
      lower.includes('stack') ||
      lower.includes('traceback') ||
      lower.includes('✗')
    )
  }

  const isLikelyProgressLog = (s: string) => {
    const lower = s.toLowerCase()
    // Never throttle game output – users often need full logs.
    if (lower.includes('[game]')) return false
    if (isImportantLog(lower)) return false

    const hasPercent = /\b\d{1,3}%\b/.test(lower)
    const hasFraction = /\b\d+\s*\/\s*\d+\b/.test(lower)
    const hasBytes = /\b\d+\s*(b|kb|mb|gb|kib|mib|gib)\b/.test(lower)
    const hasSpeed = /\b\d+(\.\d+)?\s*(kb\/s|mb\/s|gb\/s|kib\/s|mib\/s|gib\/s)\b/.test(lower)
    const hasEta = lower.includes('eta')

    const hasDownloadWord =
      lower.includes('download') ||
      lower.includes('downloading') ||
      lower.includes('downloaded') ||
      lower.includes('fetching') ||
      lower.includes('progress')

    const hasKnownPhases =
      lower.includes('assets') ||
      lower.includes('natives') ||
      lower.includes('classes') ||
      lower.includes('libraries')

    // Require at least one "changing numeric" indicator, and some context that it's progress.
    const hasNumeric = hasPercent || hasFraction || hasBytes || hasSpeed || hasEta
    return hasNumeric && (hasDownloadWord || hasKnownPhases)
  }

  const makeSignature = (s: string) => {
    const noTs = stripTimestamp(s.trim())
    // Replace most numbers to group "same log but different counters".
    return noTs.replace(/\d+(?:\.\d+)?/g, '#').replace(/\s+/g, ' ').slice(0, 220)
  }

  return (msg: string) => {
    if (window.isDestroyed()) return

    const raw = msg ?? ''
    if (raw && isLikelyProgressLog(raw)) {
      const now = Date.now()
      const signature = makeSignature(raw)
      const bucket =
        logBuckets.get(signature) ??
        ({ lastSentAt: 0, suppressed: 0, lastSummaryAt: 0, sample: undefined } as const)

      // Send at most 1 progress line per bucket per second.
      if (now - bucket.lastSentAt < LOG_PROGRESS_THROTTLE_MS) {
        // `bucket` is from Map or const; clone to mutate safely.
        const next = { ...bucket }
        next.suppressed += 1
        if (!next.sample) next.sample = stripTimestamp(raw).trim().slice(0, 160)

        // Emit a periodic summary so the user knows something is happening.
        if (now - next.lastSummaryAt >= LOG_PROGRESS_SUMMARY_MS && next.suppressed > 0) {
          next.lastSummaryAt = now
          const summary =
            `[Download] (suppressed ${next.suppressed} noisy progress lines) ` +
            (next.sample ? `e.g. ${next.sample}` : '')
          window.webContents.send('launcher:log', withTimestamp(summary.trim()))
          next.suppressed = 0
          next.sample = undefined
        }

        logBuckets.set(signature, next)
        return
      }

      const next = { ...bucket, lastSentAt: now }
      // Reset summary timer if this is the first line after a quiet period.
      if (now - next.lastSummaryAt > LOG_PROGRESS_SUMMARY_MS * 4) {
        next.lastSummaryAt = now
        next.suppressed = 0
        next.sample = undefined
      }
      logBuckets.set(signature, next)
    }

    window.webContents.send('launcher:log', withTimestamp(raw))
  }
}

