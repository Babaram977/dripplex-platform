import { G0, G2 } from '../../tokens/colors';

import { SuperAppAvatar } from './Avatar';
import { useSuperAppFonts } from './fonts';
import { SuperAppGreetingHeader } from './GreetingHeader';
import { SuperAppNotificationBell } from './NotificationBell';
import { SuperAppSearchBar } from './SearchBar';
import { SuperAppStatusBarIcons } from './StatusBarIcons';

/**
 * The gradient top banner shared by every screen: status bar, greeting +
 * notifications + avatar, and search — composed from the smaller
 * primitives above. Ported from Home's `Header`.
 */
export function SuperAppHeader({
  time = '9:41',
  greeting,
  name,
  tagline,
  avatarInitial,
  searchPlaceholder,
  onSearchPress,
  onNotificationsPress,
  hasUnreadNotifications,
}: {
  time?: string | undefined;
  greeting: string;
  name: string;
  tagline?: string | undefined;
  avatarInitial: string;
  searchPlaceholder: string;
  onSearchPress?: (() => void) | undefined;
  onNotificationsPress?: (() => void) | undefined;
  hasUnreadNotifications?: boolean | undefined;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(175deg,#0B2317 0%,#0D2A1C 55%,#091420 100%)',
        paddingBottom: 20,
      }}
    >
      <div
        className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full"
        style={{ background: `radial-gradient(circle,${G2} 0%,transparent 68%)`, opacity: 0.12 }}
      />
      <div
        className="pointer-events-none absolute -left-10 top-10 h-32 w-32 rounded-full"
        style={{ background: `radial-gradient(circle,${G0} 0%,transparent 70%)`, opacity: 0.16 }}
      />

      <div
        className="flex items-center justify-between px-5 pb-1 pt-[52px]"
        style={{ fontSize: 11, color: 'rgba(255,255,255,.38)' }}
      >
        <span className={body}>{time}</span>
        <SuperAppStatusBarIcons />
      </div>

      <div className="relative z-10 mt-2 flex items-center justify-between px-5">
        <SuperAppGreetingHeader greeting={greeting} name={name} tagline={tagline} />
        <div className="flex items-center gap-2.5">
          <SuperAppNotificationBell
            onPress={onNotificationsPress}
            hasUnread={hasUnreadNotifications}
          />
          <SuperAppAvatar initial={avatarInitial} />
        </div>
      </div>

      <div className="relative z-10 mx-5 mt-4">
        <SuperAppSearchBar placeholder={searchPlaceholder} onPress={onSearchPress} />
      </div>
    </div>
  );
}
