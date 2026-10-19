export default function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <ellipse cx="16" cy="17.5" rx="13" ry="9.5" fill="var(--accent)" />
      <ellipse cx="12.5" cy="14" rx="4.5" ry="2.4" fill="var(--onaccent)" opacity=".35" transform="rotate(-18 12.5 14)" />
    </svg>
  )
}
