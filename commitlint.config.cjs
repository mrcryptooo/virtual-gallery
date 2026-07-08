/**
 * Conventional Commits per docs/06-coding-standards.md §9.
 * `content` is the sanctioned extra type for content-only changes
 * (project packages under apps/portfolio/public/projects/).
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'perf',
        'refactor',
        'docs',
        'test',
        'build',
        'ci',
        'chore',
        'style',
        'revert',
        'content',
      ],
    ],
  },
};
