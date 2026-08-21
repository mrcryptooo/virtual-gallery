import { upload } from '@vercel/blob/client';
import { useCallback, useId, useRef, useState } from 'react';
import { SiteHeader } from '@/components/nav/SiteHeader';
import type { SubmissionMedia } from '@/lib/community/types';
import styles from './SubmitArtPage.module.css';

const MAX_FILES = 3;
const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

interface PendingFile {
  id: string;
  file: File;
  previewUrl: string | null;
  progress: number;
  error: string | null;
}

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

function isVideo(file: File): boolean {
  return file.type.startsWith('video/');
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.has(file.type)) {
    return 'Unsupported file type. Use JPG, PNG, WEBP, MP4, MOV, or WebM.';
  }
  const limit = isVideo(file) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > limit) {
    return `File is too large (max ${String(Math.round(limit / (1024 * 1024)))}MB).`;
  }
  return null;
}

/**
 * `/submit` — Submit Your Art. Files upload directly from the browser to
 * Vercel Blob (see api/blob-upload.ts for why: it keeps large video
 * uploads off this function's own body-size limit), then the resulting
 * URLs are posted as small JSON to /api/submissions, which is what
 * actually creates the persistent record. Nothing here promises
 * acceptance into the museum -- see the consent copy below the file list.
 */
export function SubmitArtPage() {
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [artistName, setArtistName] = useState('');
  const [email, setEmail] = useState('');
  const [socialLinks, setSocialLinks] = useState('');
  const [artworkTitle, setArtworkTitle] = useState('');
  const [description, setDescription] = useState('');
  const [medium, setMedium] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<FormStatus>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formId = useId();

  const addFiles = useCallback((incoming: FileList | File[]) => {
    setFiles((current) => {
      const room = MAX_FILES - current.length;
      if (room <= 0) return current;
      const next: PendingFile[] = [...current];
      for (const file of Array.from(incoming).slice(0, room)) {
        const error = validateFile(file);
        next.push({
          id: `${file.name}-${String(file.size)}-${String(Date.now())}-${Math.random().toString(36).slice(2)}`,
          file,
          previewUrl: error || isVideo(file) ? null : URL.createObjectURL(file),
          progress: 0,
          error,
        });
      }
      return next;
    });
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((current) => {
      const target = current.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((f) => f.id !== id);
    });
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
    },
    [addFiles],
  );

  const handleSubmit = useCallback(
    async (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFormError(null);

      const validFiles = files.filter((f) => !f.error);
      if (validFiles.length === 0) {
        setFormError('Attach at least one image or video of your work.');
        return;
      }
      if (!consent) {
        setFormError('Please confirm the submission terms below.');
        return;
      }

      setStatus('submitting');
      try {
        const media: SubmissionMedia[] = [];
        for (const pending of validFiles) {
          // The prefix must be requested here, not left to the server to
          // add: @vercel/blob/client's onBeforeGenerateToken callback has
          // no way to rewrite the path server-side, only to validate/reject
          // the path the client asked for (see api/blob-upload.ts).
          const result = await upload(`submissions/media/${pending.file.name}`, pending.file, {
            access: 'public',
            handleUploadUrl: '/api/blob-upload',
            onUploadProgress: ({ percentage }) => {
              setFiles((current) =>
                current.map((f) => (f.id === pending.id ? { ...f, progress: percentage } : f)),
              );
            },
          });
          media.push({
            url: result.url,
            pathname: result.pathname,
            contentType: pending.file.type,
          });
        }

        const response = await fetch('/api/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artistName,
            email,
            socialLinks,
            artworkTitle,
            description,
            medium,
            portfolioUrl,
            media,
            consent,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? 'Submission failed. Please try again.');
        }

        setStatus('success');
      } catch (error) {
        setStatus('error');
        setFormError(
          error instanceof Error ? error.message : 'Submission failed. Please try again.',
        );
      }
    },
    [
      artistName,
      artworkTitle,
      consent,
      description,
      email,
      files,
      medium,
      portfolioUrl,
      socialLinks,
    ],
  );

  if (status === 'success') {
    return (
      <div className={styles['page']}>
        <SiteHeader />
        <main className={styles['stage']}>
          <div className={styles['successPanel']} role="status">
            <p className={styles['eyebrow']}>Submission received</p>
            <h1 className={styles['title']}>Thank you.</h1>
            <p className={styles['body']}>
              Our team will review your work for future Seismic Museum exhibitions. We&rsquo;ll
              reach out if there&rsquo;s a place for it.
            </p>
            <a className={styles['back']} href="/">
              &larr; Back to the entrance
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles['page']}>
      <SiteHeader />
      <main className={styles['stage']}>
        <header className={styles['intro']}>
          <p className={styles['eyebrow']}>Seismic Museum</p>
          <h1 className={styles['title']}>Submit Your Art</h1>
          <p className={styles['body']}>
            Share your work with Seismic Museum. After review, we may give it a place in the museum,
            build a dedicated area for it, or reach out about inclusion.
          </p>
        </header>

        <form className={styles['form']} onSubmit={(event) => void handleSubmit(event)}>
          <div className={styles['grid']}>
            <label className={styles['field']} htmlFor={`${formId}-artistName`}>
              <span className={styles['label']}>Artist / Display Name *</span>
              <input
                id={`${formId}-artistName`}
                type="text"
                required
                value={artistName}
                onChange={(e) => {
                  setArtistName(e.target.value);
                }}
              />
            </label>

            <label className={styles['field']} htmlFor={`${formId}-email`}>
              <span className={styles['label']}>Email *</span>
              <input
                id={`${formId}-email`}
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
              />
            </label>

            <label className={styles['field']} htmlFor={`${formId}-social`}>
              <span className={styles['label']}>X / Instagram / Website</span>
              <input
                id={`${formId}-social`}
                type="text"
                value={socialLinks}
                onChange={(e) => {
                  setSocialLinks(e.target.value);
                }}
              />
            </label>

            <label className={styles['field']} htmlFor={`${formId}-title`}>
              <span className={styles['label']}>Artwork Title *</span>
              <input
                id={`${formId}-title`}
                type="text"
                required
                value={artworkTitle}
                onChange={(e) => {
                  setArtworkTitle(e.target.value);
                }}
              />
            </label>

            <label className={styles['field']} htmlFor={`${formId}-medium`}>
              <span className={styles['label']}>Category / Medium</span>
              <input
                id={`${formId}-medium`}
                type="text"
                placeholder="e.g. 3D, photography, generative"
                value={medium}
                onChange={(e) => {
                  setMedium(e.target.value);
                }}
              />
            </label>

            <label className={styles['field']} htmlFor={`${formId}-portfolio`}>
              <span className={styles['label']}>Portfolio URL</span>
              <input
                id={`${formId}-portfolio`}
                type="url"
                value={portfolioUrl}
                onChange={(e) => {
                  setPortfolioUrl(e.target.value);
                }}
              />
            </label>
          </div>

          <label className={styles['field']} htmlFor={`${formId}-description`}>
            <span className={styles['label']}>Short Description / Artist Statement *</span>
            <textarea
              id={`${formId}-description`}
              required
              rows={4}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
              }}
            />
          </label>

          <div className={styles['uploadSection']}>
            <div className={styles['uploadHeader']}>
              <span className={styles['label']}>Artwork Files *</span>
              <span className={styles['fileCount']}>
                {files.length}/{MAX_FILES}
              </span>
            </div>

            <div
              className={`${styles['dropzone'] ?? ''} ${dragActive ? (styles['dropzoneActive'] ?? '') : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => {
                setDragActive(false);
              }}
              onDrop={handleDrop}
            >
              <p className={styles['dropzoneText']}>
                Drag and drop up to {MAX_FILES} images or videos, or
              </p>
              <button
                type="button"
                className={styles['browseButton']}
                disabled={files.length >= MAX_FILES}
                onClick={() => fileInputRef.current?.click()}
              >
                Choose files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                className={styles['fileInput']}
                disabled={files.length >= MAX_FILES}
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <p className={styles['hint']}>JPG, PNG, WEBP, MP4, MOV, WebM &middot; up to 80MB</p>
            </div>

            {files.length > 0 && (
              <ul className={styles['fileList']}>
                {files.map((pending) => (
                  <li key={pending.id} className={styles['fileItem']}>
                    <div className={styles['filePreview']} aria-hidden="true">
                      {pending.previewUrl ? (
                        <img src={pending.previewUrl} alt="" />
                      ) : (
                        <span className={styles['filePreviewFallback']}>
                          {isVideo(pending.file) ? 'VIDEO' : 'FILE'}
                        </span>
                      )}
                    </div>
                    <div className={styles['fileMeta']}>
                      <span className={styles['fileName']}>{pending.file.name}</span>
                      {pending.error ? (
                        <span className={styles['fileError']}>{pending.error}</span>
                      ) : status === 'submitting' ? (
                        <span className={styles['fileProgressTrack']}>
                          <span
                            className={styles['fileProgressFill']}
                            style={{ width: `${String(pending.progress)}%` }}
                          />
                        </span>
                      ) : (
                        <span className={styles['fileSize']}>
                          {(pending.file.size / (1024 * 1024)).toFixed(1)}MB
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className={styles['removeFile']}
                      aria-label={`Remove ${pending.file.name}`}
                      onClick={() => {
                        removeFile(pending.id);
                      }}
                      disabled={status === 'submitting'}
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className={styles['consent']} htmlFor={`${formId}-consent`}>
            <input
              id={`${formId}-consent`}
              type="checkbox"
              required
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
              }}
            />
            <span>
              I understand this does not guarantee display in the museum. I own or have the rights
              to submit this work, and I give Seismic Museum permission to privately review and
              store these files and contact me about potential exhibition.
            </span>
          </label>

          {formError && (
            <p className={styles['formError']} role="alert">
              {formError}
            </p>
          )}

          <button
            type="submit"
            className={styles['submitButton']}
            disabled={status === 'submitting'}
          >
            {status === 'submitting' ? 'Submitting…' : 'Submit Your Art'}
          </button>
        </form>
      </main>
    </div>
  );
}
