import { PLATFORM_EN, PLATFORM_NAME, PLATFORM_TAGLINE } from '@/config'
import { StarIcon } from './icons'

export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label={`${PLATFORM_NAME}首页`}>
        <span className="brand-mark" aria-hidden="true">
          <StarIcon />
        </span>
        <span className="brand-text">
          <strong>{PLATFORM_NAME}</strong>
          <small>
            {PLATFORM_EN} · {PLATFORM_TAGLINE}
          </small>
        </span>
      </a>

      <nav className="site-nav" aria-label="主导航">
        <a className="is-active" href="#route-map">
          长征之路
        </a>
      </nav>

      <div className="header-right">
        <span className="header-years">1934 — 1936</span>
      </div>
    </header>
  )
}
