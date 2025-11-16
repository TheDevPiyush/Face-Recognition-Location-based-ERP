"use client";

import { useEffect, useRef, useState } from "react";
import { fetchMe, setCurrentUser, updateProfile } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Button } from "@/app/components/ui/button";
import { useToast } from "@/app/components/ui/use-toast";
import { Spinner } from "@/app/components/ui/spinner";
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
  const { toast } = useToast();
  
  const addToast = (message: string, type: "success" | "error" | "info" = "success") => {
    toast({
      title: type === "error" ? "Error" : type === "success" ? "Success" : "Info",
      description: message,
      variant: type === "error" ? "destructive" : type === "success" ? "success" : "default",
    });
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
      addToast("Profile updated successfully", "success");
    } catch (e: any) {
      const errorMessage = e.message || "Failed to update profile";
      setMessage(errorMessage);
      addToast(errorMessage, "error");
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
      addToast("Profile picture updated successfully", "success");
    } catch (e: any) {
      const errorMessage = e.message || "Failed to upload profile picture";
      setMessage(errorMessage);
      addToast(errorMessage, "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const initials = (name || email || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const profilePicture = me?.profile_picture || me?.image_url;

  if (!me) return null;

  return (
    <div className="space-y-10">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-4xl text-primary">{me?.name || "User"}'s <span className="text-black">Profile</span></CardTitle>
              <CardDescription className="mt-3 max-w-xl">
                Contact administrators for profile updates.
              </CardDescription>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="relative cursor-pointer flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-secondary text-2xl font-semibold shadow-sm transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PencilIcon className="absolute bottom-2 right-2 h-5 w-5 text-primary bg-background rounded-full p-1 shadow-md" />

              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                  <Spinner size="md" className="border-white/30 border-t-white" />
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
        </CardHeader>
        <CardContent>
          <form onSubmit={onSave} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input disabled value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input disabled type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input value={me?.role || ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Batch</Label>
                <Input value={me?.batch?.name || ""} disabled />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
              <span className="text-xs text-muted-foreground">
                Last updated: {me?.updated_at ? new Date(me.updated_at).toLocaleString() : "N/A"}
              </span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
