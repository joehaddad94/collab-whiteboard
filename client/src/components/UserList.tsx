import { memo } from "react";
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

export const UserList = memo(function UserList({ members, currentUserId }: UserListProps) {
  if (members.length === 0) {
    return <span className="board-presence-empty">No one else here yet</span>;
  }

  return (
    <>
      {members.map((m) => {
        const isSelf = m.userId === currentUserId;
        return (
          <span
            key={m.userId}
            className={`presence-chip ${isSelf ? "presence-chip-self" : ""}`}
          >
            <Avatar
              name={m.username}
              userId={m.userId}
              size={20}
              color={isSelf ? "var(--accent)" : undefined}
            />
            {isSelf ? "You" : m.username}
            {m.role && <span className="presence-chip-role">{m.role}</span>}
          </span>
        );
      })}
    </>
  );
});
