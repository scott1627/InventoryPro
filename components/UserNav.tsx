"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut, User } from "lucide-react";

export default function UserNav() {
  const { data: session } = useSession();

  if (!session?.user) return null;

  return (
    <div className="flex items-center gap-3 ml-2 pl-4 border-l border-border/50">
      <div className="flex items-center gap-2 text-sm font-medium">
        <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
            <User size={16} />
        </div>
        <span className="hidden md:block">{session.user.username}</span>
      </div>
      <button
        onClick={async () => {
          await signOut({ redirect: false });
          window.location.href = "/login";
        }}
        className="p-2 text-muted-foreground shadow-sm bg-background/50 hover:text-destructive hover:bg-destructive/10 border border-border/50 rounded-lg transition-colors"
        title="Sign Out"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}
