/** Text-based "taxfix" wordmark — no proprietary logo asset is used. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight text-tf-ink ${className}`}>
      tax<span className="text-tf-green-strong">fix</span>
    </span>
  );
}
