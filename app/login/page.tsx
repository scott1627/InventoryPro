"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Package } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid username or password");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (error) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 gradient-bg text-foreground">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center mb-4">
            <span className="text-primary-foreground font-bold font-mono text-xl">IP</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">InventoryPro</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to manage your inventory</p>
        </div>

        <form onSubmit={handleSubmit} className="glass p-6 rounded-2xl space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium uppercase tracking-wider text-muted-foreground text-[10px]" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
              placeholder="admin"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium uppercase tracking-wider text-muted-foreground text-[10px]" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary text-primary-foreground font-medium rounded-lg px-4 py-2 hover:bg-primary/90 transition-colors disabled:opacity-50 flex justify-center items-center mt-6"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
