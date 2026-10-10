/** `.texdock` wordmark. The leading dot is the brand amber; the text uses
 *  currentColor so it adapts to the light/dark header. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 104 28"
      className={className}
      role="img"
      aria-label=".texdock"
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        x="1"
        y="14"
        dominantBaseline="central"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace"
        fontSize="20"
        fontWeight="700"
        letterSpacing="-0.5"
      >
        <tspan fill="#f5a314">.</tspan>
        <tspan fill="currentColor">texdock</tspan>
      </text>
    </svg>
  );
}
