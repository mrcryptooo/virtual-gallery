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
