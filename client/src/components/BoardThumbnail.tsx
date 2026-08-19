const THUMB_PATHS = [
  "M20 80 Q 60 30, 90 60 T 160 40",
  "M30 30 L 100 90 M 100 30 L 30 90",
  "M15 60 Q 70 15, 120 60 T 205 55",
  "M25 40 Q 80 90, 130 35 T 200 60",
];
const THUMB_COLORS = ["#2454ff", "#8b5cf6", "#f5a623", "#14b8a6", "#ff6b4a"];

interface BoardThumbnailProps {
  boardId: number;
}

export function BoardThumbnail({ boardId }: BoardThumbnailProps) {
  const path = THUMB_PATHS[boardId % THUMB_PATHS.length];
  const color = THUMB_COLORS[boardId % THUMB_COLORS.length];

  return (
    <div className="board-thumb">
      <svg viewBox="0 0 220 108" aria-hidden="true">
        <path
          d={path}
          stroke={color}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
    </div>
  );
}
