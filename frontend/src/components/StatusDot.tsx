export function StatusDot({ status }: { status: string }) {
  return <span className={`status-dot status-${status}`} aria-label={status} />;
}

