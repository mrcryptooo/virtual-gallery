// @ts-check
/**
 * Lint rules implement docs/06-coding-standards.md §5/§7 and the dependency
 * boundaries of docs/02-architecture.md §8. Warnings are errors in CI.
 */
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import boundaries from 'eslint-plugin-boundaries';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'dist-packages/**',
      '.asset-cache/**',
      'coverage/**',
      'docs/**',
      '.husky/**',
      'apps/portfolio/public/**',
    ],
  },

  // ── TypeScript: strict, type-checked (doc 06 §7) ────────────────────────────
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        // Root-level config files sit outside every package tsconfig;
        // typecheck coverage for them comes from e2e/tsconfig.json.
        projectService: {
          allowDefaultProject: ['playwright.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // ── App (React) rules: hooks + accessibility at error level ────────────────
  {
    files: ['apps/portfolio/src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      ...jsxA11y.flatConfigs.recommended.rules,
      // The engine is consumed via its public API only (doc 03 rule 1)
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@virtual-gallery/engine/*'],
              message:
                'Deep imports of engine internals are forbidden — use the public API (@virtual-gallery/engine).',
            },
          ],
        },
      ],
    },
  },

  // ── Dependency boundaries (doc 02 §8 / doc 06 §5) ──────────────────────────
  {
    files: ['packages/engine/src/**/*.ts', 'apps/portfolio/src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['packages/engine/src/**/*', 'apps/portfolio/src/**/*'],
      'boundaries/elements': [
        { type: 'engine-domain', pattern: 'packages/engine/src/domain', mode: 'folder' },
        { type: 'engine-viewer', pattern: 'packages/engine/src/viewer', mode: 'folder' },
        { type: 'engine-transition', pattern: 'packages/engine/src/transition', mode: 'folder' },
        { type: 'engine-hotspots', pattern: 'packages/engine/src/hotspots', mode: 'folder' },
        { type: 'engine-loader', pattern: 'packages/engine/src/loader', mode: 'folder' },
        { type: 'engine-root', pattern: 'packages/engine/src', mode: 'folder' },
        { type: 'app-stores', pattern: 'apps/portfolio/src/stores', mode: 'folder' },
        { type: 'app-components', pattern: 'apps/portfolio/src/components', mode: 'folder' },
        { type: 'app-root', pattern: 'apps/portfolio/src', mode: 'folder' },
      ],
    },
    rules: {
      // engine/domain stays pure; only viewer/ and transition/ may touch PSV (ADR-002);
      // no React/state libs anywhere in the engine; app never touches PSV or three.
      'boundaries/external': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              from: ['engine-domain', 'engine-hotspots', 'engine-loader', 'engine-root'],
              disallow: [
                'react',
                'react-dom',
                'react/*',
                'zustand',
                'motion',
                'three',
                '@photo-sphere-viewer/*',
              ],
              message:
                'Frozen boundary (doc 02 §8): this engine layer must stay free of UI/state/rendering deps; only viewer/ and transition/ may import Photo Sphere Viewer.',
            },
            {
              from: ['engine-viewer', 'engine-transition'],
              disallow: ['react', 'react-dom', 'react/*', 'zustand', 'motion', 'three'],
              message:
                'Frozen boundary (ADR-002): no React/state libs in the engine; three.js arrives only via Photo Sphere Viewer.',
            },
            {
              from: ['app-root', 'app-stores', 'app-components'],
              disallow: ['three', '@photo-sphere-viewer/*'],
              message:
                'Frozen boundary (doc 02 §8): the app never imports PSV or three — use the engine public API.',
            },
          ],
        },
      ],
      // domain/ imports nothing from other engine layers (doc 03 rule 4)
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              from: ['engine-domain'],
              disallow: [
                'engine-viewer',
                'engine-transition',
                'engine-hotspots',
                'engine-loader',
                'engine-root',
              ],
              message: 'Frozen boundary: engine domain/ is pure and imports no other engine layer.',
            },
          ],
        },
      ],
    },
  },

  // ── Plain JS config files: no type-checked rules ────────────────────────────
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
