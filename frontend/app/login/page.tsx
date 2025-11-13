"use client";

import { login, fetchMe, setCurrentUser } from "@/lib/api";
import Alert from "@/app/components/Alert";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      const me = await fetchMe();
      setCurrentUser(me);
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col items-center justify-center text-center">
      <div className="card-soft relative w-full overflow-hidden p-10">
        <div className="pointer-events-none absolute -top-20 right-[-60px] h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-[-60px] h-56 w-56 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative space-y-8">
          <div className="space-y-3">
            <span className="badge bg-primary/20 text-primary">Welcome back</span>
            <h1 className="section-title text-4xl">Sign in to your cozy campus hub</h1>
            <p className="section-subtitle">
              Manage attendance, subjects, and your student life with a sprinkle of pastel magic ✨
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5 text-left">
            <div className="space-y-3">
              <div>
                <label className="mb-2 block">Email</label>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@cimage.edu"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="mb-2 block">Password</label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error ? <Alert type="error">{error}</Alert> : null}

            <button className="btn mt-6 w-full" disabled={loading} type="submit">
              {loading ? "Signing in..." : "Enter the portal"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
