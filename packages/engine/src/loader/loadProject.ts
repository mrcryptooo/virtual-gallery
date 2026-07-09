/**
 * Project Loader (doc 02 §2.5): fetch + contract-validate a project package
 * manifest. Runtime re-validation is defense in depth — packages can be
 * dropped into public/projects/ by hand (F9), so the engine never trusts
 * unvalidated JSON.
 */
import { parseProjectManifest, type ProjectManifest } from '../domain/manifest/schema.ts';
import { validateProjectInvariants } from '../domain/manifest/invariants.ts';

export class ProjectLoadError extends Error {
  // No TS parameter properties: engine sources run under Node's strip-only
  // TS loader in the pipeline CLI (erasable syntax only).
  readonly issues: readonly string[];

  constructor(message: string, issues: readonly string[] = []) {
    super(message);
    this.name = 'ProjectLoadError';
    this.issues = issues;
  }
}

/** Loads `<packageBaseUrl>/project.json` and validates it fully. */
export async function loadProject(packageBaseUrl: string): Promise<ProjectManifest> {
  const url = `${packageBaseUrl}/project.json`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    throw new ProjectLoadError(`network error fetching ${url}: ${String(cause)}`);
  }
  if (!response.ok) {
    throw new ProjectLoadError(`HTTP ${String(response.status)} fetching ${url}`);
  }

  const data: unknown = await response.json();
  const parsed = parseProjectManifest(data);
  if (!parsed.ok) {
    throw new ProjectLoadError(`invalid manifest at ${url}`, parsed.issues);
  }
  const invariantIssues = validateProjectInvariants(parsed.project);
  if (invariantIssues.length > 0) {
    throw new ProjectLoadError(`manifest invariants failed at ${url}`, invariantIssues);
  }
  return parsed.project;
}
