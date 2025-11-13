"use client";

import { useEffect, useRef, useState } from "react";
import { fetchMe, setCurrentUser, updateProfile } from "@/lib/api";
import Alert from "@/app/components/Alert";

export default function ProfilePage() {
  const [me, setMe] = useState<any>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchMe();
        setMe(data);
        setName(data?.name || "");
        setEmail(data?.email || "");
      } catch (e: any) {
        setMessage(e.message || "Failed to load profile");
      }
    })();
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateProfile({ name, email });
      setMe(updated);
      setCurrentUser(updated);
      setMessage("Profile updated");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);
    try {
      const updated = await updateProfile({ profile_picture: file });
      setMe(updated);
      setCurrentUser(updated);
      setMessage("Profile picture updated");
    } catch (e: any) {
      setMessage(e.message || "Failed to upload profile picture");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const initials = (name || email || "🙂")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const profilePicture = me?.profile_picture || me?.image_url;

  return (
    <div className="space-y-10">
      <section className="card-soft relative overflow-hidden px-8 py-10">
        <div className="pointer-events-none absolute -top-28 right-[-10%] h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-[-15%] h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="badge bg-primary/20 text-primary">Profile bloom</span>
            <h1 className="section-title mt-4 text-4xl">Spruce up your cosy profile</h1>
            <p className="section-subtitle mt-3 max-w-xl">
              Update your details, peek at your role, and let your digital self sparkle just like you do on campus.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/70 bg-white/80 text-3xl font-semibold text-primary shadow-lg backdrop-blur-xl transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {profilePicture ? (
              <img
                src={profilePicture}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            ) : (
              <>
                {initials || "🙂"}
                <span className="absolute -bottom-2 right-2 text-base">🌸</span>
              </>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                <span className="text-sm">Uploading...</span>
              </div>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
        </div>
      </section>

      <form onSubmit={onSave} className="card space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block">Full name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your lovely name" />
          </div>
          <div>
            <label className="mb-2 block">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@cimage.edu" />
          </div>
          <div>
            <label className="mb-2 block">Role</label>
            <input className="input" value={me?.role || ""} disabled />
          </div>
          <div>
            <label className="mb-2 block">Batch</label>
            <input className="input" value={me?.batch?.name || ""} disabled />
          </div>
        </div>
        {message ? (
          <Alert type={message === "Profile updated" || message === "Profile picture updated" ? "success" : "info"} dismissible>
            {message}
          </Alert>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Last updated · {me?.updated_at ? new Date(me.updated_at).toLocaleString() : "Just now"}
          </span>
        </div>
      </form>
    </div>
  );
}
