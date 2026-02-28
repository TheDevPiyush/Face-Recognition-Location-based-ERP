import type { Request, Response } from "express";
import { db } from "../../db";
import { announcements, batches, universities } from "../../db/schema";
import { eq, and, or, isNull, ilike, inArray } from "drizzle-orm";
import { uploadToS3 } from "../../services/aws/s3.service";
import type { FileFilterCallback } from "multer";
import multer from "multer";

function serverError(res: Response, err: unknown, context = "Operation failed") {
    console.error(`[announcement.controller] ${context}:`, err);
    return res.status(500).json({ error: context });
}

function param(v: string | string[] | undefined): string | null {
    if (v === undefined) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
}

// ─── Multer for media uploads ─────────────────────────────────────────────────
const ALLOWED_AUDIO_TYPES = new Set([
    "audio/mpeg", "audio/mp3", "audio/m4a", "audio/x-m4a",
    "audio/aac", "audio/wav", "audio/webm",
]);
const ALLOWED_VIDEO_TYPES = new Set([
    "video/mp4", "video/quicktime", "video/x-quicktime", "video/webm",
]);
const ALLOWED_EXTENSIONS = new Set([".mp3", ".m4a", ".aac", ".wav", ".mp4", ".mov", ".webm"]);

const mediaFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const mime = (file.mimetype || "").split(";")[0]!.trim().toLowerCase();
    const ext = "." + (file.originalname.split(".").pop() ?? "").toLowerCase();

    const allowed =
        ALLOWED_AUDIO_TYPES.has(mime) ||
        ALLOWED_VIDEO_TYPES.has(mime) ||
        ((mime === "application/octet-stream" || mime === "") && ALLOWED_EXTENSIONS.has(ext));

    if (allowed) {
        cb(null, true);
    } else {
        cb(new Error("Only audio (mp3, m4a, aac, wav) or video (mp4, mov, webm) files are allowed"));
    }
};

export const mediaUpload = multer({ storage: multer.memoryStorage(), fileFilter: mediaFilter });

// ─── GET /api/announcement ────────────────────────────────────────────────────
export async function getAnnouncements(req: Request, res: Response) {
    try {
        const user = req.user!;

        let rows;

        if (user.role === "admin") {
            // Admins see all published announcements
            rows = await db
                .select()
                .from(announcements)
                .where(eq(announcements.isPublished, true));
        } else if (user.batchId) {
            // Students/teachers see their batch + global (no batch) announcements
            rows = await db
                .select()
                .from(announcements)
                .where(and(
                    eq(announcements.isPublished, true),
                    or(
                        eq(announcements.targetBatchId, user.batchId),
                        isNull(announcements.targetBatchId),
                    ),
                ));
        } else {
            // No batch — show global only
            rows = await db
                .select()
                .from(announcements)
                .where(and(
                    eq(announcements.isPublished, true),
                    isNull(announcements.targetBatchId),
                ));
        }

        return res.json(rows);
    } catch (err) {
        return serverError(res, err, "Failed to fetch announcements");
    }
}

// ─── POST /api/announcement ───────────────────────────────────────────────────
export async function createAnnouncement(req: Request, res: Response) {
    try {
        const user = req.user!;
        const {
            title, description,
            announcement_type, text_content, audio_url, video_url,
            target_batch_id, target_university_id,
            is_published, is_pinned,
        } = req.body;

        if (!title) return res.status(400).json({ error: "title is required" });

        const [row] = await db
            .insert(announcements)
            .values({
                title,
                description: description ?? null,
                announcementType: announcement_type ?? "text",
                textContent: text_content ?? null,
                audioUrl: audio_url ?? null,
                videoUrl: video_url ?? null,
                targetBatchId: target_batch_id ?? null,
                targetUniversityId: target_university_id ?? null,
                isPublished: is_published !== undefined ? Boolean(is_published) : true,
                isPinned: is_pinned !== undefined ? Boolean(is_pinned) : false,
                createdBy: user.id,
            })
            .returning();

        return res.status(201).json(row);
    } catch (err) {
        return serverError(res, err, "Failed to create announcement");
    }
}

// ─── GET /api/announcement/:id ────────────────────────────────────────────────
export async function getAnnouncementById(req: Request, res: Response) {
    try {
        const user = req.user!;
        const id = param(req.params.id);
        if (!id) return res.status(400).json({ error: "Missing announcement id" });

        const [row] = await db
            .select()
            .from(announcements)
            .where(eq(announcements.id, id))
            .limit(1);

        if (!row) return res.status(404).json({ error: "Announcement not found" });

        // Permission check — non-admins can only see announcements for their batch or global
        if (user.role !== "admin") {
            if (row.targetBatchId && row.targetBatchId !== user.batchId) {
                return res.status(403).json({ error: "Permission denied" });
            }
        }

        return res.json(row);
    } catch (err) {
        return serverError(res, err, "Failed to fetch announcement");
    }
}

// ─── PATCH /api/announcement/:id ─────────────────────────────────────────────
export async function updateAnnouncement(req: Request, res: Response) {
    try {
        const user = req.user!;
        const id = param(req.params.id);
        if (!id) return res.status(400).json({ error: "Missing announcement id" });

        const [existing] = await db
            .select()
            .from(announcements)
            .where(eq(announcements.id, id))
            .limit(1);

        if (!existing) return res.status(404).json({ error: "Announcement not found" });

        // Only admin or original creator can update
        if (user.role !== "admin" && existing.createdBy !== user.id) {
            return res.status(403).json({ error: "Permission denied" });
        }

        const {
            title, description,
            announcement_type, text_content, audio_url, video_url,
            target_batch_id, target_university_id,
            is_published, is_pinned,
        } = req.body;

        const updatePayload: Record<string, unknown> = {};
        if (title !== undefined) updatePayload.title = title;
        if (description !== undefined) updatePayload.description = description;
        if (announcement_type !== undefined) updatePayload.announcementType = announcement_type;
        if (text_content !== undefined) updatePayload.textContent = text_content;
        if (audio_url !== undefined) updatePayload.audioUrl = audio_url;
        if (video_url !== undefined) updatePayload.videoUrl = video_url;
        if (target_batch_id !== undefined) updatePayload.targetBatchId = target_batch_id;
        if (target_university_id !== undefined) updatePayload.targetUniversityId = target_university_id;
        if (is_published !== undefined) updatePayload.isPublished = Boolean(is_published);
        if (is_pinned !== undefined) updatePayload.isPinned = Boolean(is_pinned);

        const [updated] = await db
            .update(announcements)
            .set(updatePayload)
            .where(eq(announcements.id, id))
            .returning();

        return res.json(updated);
    } catch (err) {
        return serverError(res, err, "Failed to update announcement");
    }
}

// ─── DELETE /api/announcement/:id ────────────────────────────────────────────
export async function deleteAnnouncement(req: Request, res: Response) {
    try {
        const user = req.user!;
        const id = param(req.params.id);
        if (!id) return res.status(400).json({ error: "Missing announcement id" });

        const [existing] = await db
            .select()
            .from(announcements)
            .where(eq(announcements.id, id))
            .limit(1);

        if (!existing) return res.status(404).json({ error: "Announcement not found" });

        if (user.role !== "admin") {
            return res.status(403).json({ error: "Only admins can delete announcements" });
        }

        await db.delete(announcements).where(eq(announcements.id, id));
        return res.json({ message: "Announcement deleted successfully" });
    } catch (err) {
        return serverError(res, err, "Failed to delete announcement");
    }
}

// ─── GET /api/announcement/search?q= ─────────────────────────────────────────
export async function searchAnnouncements(req: Request, res: Response) {
    try {
        const user = req.user!;
        const query = param(req.query.q as string | undefined);

        if (!query) return res.status(400).json({ error: "Search query q is required" });

        const textMatch = or(
            ilike(announcements.title, `%${query}%`),
            ilike(announcements.description, `%${query}%`),
        )!;

        let rows;
        if (user.role === "admin") {
            rows = await db
                .select()
                .from(announcements)
                .where(and(eq(announcements.isPublished, true), textMatch));
        } else if (user.batchId) {
            rows = await db
                .select()
                .from(announcements)
                .where(and(
                    eq(announcements.isPublished, true),
                    textMatch,
                    or(
                        eq(announcements.targetBatchId, user.batchId),
                        isNull(announcements.targetBatchId),
                    ),
                ));
        } else {
            rows = await db
                .select()
                .from(announcements)
                .where(and(
                    eq(announcements.isPublished, true),
                    textMatch,
                    isNull(announcements.targetBatchId),
                ));
        }

        return res.json(rows);
    } catch (err) {
        return serverError(res, err, "Failed to search announcements");
    }
}

// ─── GET /api/announcement/batch/:batchId ────────────────────────────────────
export async function getAnnouncementsByBatch(req: Request, res: Response) {
    try {
        const batchId = param(req.params.batchId);
        if (!batchId) return res.status(400).json({ error: "Missing batchId" });

        const rows = await db
            .select()
            .from(announcements)
            .where(and(
                eq(announcements.targetBatchId, batchId),
                eq(announcements.isPublished, true),
            ));

        return res.json(rows);
    } catch (err) {
        return serverError(res, err, "Failed to fetch announcements by batch");
    }
}

// ─── GET /api/announcement/university/:universityId ───────────────────────────
export async function getAnnouncementsByUniversity(req: Request, res: Response) {
    try {
        const universityId = param(req.params.universityId);
        if (!universityId) return res.status(400).json({ error: "Missing universityId" });

        const rows = await db
            .select()
            .from(announcements)
            .where(and(
                eq(announcements.targetUniversityId, universityId),
                eq(announcements.isPublished, true),
            ));

        return res.json(rows);
    } catch (err) {
        return serverError(res, err, "Failed to fetch announcements by university");
    }
}

// ─── POST /api/announcement/upload-media ─────────────────────────────────────
export async function uploadAnnouncementMedia(req: Request, res: Response) {
    try {
        if (!req.file) return res.status(400).json({ error: "No file provided" });

        const { key, url } = await uploadToS3(req.file, "announcements");
        return res.json({ url, key });
    } catch (err) {
        return serverError(res, err, "Failed to upload announcement media");
    }
}