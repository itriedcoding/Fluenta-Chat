import { useEffect, useState } from 'react'
import { checkForUpdate, RELEASES_PAGE, type UpdateCheck } from '../lib/updater'

const DISMISS_KEY = 'fluenta.dismissedUpdate'

export default function UpdateBanner() {
  const [check, setCheck] = useState<UpdateCheck | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(DISMISS_KEY)
    setDismissed(stored)
    let cancelled = false
    void checkForUpdate(__APP_VERSION__).then((result) => {
      if (!cancelled) setCheck(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!check || check.status !== 'available' || !check.latest) return null
  if (dismissed === check.latest) return null

  const download = check.asset?.browser_download_url ?? check.release?.html_url ?? RELEASES_PAGE

  return (
    <div className="update-banner" role="status">
      <span className="update-dot" />
      <span>
        Fluenta <strong>{check.latest}</strong> is available — you have {check.current}.
      </span>
      <a className="update-link" href={download} target="_blank" rel="noreferrer noopener">
        {check.asset ? 'Download' : 'Open releases'}
      </a>
      <button
        className="update-dismiss"
        aria-label="Dismiss update"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, check.latest!)
          setDismissed(check.latest!)
        }}
      >
        ✕
      </button>
    </div>
  )
}
