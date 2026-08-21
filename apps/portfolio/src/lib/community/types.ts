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
  /** Real users.id when submitted while signed in, null for an
      anonymous submission -- derived server-side from the session,
      never trusted from the client (see api/submissions.ts). */
  userId: string | null;
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
 * api/screenshots.ts). `userId` is real users.id when captured while
 * signed in, null for an anonymous capture -- derived server-side from
 * the session, never trusted from the client.
 *
 * Every capture is composited client-side into a fixed 1920x1080 artwork
 * (the current museum view, cover-cropped, with one of five templates
 * drawn full-frame on top) before it's ever uploaded -- width/height are
 * therefore always exactly 1920x1080, enforced again server-side in
 * api/screenshots.ts rather than trusted from the client.
 */
export interface ScreenshotRecord {
  id: string;
  createdAt: string;
  userId: string | null;
  /** Which static tour export this came from, e.g. "modern-museum". */
  projectId: string;
  /** The Marzipano scene id active at capture time, e.g. "5-06". */
  panoramaId: string;
  /** The scene's authored display name at capture time, e.g. "5.06" --
      captured alongside panoramaId since scene names aren't guaranteed
      stable/lookupable later (an authored tour can rename or remove a
      scene), and the gallery/admin/Telegram notification all want a
      human-readable title without re-fetching the tour's data.js. */
  panoramaTitle: string;
  media: SubmissionMedia;
  /** Always exactly 1920. */
  width: number;
  /** Always exactly 1080. */
  height: number;
  /** Which of the five overlay templates was randomly selected for this
      capture, e.g. "template-3" -- null only for records created before
      the template system existed. */
  template: string | null;
  /** Viewport size at capture time (coarse device context for admin
      review; not a fingerprinting signal). Older/degraded clients may
      omit it. */
  viewport: { width: number; height: number } | null;
}
