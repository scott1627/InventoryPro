"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut, User, Globe } from "lucide-react";
import { updateOwnTimezone } from "../app/actions/users";
import { TIMEZONES } from "../lib/date";
import { useState } from "react";

export default function UserNav() {
  const { data: session, update } = useSession();
  const [isUpdating, setIsUpdating] = useState(false);

  if (!session?.user) return null;

  const handleTimezoneChange = async (newTimezone: string) => {
    setIsUpdating(true);
    try {
      const res = await updateOwnTimezone(newTimezone);
      if (res.success) {
        await update({ ...session, user: { ...session.user, timezone: newTimezone } });
        window.location.reload(); // Refresh to apply to all server components
      }
    } catch (error) {
      console.error("Failed to update timezone:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center gap-3 ml-2 pl-4 border-l border-border/50">
      <div className="flex items-center gap-2 text-sm font-medium">
        <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground mr-1">
            <User size={16} />
        </div>
        <span className="hidden lg:block">{session.user.username}</span>
      </div>

      <div className="relative group flex items-center gap-1.5 px-2 py-1.5 bg-secondary/30 rounded-lg border border-border/50 hover:bg-secondary/50 transition-colors">
        <Globe size={14} className="text-muted-foreground" />
        <select
          value={session.user.timezone || "UTC"}
          onChange={(e) => handleTimezoneChange(e.target.value)}
          disabled={isUpdating}
          className="bg-transparent border-none outline-none text-xs font-semibold cursor-pointer appearance-none pr-1 disabled:opacity-50"
          title="Select Timezone"
        >
          {TIMEZONES.map(tz => (
            <option key={tz} value={tz} className="bg-card text-foreground">
              {tz.split('/').pop()?.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
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
