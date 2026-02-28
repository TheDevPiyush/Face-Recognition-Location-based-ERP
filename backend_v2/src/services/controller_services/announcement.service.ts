import { db } from "../../db";
import { announcements } from "../../db/schema";
import { eq, and, or, isNull, ilike } from "drizzle-orm";
import { uploadToS3 } from "./../aws/s3.service";

// Visibility filter — what announcements can a user see
function visibilityWhere(user: { role: string | null; batchId: string | null }) {
    const published = eq(announcements.isPublished, true);

    if (user.role === "admin") return published;

    if (user.batchId) return and(published, or(
        eq(announcements.targetBatchId, user.batchId),
        isNull(announcements.targetBatchId),
    ));

    return and(published, isNull(announcements.targetBatchId));
}

export async function listAnnouncements(user: any) {
    return db.select().from(announcements).where(visibilityWhere(user));
}

export async function findAnnouncement(id: string) {
    const [row] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
    return row ?? null;
}

export async function createAnnouncement(data: any, userId: string) {
    const [row] = await db.insert(announcements).values({
        title:              data.title,
        description:        data.description        ?? null,
        announcementType:   data.announcement_type  ?? "text",
        textContent:        data.text_content       ?? null,
        audioUrl:           data.audio_url          ?? null,
        videoUrl:           data.video_url          ?? null,
        targetBatchId:      data.target_batch_id    ?? null,
        targetUniversityId: data.target_university_id ?? null,
        isPublished:        data.is_published !== undefined ? Boolean(data.is_published) : true,
        isPinned:           data.is_pinned    !== undefined ? Boolean(data.is_pinned)    : false,
        createdBy:          userId,
    }).returning();
    return row;
}

export async function updateAnnouncement(id: string, data: any) {
    const fields: Record<string, unknown> = {};
    if (data.title              !== undefined) fields.title              = data.title;
    if (data.description        !== undefined) fields.description        = data.description;
    if (data.announcement_type  !== undefined) fields.announcementType   = data.announcement_type;
    if (data.text_content       !== undefined) fields.textContent        = data.text_content;
    if (data.audio_url          !== undefined) fields.audioUrl           = data.audio_url;
    if (data.video_url          !== undefined) fields.videoUrl           = data.video_url;
    if (data.target_batch_id    !== undefined) fields.targetBatchId      = data.target_batch_id;
    if (data.target_university_id !== undefined) fields.targetUniversityId = data.target_university_id;
    if (data.is_published       !== undefined) fields.isPublished        = Boolean(data.is_published);
    if (data.is_pinned          !== undefined) fields.isPinned           = Boolean(data.is_pinned);

    const [updated] = await db.update(announcements).set(fields).where(eq(announcements.id, id)).returning();
    return updated;
}

export async function deleteAnnouncement(id: string) {
    await db.delete(announcements).where(eq(announcements.id, id));
}

export async function searchAnnouncements(query: string, user: any) {
    const textMatch = or(
        ilike(announcements.title, `%${query}%`),
        ilike(announcements.description, `%${query}%`),
    )!;

    return db.select().from(announcements).where(and(visibilityWhere(user), textMatch));
}

export async function listByBatch(batchId: string) {
    return db.select().from(announcements).where(and(
        eq(announcements.targetBatchId, batchId),
        eq(announcements.isPublished, true),
    ));
}

export async function listByUniversity(universityId: string) {
    return db.select().from(announcements).where(and(
        eq(announcements.targetUniversityId, universityId),
        eq(announcements.isPublished, true),
    ));
}

export async function uploadMedia(file: Express.Multer.File) {
    return uploadToS3(file, "announcements");
}