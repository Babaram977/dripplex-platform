import { useSuperAppFonts } from './fonts';

export interface SuperAppQuickAction {
  key: string;
  icon: string;
  label: string;
  color: string;
}

/** 4-column quick-action icon grid, ported from Home's `QuickActions`. */
export function SuperAppQuickActionsGrid({
  items,
  onSelect,
}: {
  items: SuperAppQuickAction[];
  onSelect?: ((key: string) => void) | undefined;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div className="mb-1 px-5">
      <div className="grid grid-cols-4 gap-3">
        {items.map((q) => (
          <button
            key={q.key}
            type="button"
            onClick={
              onSelect
                ? () => {
                    onSelect(q.key);
                  }
                : undefined
            }
            className="flex flex-col items-center gap-1.5"
          >
            <div
              className="flex h-[56px] w-[56px] items-center justify-center rounded-2xl text-[24px]"
              style={{
                background: `${q.color}18`,
                border: `1.5px solid ${q.color}28`,
                boxShadow: `0 4px 16px ${q.color}12`,
              }}
            >
              {q.icon}
            </div>
            <p
              className={`text-center text-[10px] font-medium ${body}`}
              style={{ color: 'rgba(255,255,255,.58)' }}
            >
              {q.label}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
