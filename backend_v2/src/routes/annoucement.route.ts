import { Router } from "express";
import { authenticate, requireStaff } from "../middlewares/verifyToken";
import {
    createAnnouncement,
    deleteAnnouncement,
    getAnnouncementById,
    getAnnouncements,
    getAnnouncementsByBatch,
    getAnnouncementsByUniversity,
    mediaUpload,
    searchAnnouncements,
    updateAnnouncement,
    uploadAnnouncementMedia
} from "../controllers/annoucement.controller";

const announcementRouter = Router();

// ------------  Public (authenticated) reads ------------
announcementRouter.get("/",
    authenticate,
    getAnnouncements
);
announcementRouter.get("/search",
    authenticate,
    searchAnnouncements
);
announcementRouter.get("/batch/:batchId",
    authenticate,
    getAnnouncementsByBatch
);
announcementRouter.get("/university/:universityId",
    authenticate,
    getAnnouncementsByUniversity
);
announcementRouter.get("/:id",
    authenticate,
    getAnnouncementById
);

// ------------ Admin / staff writes ----------
announcementRouter.post("/",
    authenticate,
    requireStaff,
    createAnnouncement
);
announcementRouter.patch("/:id",
    authenticate,
    updateAnnouncement
);
announcementRouter.delete("/:id",
    authenticate,
    requireStaff,
    deleteAnnouncement
);

// --------------------  Media upload (admin only) -----------
announcementRouter.post(
    "/upload-media",
    authenticate,
    requireStaff,
    mediaUpload.single("file"),
    uploadAnnouncementMedia,
);

export { announcementRouter };