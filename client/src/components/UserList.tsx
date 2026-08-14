import type { BoardRole } from "../types";
import { Avatar } from "./Avatar";

interface OnlineMember {
  userId: number;
  username: string;
  role?: BoardRole;
}

interface UserListProps {
  members: OnlineMember[];
  currentUserId: number;
}

export function UserList({ members, currentUserId }: UserListProps) {
  if (members.length === 0) {
    return <span className="board-presence-empty">No one else here yet</span>;
  }

  return (
    <>
      {members.map((m) => (
        <span key={m.userId} className="presence-chip">
          <Avatar
            name={m.username}
            userId={m.userId}
            size={18}
            color={m.userId === currentUserId ? "var(--accent)" : undefined}
          />
          {m.userId === currentUserId ? "You" : m.username}
          {m.role && <span className="presence-chip-role">{m.role}</span>}
        </span>
      ))}
    </>
  );
}
