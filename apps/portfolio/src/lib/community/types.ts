/**
 * Shared shapes for the Competition and Submit Your Art features. Kept
 * separate from any one page/route so the Phase 2 admin panel and the
 * eventual Competition listing can import the same contracts the API
 * routes (see /api/submissions.ts) already produce, without a schema
 * migration when those UIs arrive.
 */

/** Moderation lifecycle for a submitted artwork. Always starts "pending". */
export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'archived';

export interface SubmissionMedia {
  /** Public Blob URL, already uploaded client-side before the record is created. */
  url: string;
  pathname: string;
  contentType: string;
}

export interface SubmissionRecord {
  id: string;
  createdAt: string;
  artistName: string;
  email: string;
  socialLinks: string;
  artworkTitle: string;
  description: string;
  medium: string;
  portfolioUrl: string;
  media: SubmissionMedia[];
  status: SubmissionStatus;
}

/** Not populated yet -- Competitions ships as "coming soon" this phase. */
export type CompetitionKind = 'official' | 'community';
export type CompetitionStatus = 'draft' | 'upcoming' | 'open' | 'closed' | 'archived';

export interface CompetitionRecord {
  id: string;
  title: string;
  organizer: string;
  kind: CompetitionKind;
  description: string;
  opensAt: string;
  closesAt: string;
  media: SubmissionMedia[];
  rules: string;
  prize: string;
  submissionUrl: string;
  status: CompetitionStatus;
}

/**
 * A museum snapshot (see the camera control in the modern-museum tour)
 * persisted server-side, metadata separate from the image bytes (the PNG
 * lives in Blob storage; this record only holds a reference to it -- see
 * api/screenshots.ts). `userId` is nullable on purpose: there is no
 * authentication system yet (Requirement 2/"Profile System" in this
 * milestone's spec is documented as blocked, not faked), so every capture
 * is currently anonymous. The field exists now so that once real
 * authentication exists, captures can be attributed to a user without a
 * schema migration -- this is exactly the "ready for user association"
 * shape the spec asks for.
 */
export interface ScreenshotRecord {
  id: string;
  createdAt: string;
  /** null until real authentication exists (see docs note above). */
  userId: string | null;
  /** Which static tour export this came from, e.g. "modern-museum". */
  projectId: string;
  /** The Marzipano scene id active at capture time, e.g. "5-06". */
  panoramaId: string;
  media: SubmissionMedia;
  width: number;
  height: number;
  /** Overlay template applied at capture time, if any (see the screenshot
      engine's configurable overlay system) -- null while overlay.enabled
      is false (no owner branding asset supplied yet). */
  template: string | null;
}
