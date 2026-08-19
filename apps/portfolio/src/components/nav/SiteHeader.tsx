import { useState, type ReactNode } from 'react';
import styles from './SiteHeader.module.css';

const NAV_LINKS = [
  { href: '/p/modern-museum', label: 'Museum' },
  { href: '/competition', label: 'Competition' },
  { href: '/submit', label: 'Submit Your Art' },
];

export interface SiteHeaderProps {
  /** Extra control rendered after the nav links on desktop (the sound toggle on the landing page only). */
  trailing?: ReactNode;
  /** True once the page's own entrance choreography has settled, so the header fades in alongside it. */
  revealed?: boolean;
}

/**
 * Shared museum-identity header: wordmark top-left, a restrained text nav
 * top-right (collapsing to a single menu control below the tablet
 * breakpoint), consistent across the landing page and the Competition /
 * Submit Your Art routes so they read as one institution rather than
 * separate mini-sites.
 */
export function SiteHeader({ trailing, revealed = true }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const path = typeof window !== 'undefined' ? window.location.pathname : '';

  return (
    <header className={`${styles['header'] ?? ''} ${revealed ? (styles['revealed'] ?? '') : ''}`}>
      <a className={styles['wordmark']} href="/">
        Seismic Museum
      </a>

      <nav className={styles['nav']} aria-label="Primary">
        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className={styles['navLink']}
            aria-current={path === link.href ? 'page' : undefined}
          >
            {link.label}
          </a>
        ))}
        {trailing}
      </nav>

      <div className={styles['mobileControls']}>
        {trailing}
        <button
          type="button"
          className={styles['menuButton']}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="site-mobile-nav"
          onClick={() => {
            setMenuOpen((open) => !open);
          }}
        >
          <span className={styles['menuIconBar']} aria-hidden="true" />
          <span className={styles['menuIconBar']} aria-hidden="true" />
        </button>
      </div>

      {menuOpen && (
        <nav id="site-mobile-nav" className={styles['mobileNav']} aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={styles['mobileNavLink']}
              aria-current={path === link.href ? 'page' : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
