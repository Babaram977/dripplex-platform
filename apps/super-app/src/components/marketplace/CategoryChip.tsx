import React from 'react';
import { BORDER, GREEN_GRADIENT } from '../../tokens/colors';
import { FONT_BODY, TYPE } from '../../tokens/typography';
import { ELEVATION } from '../../tokens/elevation';

export interface Category {
  label: string;
  icon: string;
}

interface CategoryChipProps {
  category: Category;
  active: boolean;
  onPress?: () => void;
}

export function CategoryChip({ category, active, onPress }: CategoryChipProps) {
  return (
    <button
      onClick={onPress}
      className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 transition-all active:scale-95"
      style={{
        background: active ? GREEN_GRADIENT : 'rgba(255,255,255,.06)',
        border: active ? 'none' : `1px solid ${BORDER}`,
        boxShadow: active ? ELEVATION.brand : 'none',
      }}
      aria-pressed={active}
    >
      <span style={{ fontSize: 13 }}>{category.icon}</span>
      <p
        style={{
          fontFamily: FONT_BODY,
          fontSize: TYPE.sm,
          fontWeight: 600,
          color: active ? '#FFF' : 'rgba(255,255,255,.5)',
          whiteSpace: 'nowrap',
        }}
      >
        {category.label}
      </p>
    </button>
  );
}

interface CategoryChipListProps {
  categories: Category[];
  activeLabel: string;
  onChange: (label: string) => void;
  style?: React.CSSProperties;
}

export function CategoryChipList({
  categories,
  activeLabel,
  onChange,
  style,
}: CategoryChipListProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-5" style={{ scrollbarWidth: 'none', ...style }}>
      {categories.map((cat) => (
        <CategoryChip
          key={cat.label}
          category={cat}
          active={activeLabel === cat.label}
          onPress={() => onChange(cat.label)}
        />
      ))}
    </div>
  );
}
