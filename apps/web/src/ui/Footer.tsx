/**
 * App-level attribution footer: "Powered by beamstack", linking out to the parent product's site.
 * Not part of the engine/store — a static, presentational strip pinned under `.app-body` (the `.app`
 * flex column already reserves it natural height; `.app-body` is the `flex:1` region above it). The
 * wordmark reproduces beam-stack.com's own mark/wordmark colours (`#4C8DFF` / `#E8EDF4`) verbatim
 * rather than the app's own `--accent`, since this is Beamstack's brand mark, not SmartBar's.
 */
export function Footer() {
  return (
    <footer className="app-footer">
      <a
        className="footer-powered"
        href="https://beam-stack.com"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Powered by Beamstack — beam-stack.com"
      >
        <span className="footer-powered-label">Powered by</span>
        <svg
          className="footer-logo"
          viewBox="0 0 64 64"
          width="16"
          height="16"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M8 14 L20 24 L8 34"
            fill="none"
            stroke="#4C8DFF"
            strokeWidth="6"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
          <rect x="26" y="12" width="30" height="5.5" fill="#E8EDF4" />
          <rect x="26" y="20.5" width="30" height="5.5" fill="#E8EDF4" />
          <rect x="26" y="29" width="30" height="5.5" fill="#E8EDF4" />
          <rect x="5" y="39" width="54" height="6" fill="#4C8DFF" />
          <polygon points="13,45 7.5,53 18.5,53" fill="#E8EDF4" />
          <polygon points="51,45 45.5,53 56.5,53" fill="#E8EDF4" />
          <rect x="44" y="55" width="14" height="2.4" fill="#E8EDF4" />
        </svg>
        <span className="footer-wordmark">
          beam<span className="footer-wordmark-accent">stack</span>
        </span>
      </a>
    </footer>
  );
}
