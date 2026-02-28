import type { Request, Response } from "express";
import multer from "multer";
import type { FileFilterCallback } from "multer";
import * as service from "./../services/controller_services/announcement.service";

function param(v: any) {
    if (v === undefined) return null;
    return Array.isArray(v) ? v[0] : v;
}

function fail(res: Response, err: any, fallback = "Operation failed") {
    console.error("[announcement]", err);
    return res.status(500).json({ error: fallback });
}


const ALLOWED_MIME = new Set([

    "audio/mpeg",
    "audio/mp3",
    "audio/m4a",
    "audio/x-m4a",
    "audio/aac",
    "audio/wav",
    "audio/webm",
    "video/mp4",
    "video/quicktime",
    "video/x-quicktime",
    "video/webm",
]);


const ALLOWED_EXT = new Set([".mp3", ".m4a", ".aac", ".wav", ".mp4", ".mov", ".webm"]);


const mediaFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {

    const mime = file.mimetype.split(";")[0]!.trim().toLowerCase();
    const ext = "." + (file.originalname.split(".").pop() ?? "").toLowerCase();

    const ok =
        ALLOWED_MIME.has(mime)
        ||
        (["application/octet-stream", ""].includes(mime) && ALLOWED_EXT.has(ext));
    ok ?
        cb(null, true) :
        cb(new Error("Only audio (mp3, m4a, aac, wav) or video (mp4, mov, webm) files are allowed"));
};

export const mediaUpload = multer({ storage: multer.memoryStorage(), fileFilter: mediaFilter });


export async function getAnnouncements(req: Request, res: Response) {
    try {
        return res.json(await service.listAnnouncements(req.user!));
    } catch (err) {
        return fail(res, err, "Failed to fetch announcements");
    }
}



export async function createAnnouncement(req: Request, res: Response) {
    try {

        if (!req.body.title) return res.status(400).json({ error: "title is required" });
        return res.status(201).json(await service.createAnnouncement(req.body, req.user!.id));

    } catch (err) {
        return fail(res, err, "Failed to create announcement");
    }
}



export async function getAnnouncementById(req: Request, res: Response) {
    try {

        const id = param(req.params.id);
        
        if (!id)
            return res.status(400).json({ error: "Missing announcement id" });

        const row = await service.findAnnouncement(id);
        
        if (!row)
            return res.status(404).json({ error: "Announcement not found" });

        const user = req.user!;
        
        if (user.role !== "admin" && row.targetBatchId && row.targetBatchId !== user.batchId)
            return res.status(403).json({ error: "Permission denied" });

        return res.json(row);

    } catch (err) {
        return fail(res, err, "Failed to fetch announcement");
    }
}



export async function updateAnnouncement(req: Request, res: Response) {
    try {

        const id = param(req.params.id);

        if (!id)
            return res.status(400).json({ error: "Missing announcement id" });

        const existing = await service.findAnnouncement(id);

        if (!existing) return res.status(404).json({ error: "Announcement not found" });
        
        const user = req.user!;

        if (user.role !== "admin" && existing.createdBy !== user.id)
            return res.status(403).json({ error: "Permission denied" });

        return res.json(await service.updateAnnouncement(id, req.body));

    } catch (err) {
        return fail(res, err, "Failed to update announcement");
    }
}



export async function deleteAnnouncement(req: Request, res: Response) {
    try {

        const id = param(req.params.id);

        if (!id)
            return res.status(400).json({ error: "Missing announcement id" });

        if (req.user!.role !== "admin")
            return res.status(403).json({ error: "Only admins can delete announcements" });

        const existing = await service.findAnnouncement(id);

        if (!existing) return res.status(404).json({ error: "Announcement not found" });

        await service.deleteAnnouncement(id);
        return res.json({ message: "Deleted successfully" });

    } catch (err) { return fail(res, err, "Failed to delete announcement"); }
}



export async function searchAnnouncements(req: Request, res: Response) {
    try {

        const q = param(req.query.q);

        if (!q)
            return res.status(400).json({ error: "Search query q is required" });

        return res.json(await service.searchAnnouncements(q, req.user!));

    } catch (err) {
        return fail(res, err, "Failed to search announcements");
    }
}



export async function getAnnouncementsByBatch(req: Request, res: Response) {
    try {

        const batchId = param(req.params.batchId);

        if (!batchId) return res.status(400).json({ error: "Missing batchId" });

        return res.json(await service.listByBatch(batchId));
    } catch (err) {
        return fail(res, err, "Failed to fetch announcements by batch");
    }
}



export async function getAnnouncementsByUniversity(req: Request, res: Response) {
    try {

        const universityId = param(req.params.universityId);

        if (!universityId) return res.status(400).json({ error: "Missing universityId" });

        return res.json(await service.listByUniversity(universityId));
    } catch (err) {
        return fail(res, err, "Failed to fetch announcements by university");
    }
}



export async function uploadAnnouncementMedia(req: Request, res: Response) {
    try {

        if (!req.file) return res.status(400).json({ error: "No file provided" });

        const { key, url } = await service.uploadMedia(req.file);

        return res.json({ url, key });
    } catch (err) {
        return fail(res, err, "Failed to upload media");
    }
}