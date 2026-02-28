import { Router } from "express";
import multer from "multer";
import { authenticate } from "../middlewares/verifyToken";
import {
    getAttendanceWindow,
    markAttendance,
    upsertAttendanceWindow
} from "../controllers/attendance.controller";

const attendanceRouter = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            cb(new Error("Only image files are allowed"));
            return;
        }
        cb(null, true);
    },
});

attendanceRouter.get("/window", authenticate, getAttendanceWindow);
attendanceRouter.post("/window", authenticate, upsertAttendanceWindow);
attendanceRouter.post("/record", authenticate, upload.single("student_picture"), markAttendance);

export default attendanceRouter;