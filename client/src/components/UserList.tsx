import type { BoardRole } from "../types";

interface OnlineMember {
  userId: number;
  displayName: string;
  role?: BoardRole;
}

interface UserListProps {
  members: OnlineMember[];
}

export function UserList({ members }: UserListProps) {
  if (members.length === 0) {
    return <span className="board-presence-empty">No one else here yet</span>;
  }

  return (
    <>
      {members.map((m) => (
        <span key={m.userId} className="presence-chip">
          {m.displayName}
          {m.role && <span className="presence-chip-role">{m.role}</span>}
        </span>
      ))}
    </>
  );
}
