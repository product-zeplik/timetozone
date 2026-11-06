/**
 * The TZ mark, straight from TimeToZone_Brand_Kit/01-logos/svg/01-mark-black.svg.
 * Monochrome, `currentColor`, never redrawn. Paired with the `TimeToZone`
 * wordmark as real text so no web font is needed (docs/09: fonts budget 0).
 */
export function Mark({ size = 20, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="currentColor"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path d="M6 14H48V27H34V86H20V27H6Z" />
      <path d="M52 14H94V27H69L94 73V86H52V73H77L52 27Z" />
    </svg>
  );
}

/** Horizontal lockup: mark + wordmark. */
export function Lockup() {
  return (
    <>
      <Mark size={20} />
      <span className="brand-name">TimeToZone</span>
    </>
  );
}
