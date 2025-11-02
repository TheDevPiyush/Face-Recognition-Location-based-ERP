"use client";

import { useEffect, useState } from "react";
import { fetchMe, setCurrentUser, updateProfile } from "@/lib/api";
import Alert from "@/components/Alert";

export default function ProfilePage() {
  const [me, setMe] = useState<any>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm opacity-80">View and update your basic details.</p>
      </div>

      <form onSubmit={onSave} className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm">Full name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm">Role</label>
            <input className="input" value={me?.role || ""} disabled />
          </div>
          <div>
            <label className="mb-1 block text-sm">Batch</label>
            <input className="input" value={me?.batch?.name || ""} disabled />
          </div>
        </div>
        {message ? (
          <Alert type={message === "Profile updated" ? "success" : "info"}>{message}</Alert>
        ) : null}
        <div className="flex gap-3">
          <button className="btn" type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
        </div>
      </form>
    </div>
  );
}
