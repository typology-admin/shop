type Props = {
  message: string;
};

export function BusyOverlay({ message }: Props) {
  return (
    <div className="busy-overlay" role="status" aria-live="polite">
      <div className="busy-overlay-card">
        <div className="loading-mark" />
        <p>{message}</p>
      </div>
    </div>
  );
}
