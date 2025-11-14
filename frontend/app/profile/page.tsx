"use client";

import { useEffect, useRef, useState } from "react";
import { fetchMe, setCurrentUser, updateProfile } from "@/lib/api";
import Alert from "@/app/components/Alert";
import Toast from "@/app/components/Toast";
import { PencilIcon } from "lucide-react";

export default function ProfilePage() {
  const [me, setMe] = useState<any>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // toast notifications
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: "success" | "error" | "info" }>>([]);
  const addToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  };
  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

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
      addToast("✅ Profile updated successfully", "success");
    } catch (e: any) {
      const errorMessage = e.message || "Failed to update profile";
      setMessage(errorMessage);
      addToast(`❌ ${errorMessage}`, "error");
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
      addToast("✅ Profile picture updated successfully", "success");
    } catch (e: any) {
      const errorMessage = e.message || "Failed to upload profile picture";
      setMessage(errorMessage);
      addToast(`❌ ${errorMessage}`, "error");
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

  if (!me) return null;

  return (
    <div className="space-y-10">
      <section className="card-soft relative overflow-hidden px-8 py-10">
        <div className="pointer-events-none absolute -top-28 right-[-10%] h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-[-15%] h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="section-title mt-4 text-4xl">{me?.name}'s Profile</h1>
            <p className="section-subtitle mt-3 max-w-xl">
              Report to admins for any changes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="relative cursor-pointer flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/70 bg-white/80 text-3xl font-semibold text-primary shadow-lg backdrop-blur-xl transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PencilIcon className="absolute animate-pulse bottom-3 right-2 h-6 w-6 text-primary bg-white rounded-full p-1 shadow-lg" />

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
                <span className="text-sm animate-spin border-t-3 border-b-3 border-white rounded-full p-2"></span>
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
            <input className="input" disabled value={name} onChange={(e) => setName(e.target.value)} placeholder="Your lovely name" />
          </div>
          <div>
            <label className="mb-2 block">Email</label>
            <input className="input" disabled type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@cimage.edu" />
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
        {/* {message ? (
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
        </div> */}
      </form>

      {/* Toast notifications */}
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}
