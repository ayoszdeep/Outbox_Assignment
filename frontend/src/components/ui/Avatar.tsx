import { useState } from 'react';

export interface AvatarProps {
  /** Google / Firebase photo URL. Falls back to initials when absent or unloadable. */
  src?: string | null;
  name?: string | null;
  email?: string | null;
  /** Shared by the image and the initials circle, so both occupy the same box. */
  className?: string;
  /** Font sizing for the initials circle only. */
  textClassName?: string;
  alt?: string;
}

/**
 * Round user avatar, used in the header, the sidebar and the sender picker.
 *
 * Google serves profile photos from lh3.googleusercontent.com and answers with 403 when
 * the request carries a referrer, so `referrerPolicy="no-referrer"` is what actually makes
 * the Gmail photo appear. Google also rate-limits those URLs and the stored one can go
 * stale, so a load failure quietly degrades to initials instead of a broken-image icon.
 */
export const Avatar = ({
  src,
  name,
  email,
  className = 'w-9 h-9',
  textClassName = 'text-sm',
  alt,
}: AvatarProps) => {
  // Keyed on the URL rather than a bare boolean, so a new photo - after logging in as
  // someone else - gets a fresh attempt without an effect to reset the flag.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const initial = (name || email || 'U').trim().charAt(0).toUpperCase() || 'U';

  if (!src || failedSrc === src) {
    return (
      <div
        className={`${className} ${textClassName} rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold border border-gray-200 shrink-0 select-none`}
        aria-label={alt || name || 'User avatar'}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || name || 'User avatar'}
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      className={`${className} rounded-full object-cover border border-gray-200 shrink-0 bg-gray-100`}
    />
  );
};
