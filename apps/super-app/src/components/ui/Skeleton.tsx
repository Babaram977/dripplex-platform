import React from 'react';

// ─── Bone ─────────────────────────────────────────────────────────────────────
// Single skeleton block — the primitive for all loading states
interface BoneProps {
  width: number | string;
  height: number;
  radius?: number;
  style?: React.CSSProperties;
}

export function Bone({ width, height, radius = 16, style }: BoneProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'rgba(255,255,255,.055)',
        flexShrink: 0,
        animation: 'shimmer 1.8s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

// ─── SkeletonCard ─────────────────────────────────────────────────────────────
// Full card skeleton with cover + text lines
interface SkeletonCardProps {
  width?: number;
  coverH?: number;
  lines?: number;
  radius?: number;
}

export function SkeletonCard({
  width = 180,
  coverH = 100,
  lines = 2,
  radius = 20,
}: SkeletonCardProps) {
  return (
    <div style={{ width, flexShrink: 0 }}>
      <Bone width="100%" height={coverH} radius={radius} />
      <div style={{ padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: lines }).map((_, i) => (
          <Bone key={i} width={i === lines - 1 ? '55%' : '80%'} height={10} radius={6} />
        ))}
      </div>
    </div>
  );
}

// ─── SkeletonList ─────────────────────────────────────────────────────────────
// Row-based skeleton for lists
interface SkeletonListProps {
  rows?: number;
  avatarSz?: number;
}

export function SkeletonList({ rows = 4, avatarSz = 44 }: SkeletonListProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3">
          <Bone width={avatarSz} height={avatarSz} radius={avatarSz / 3} />
          <div className="flex flex-1 flex-col gap-2">
            <Bone width="60%" height={11} radius={6} />
            <Bone width="40%" height={9} radius={6} />
          </div>
          <Bone width={50} height={14} radius={6} />
        </div>
      ))}
    </>
  );
}
