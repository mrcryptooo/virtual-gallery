import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Panel } from '@/components/ui/Panel';
import { Toast } from '@/components/ui/Toast';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import styles from './DevTokensPage.module.css';

const COLOR_TOKENS = [
  '--color-bg',
  '--color-surface',
  '--color-surface-raised',
  '--color-ink',
  '--color-ink-soft',
  '--color-line',
  '--color-accent',
  '--color-focus-ring',
  '--color-paper',
  '--color-paper-ink',
];

const SPACE_TOKENS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const MOTION_TOKENS = [
  ['--motion-instant', 'hover/press feedback, focus rings'],
  ['--motion-quick', 'tooltips, chrome fade'],
  ['--motion-standard', 'panels, overlays'],
  ['--motion-scene', 'scene transition (move + blend)'],
  ['--motion-slow', 'first-entry reveal, loader exit'],
  ['--ease-standard', 'default DOM easing'],
  ['--ease-exit', 'elements leaving'],
] as const;

/**
 * Internal showcase (M0.3, dev builds only): every token and every primitive
 * state on one page, for the owner's design-system review checkpoint.
 * Not a product surface — excluded from production by the DEV gate in App.
 */
export function DevTokensPage() {
  return (
    <main className={styles['page']}>
      <h1 className="type-display">Tokens</h1>
      <p className="type-caption">
        docs/11 §1 + docs/10 §2 — dev-only showcase for the M0.3 review checkpoint
      </p>

      <section aria-labelledby="colors">
        <h2 id="colors" className="type-title">
          Color
        </h2>
        <ul className={styles['swatches']}>
          {COLOR_TOKENS.map((token) => (
            <li key={token} className={styles['swatch']}>
              <span
                className={styles['swatchChip']}
                style={{ background: `var(${token})` }}
                aria-hidden="true"
              />
              <code className="type-caption">{token}</code>
            </li>
          ))}
          <li className={styles['swatch']}>
            <span
              className={[styles['swatchChip'], styles['scrimDemo']].filter(Boolean).join(' ')}
              aria-hidden="true"
            />
            <code className="type-caption">--scrim / --scrim-edge</code>
          </li>
        </ul>
      </section>

      <section aria-labelledby="typography">
        <h2 id="typography" className="type-title">
          Typography
        </h2>
        <p className="type-display">Display — Playfair 500</p>
        <p className="type-title">Title — Playfair 500 · 2rem</p>
        <p className="type-heading">Heading — Inter 600 · 1.125rem</p>
        <p className="type-body">
          Body — Inter 400 · 1rem / 1.6. The panorama images are the product; the engine only
          presents them.
        </p>
        <p className="type-caption">Caption — Inter 400 · 0.875rem · tabular 0123456789</p>
        <p className="type-label">Label — Inter 500 · uppercase · 0.08em</p>
      </section>

      <section aria-labelledby="spacing">
        <h2 id="spacing" className="type-title">
          Spacing · radius · elevation
        </h2>
        <ul className={styles['spacingList']}>
          {SPACE_TOKENS.map((step) => (
            <li key={step} className={styles['spacingRow']}>
              <code className="type-caption">--space-{step}</code>
              <span
                className={styles['spacingBar']}
                style={{ width: `var(--space-${String(step)})` }}
                aria-hidden="true"
              />
            </li>
          ))}
        </ul>
        <div className={styles['row']}>
          <Panel>Panel — surface, hairline, radius-m</Panel>
          <Panel raised>Panel raised — overlay shadow</Panel>
        </div>
      </section>

      <section aria-labelledby="motion">
        <h2 id="motion" className="type-title">
          Motion
        </h2>
        <table className={styles['motionTable']}>
          <thead>
            <tr>
              <th scope="col" className="type-label">
                Token
              </th>
              <th scope="col" className="type-label">
                Use
              </th>
            </tr>
          </thead>
          <tbody>
            {MOTION_TOKENS.map(([token, use]) => (
              <tr key={token}>
                <td>
                  <code className="type-caption">{token}</code>
                </td>
                <td className="type-caption">{use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="primitives">
        <h2 id="primitives" className="type-title">
          Primitives — interaction states
        </h2>
        <p className="type-caption">
          Hover, active, and focus-visible are live — use pointer and Tab to review them.
        </p>
        <div className={styles['row']}>
          <Button variant="primary">Primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="primary" loading>
            Loading
          </Button>
        </div>
        <div className={styles['row']}>
          <IconButton label="Open space index">▦</IconButton>
          <IconButton label="Fullscreen">⛶</IconButton>
          <IconButton label="Share">↗</IconButton>
          <IconButton label="Disabled example" disabled>
            ✕
          </IconButton>
        </div>
        <div className={styles['row']}>
          <Toast>Link copied — toast (role=status)</Toast>
        </div>
        <p className="type-body">
          VisuallyHidden (inspect with a screen reader):
          <VisuallyHidden>This sentence is available to assistive tech only.</VisuallyHidden>
          <span aria-hidden="true"> [SR-only content here]</span>
        </p>
        <p className="type-caption">
          Scrim is exercised by overlay components (M2/M3); its token appears in the Color section.
        </p>
      </section>
    </main>
  );
}
