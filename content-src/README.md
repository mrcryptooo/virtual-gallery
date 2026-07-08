# content-src/ — artist territory

Pipeline **input** (never deployed): one folder per project containing Lumion
equirectangular masters (`panos/`) and the hand-edited `project.authoring.json`.

Export conventions and the publishing runbook: [docs/07-asset-pipeline.md](../docs/07-asset-pipeline.md) §5/§7.
The pipeline (`scripts/build-package.mjs`, from M0.5) turns these into
self-contained packages that are copied into `apps/portfolio/public/projects/`.
