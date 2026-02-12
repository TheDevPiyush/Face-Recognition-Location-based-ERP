'use client';

import { useState, useEffect, useRef } from 'react';
import * as api from '@/lib/api';
import Header from '@/app/components/Header';
import Toast from '@/app/components/Toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { FileText, Music, Video, Upload, Link2, Pin, Send } from 'lucide-react';

interface Announcement {
  id: number;
  title: string;
  description?: string;
  announcement_type: 'text' | 'audio' | 'video';
  text_content?: string;
  audio_url?: string;
  video_url?: string;
  created_by: {
    id: number;
    name: string;
    email: string;
    role: string;
  } | null;
  is_published: boolean;
  is_pinned: boolean;
  published_at: string;
  expires_at?: string | null;
  created_at: string;
}

const FONT_CLASS = '[font-family:var(--font-hellix-medium)]';

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploading, setUploading] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    announcement_type: 'text' | 'audio' | 'video';
    text_content: string;
    audio_url: string;
    video_url: string;
    is_published: boolean;
    is_pinned: boolean;
  }>({
    title: '',
    description: '',
    announcement_type: 'text',
    text_content: '',
    audio_url: '',
    video_url: '',
    is_published: true,
    is_pinned: false,
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchAnnouncements();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const user = api.getCurrentUserStored();
      setIsAdmin(user?.is_staff || false);
    } catch (err) {
      console.error('Failed to check admin status:', err);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAnnouncements();
      setAnnouncements(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch announcements';
      setError(message);
      setToast({ message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    });
  };

  const handleFileUpload = async (file: File, type: 'audio' | 'video') => {
    const validTypes = type === 'audio'
      ? /^audio\//.test(file.type)
      : /^video\//.test(file.type);
    if (!validTypes) {
      setToast({ message: `Please select a valid ${type} file`, type: 'error' });
      return;
    }
    try {
      setUploading(true);
      const { url } = await api.uploadAnnouncementMedia(file);
      setFormData((prev) => ({
        ...prev,
        [type === 'audio' ? 'audio_url' : 'video_url']: url,
      }));
      setToast({ message: `${type.charAt(0).toUpperCase() + type.slice(1)} uploaded`, type: 'success' });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Upload failed', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!formData.title.trim()) {
        setToast({ message: 'Title is required', type: 'error' });
        return;
      }
      const type = formData.announcement_type;
      if (type === 'text' && !formData.text_content.trim()) {
        setToast({ message: 'Text content is required', type: 'error' });
        return;
      }
      if (type === 'audio' && !formData.audio_url.trim()) {
        setToast({ message: 'Upload or paste an audio URL', type: 'error' });
        return;
      }
      if (type === 'video' && !formData.video_url.trim()) {
        setToast({ message: 'Upload or paste a video URL', type: 'error' });
        return;
      }

      const payload = {
        title: formData.title,
        description: formData.description,
        announcement_type: type,
        text_content: type === 'text' ? formData.text_content : undefined,
        audio_url: type === 'audio' ? formData.audio_url : undefined,
        video_url: type === 'video' ? formData.video_url : undefined,
        is_published: formData.is_published,
        is_pinned: formData.is_pinned,
      };

      await api.createAnnouncement(payload);
      setToast({ message: 'Announcement created', type: 'success' });
      setFormData({
        title: '',
        description: '',
        announcement_type: 'text',
        text_content: '',
        audio_url: '',
        video_url: '',
        is_published: true,
        is_pinned: false,
      });
      setShowForm(false);
      fetchAnnouncements();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to create', type: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await api.deleteAnnouncement(id);
      setToast({ message: 'Deleted', type: 'success' });
      fetchAnnouncements();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Delete failed', type: 'error' });
    }
  };

  const renderAnnouncementContent = (announcement: Announcement) => {
    switch (announcement.announcement_type) {
      case 'text':
        return (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl">
            <p className="text-gray-800 whitespace-pre-wrap">{announcement.text_content}</p>
          </div>
        );
      case 'audio':
        return (
          <div className="mt-4">
            <audio controls className="w-full rounded-lg">
              <source src={announcement.audio_url} type="audio/mpeg" />
            </audio>
          </div>
        );
      case 'video':
        return (
          <div className="mt-4 rounded-xl overflow-hidden bg-black">
            <video controls className="w-full max-h-96">
              <source src={announcement.video_url} type="video/mp4" />
            </video>
          </div>
        );
      default:
        return null;
    }
  };

  const typeOptions: { value: 'text' | 'audio' | 'video'; icon: typeof FileText; label: string }[] = [
    { value: 'text', icon: FileText, label: 'Text' },
    { value: 'audio', icon: Music, label: 'Audio' },
    { value: 'video', icon: Video, label: 'Video' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className={`text-3xl font-bold text-gray-900 ${FONT_CLASS}`}>Announcements</h1>
          {isAdmin && (
            <Button
              onClick={() => setShowForm(true)}
              className={`rounded-full font-medium ${FONT_CLASS}`}
            >
              <FileText className="h-4 w-4" />
              New announcement
            </Button>
          )}
        </div>

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className={`max-w-lg rounded-2xl ${FONT_CLASS}`}>
            <DialogHeader>
              <DialogTitle className={`text-xl ${FONT_CLASS}`}>Create announcement</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleFormChange}
                  placeholder="Announcement title"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="Optional short description"
                  rows={2}
                  className="input w-full resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <div className="flex gap-2">
                  {typeOptions.map(({ value, icon: Icon, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFormData({ ...formData, announcement_type: value })}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all ${
                        formData.announcement_type === value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {formData.announcement_type === 'text' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Content *</label>
                  <textarea
                    name="text_content"
                    value={formData.text_content}
                    onChange={handleFormChange}
                    placeholder="Write your announcement..."
                    rows={4}
                    className="input w-full resize-none"
                  />
                </div>
              )}

              {formData.announcement_type === 'audio' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Audio</label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => audioInputRef.current?.click()}
                      disabled={uploading}
                      className="rounded-xl"
                    >
                      {uploading ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          Uploading…
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          Upload file
                        </>
                      )}
                    </Button>
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f, 'audio');
                        e.target.value = '';
                      }}
                    />
                    <div className="flex-1 min-w-[200px] flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-gray-400 shrink-0" />
                      <input
                        type="url"
                        name="audio_url"
                        value={formData.audio_url}
                        onChange={handleFormChange}
                        placeholder="Or paste URL"
                        className="input flex-1 py-2"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formData.announcement_type === 'video' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Video</label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => videoInputRef.current?.click()}
                      disabled={uploading}
                      className="rounded-xl"
                    >
                      {uploading ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          Uploading…
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          Upload file
                        </>
                      )}
                    </Button>
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f, 'video');
                        e.target.value = '';
                      }}
                    />
                    <div className="flex-1 min-w-[200px] flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-gray-400 shrink-0" />
                      <input
                        type="url"
                        name="video_url"
                        value={formData.video_url}
                        onChange={handleFormChange}
                        placeholder="Or paste URL"
                        className="input flex-1 py-2"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_published"
                    checked={formData.is_published}
                    onChange={handleFormChange}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium">Publish now</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_pinned"
                    checked={formData.is_pinned}
                    onChange={handleFormChange}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Pin className="h-4 w-4" />
                  <span className="text-sm font-medium">Pin to top</span>
                </label>
              </div>

              <DialogFooter className="flex flex-row gap-2 pt-4 sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={uploading}>
                  Cancel
                </Button>
                <Button type="submit" className="rounded-xl" disabled={uploading}>
                  {uploading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Create
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-16">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-4 text-gray-500">Loading...</p>
          </div>
        )}

        {!loading && announcements.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <p className="text-gray-500">No announcements yet</p>
          </div>
        )}

        <div className="space-y-4">
          {announcements.map((announcement) => (
            <div
              key={announcement.id}
              className={`bg-white rounded-2xl shadow-sm p-6 border-l-4 ${
                announcement.is_pinned ? 'border-amber-500' : 'border-primary'
              }`}
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={`text-xl font-semibold text-gray-900 ${FONT_CLASS}`}>
                      {announcement.title}
                    </h2>
                    {announcement.is_pinned && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
                        <Pin className="h-3 w-3" />
                        Pinned
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                        announcement.announcement_type === 'text'
                          ? 'bg-blue-100 text-blue-800'
                          : announcement.announcement_type === 'audio'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {announcement.announcement_type === 'text' && <FileText className="h-3 w-3" />}
                      {announcement.announcement_type === 'audio' && <Music className="h-3 w-3" />}
                      {announcement.announcement_type === 'video' && <Video className="h-3 w-3" />}
                      {announcement.announcement_type}
                    </span>
                  </div>
                  {announcement.description && (
                    <p className="mt-2 text-gray-600 text-sm">{announcement.description}</p>
                  )}
                </div>
                {isAdmin && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(announcement.id)}
                    className="shrink-0 rounded-lg"
                  >
                    Delete
                  </Button>
                )}
              </div>

              {renderAnnouncementContent(announcement)}

              <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
                {announcement.created_by?.name || 'Admin'} ·{' '}
                {new Date(announcement.published_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </main>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
