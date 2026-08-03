/**
 * Notification bell with an unread-dot indicator, ported from Home's
 * `Header`. Source rendered a static `<div>`; this is a real `<button>`
 * since every screen needs it to actually open notifications.
 */
export function SuperAppNotificationBell({
  onPress,
  hasUnread = false,
}: {
  onPress?: (() => void) | undefined;
  hasUnread?: boolean | undefined;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label="Notifications"
      className="relative flex h-[42px] w-[42px] items-center justify-center rounded-2xl"
      style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.09)' }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(255,255,255,.75)"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
      </svg>
      {hasUnread && (
        <div
          className="absolute right-2 top-2 h-2 w-2 rounded-full"
          style={{ background: '#F87171', border: '1.5px solid #0B2317' }}
        />
      )}
    </button>
  );
}
