import { Router } from "express";
import multer from "multer";

import { authenticate, requireStaff } from "../middlewares/verifyToken";

import {
    getUsers,
    getUserDetail,
    createUser,
    updateUser,
    getStudentsByBatch,
    getCurrentUser,
    updateCurrentUser,
    updateLocation,
} from "../controllers/user.controller";

const userRouter = Router();

// 5 MB limit on profile pictures.
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

// current authenticated user
userRouter.get("/me", authenticate, getCurrentUser);
userRouter.patch("/me", authenticate, upload.single("profile_picture"), updateCurrentUser);
userRouter.patch("/location", authenticate, updateLocation);

// Staff / admin related
userRouter.get("/batch/:batchId", authenticate, requireStaff, getStudentsByBatch);
userRouter.get("/", authenticate, requireStaff, getUsers);
userRouter.post("/", authenticate, requireStaff, createUser);
userRouter.get("/:pk", authenticate, requireStaff, getUserDetail);
userRouter.patch("/:pk", authenticate, requireStaff, updateUser);

export default userRouter;