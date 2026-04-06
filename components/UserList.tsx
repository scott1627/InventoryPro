"use client";

import { useState } from "react";
import { User, Plus, Edit2, Trash2, Shield, ShieldAlert, Loader2 } from "lucide-react";
import { createUser, updateUser, deleteUser } from "../app/actions/users";
import { cn } from "../lib/utils";
import { formatDate } from "../lib/date";

type UserType = {
  id: string;
  username: string;
  role: string;
  timezone: string;
  createdAt: Date;
};

export default function UserList({ initialUsers, currentUserId, userTimezone }: { initialUsers: UserType[]; currentUserId: string; userTimezone: string }) {
  const [users, setUsers] = useState<UserType[]>(initialUsers);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [timezone, setTimezone] = useState("UTC");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const openModal = (user?: UserType) => {
    setError("");
    if (user) {
      setEditingUser(user);
      setUsername(user.username);
      setRole(user.role as "USER" | "ADMIN");
      setTimezone(user.timezone || "UTC");
      setPassword(""); // Don't fill password on edit
    } else {
      setEditingUser(null);
      setUsername("");
      setPassword("");
      setRole("USER");
      setTimezone("UTC");
    }
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (editingUser) {
        // Editing
        const res = await updateUser(editingUser.id, username, password || undefined, role, timezone);
        if (!res.success) {
          setError(res.error || "Failed to update user");
        } else {
          setUsers(users.map(u => u.id === editingUser.id ? { ...u, username: res.user!.username, role: res.user!.role, timezone: res.user!.timezone } : u));
          closeModal();
        }
      } else {
        // Creating
        if (!password) {
          setError("Password is required for new users");
          setIsLoading(false);
          return;
        }
        const res = await createUser(username, password, role, timezone);
        if (!res.success) {
          setError(res.error || "Failed to create user");
        } else {
          setUsers([...users, { ...res.user!, createdAt: new Date() }]);
          closeModal();
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (id === currentUserId) {
      alert("You cannot delete your own account.");
      return;
    }
    if (!confirm("Are you sure you want to delete this user? This cannot be undone.")) return;

    try {
      const res = await deleteUser(id);
      if (res.success) {
        setUsers(users.filter(u => u.id !== id));
      } else {
        alert(res.error || "Failed to delete user");
      }
    } catch (err: any) {
      alert("An error occurred while deleting.");
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => openModal()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          <Plus size={16} />
          New User
        </button>
      </div>

      <div className="glass rounded-xl overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-secondary/50 text-muted-foreground border-b">
              <tr>
                <th className="px-6 py-4 font-medium">Username</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Timezone</th>
                <th className="px-6 py-4 font-medium">Created On</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-6 py-4 font-medium flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                        <User size={16} />
                    </div>
                    {user.username}
                    {user.id === currentUserId && <span className="ml-2 text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">You</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                        user.role === "ADMIN" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-primary/10 text-primary border-primary/20"
                    )}>
                        {user.role === "ADMIN" ? <ShieldAlert size={12} /> : <Shield size={12} />}
                        {user.role}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground text-xs">
                    {user.timezone}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground" suppressHydrationWarning>
                    {formatDate(user.createdAt, userTimezone, { hour12: false, hour: undefined, minute: undefined })}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => openModal(user)}
                      className="p-2 text-muted-foreground hover:text-primary transition-colors bg-secondary/50 rounded-lg hover:bg-secondary"
                      aria-label="Edit user"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      disabled={user.id === currentUserId}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors bg-secondary/50 rounded-lg hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Delete user"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border overflow-hidden">
            <div className="px-6 py-4 border-b bg-secondary/30 flex justify-between items-center">
              <h3 className="text-lg font-bold">{editingUser ? "Edit User" : "Create New User"}</h3>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground">
                <Plus className="rotate-45" size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium uppercase tracking-wider text-muted-foreground text-[10px]">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-background border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none transition-colors"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium uppercase tracking-wider text-muted-foreground text-[10px]">
                  Password {editingUser && "(Leave blank to keep unchanged)"}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-background border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none transition-colors"
                  required={!editingUser}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium uppercase tracking-wider text-muted-foreground text-[10px]">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "USER" | "ADMIN")}
                  className="w-full bg-background border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none transition-colors"
                >
                  <option value="USER">User (Standard Access)</option>
                  <option value="ADMIN">Admin (Full Control)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium uppercase tracking-wider text-muted-foreground text-[10px]">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full bg-background border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none transition-colors"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time (US)</option>
                  <option value="America/Chicago">Central Time (US)</option>
                  <option value="America/Denver">Mountain Time (US)</option>
                  <option value="America/Los_Angeles">Pacific Time (US)</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 hover:bg-secondary rounded-lg font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center min-w-[100px] transition-colors disabled:opacity-50"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
