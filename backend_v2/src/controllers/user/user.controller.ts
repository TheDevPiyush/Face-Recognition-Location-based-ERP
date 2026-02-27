import type { Request, Response } from "express";
import { db } from "../../db";
import { users, batches } from "../../db/schema";
import { eq, and } from "drizzle-orm";

import { uploadToS3 } from "../../services/aws/s3.service";
import { deregisterFace, registerFace } from "../../services/aws/rekognition.service";

declare global {
    namespace Express {
        interface Request {
            user: {
                id: string;
                name: string | null;
                email: string;
                role: "student" | "teacher" | "admin" | "parent" | "other" | null;
                isStaff: boolean | null;
                profilePicture: string | null;
                canUpdatePicture: boolean | null;
                rekognitionFaceId: string | null;
                faceRegistered: boolean | null;
                batchId: string | null;
                latitude: string | null;
                longitude: string | null;
                [key: string]: unknown;
            };
        }
    }
}

// Maps a DB user row to the public API shape
function serializeUser(user: Record<string, unknown>) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        is_staff: user.isStaff,
        role: user.role,
        profile_picture: user.profilePicture,
        latitude: user.latitude,
        longitude: user.longitude,
    };
}

// Logs the error and returns a consistent 500 response
function serverError(res: Response, err: unknown, context = "Operation failed") {
    console.error(`[user.controller] ${context}:`, err);
    return res.status(500).json({ error: context });
}

// Normalises req.params values from `string | string[] | undefined` to `string | null`
function param(value: string | string[] | undefined): any {
    if (value === undefined) return null;
    return Array.isArray(value) ? value[0] : value;
}

// Returns all users
export const getUsers = async (_req: Request, res: Response) => {
    try {
        const allUsers = await db.select().from(users);
        return res.status(200).json(allUsers);
    } catch (err) {
        return serverError(res, err, "Failed to fetch users");
    }
};

// Returns a single user by ID
export const getUserDetail = async (req: Request, res: Response) => {
    try {
        const pk = param(req.params.pk);

        if (!pk) {
            return res.status(400).json({ error: "User ID is required" });
        }

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, pk))
            .limit(1);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json(serializeUser(user));
    } catch (err) {
        return serverError(res, err, "Failed to fetch user");
    }
};

// Creates one or many users from the request body
export const createUser = async (req: Request, res: Response) => {
    try {
        const payload = req.body;

        if (!payload || (Array.isArray(payload) && payload.length === 0)) {
            return res.status(400).json({ error: "Request body is required" });
        }

        const isMany = Array.isArray(payload);

        const inserted = await db
            .insert(users)
            .values(isMany ? payload : [payload])
            .returning();

        return res.status(201).json(inserted.map(serializeUser));
    } catch (err: unknown) {
        if (
            err instanceof Error &&
            (err.message.includes("unique") || err.message.includes("violates"))
        ) {
            return res
                .status(400)
                .json({ error: "Invalid or duplicate data", detail: err.message });
        }
        return serverError(res, err, "Failed to create user");
    }
};

// Updates any user by ID (admin/staff use)
export const updateUser = async (req: Request, res: Response) => {
    try {
        const pk = param(req.params.pk);

        if (!pk) {
            return res.status(400).json({ error: "User ID is required" });
        }

        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Request body is required" });
        }

        const [updated] = await db
            .update(users)
            .set(req.body)
            .where(eq(users.id, pk))
            .returning();

        if (!updated) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json(serializeUser(updated));
    } catch (err) {
        return serverError(res, err, "Failed to update user");
    }
};

// Returns all students belonging to a given batch
export const getStudentsByBatch = async (req: Request, res: Response) => {
    try {
        const batchId = param(req.params.batchId);

        if (!batchId) {
            return res.status(400).json({ error: "Batch ID is required" });
        }

        const [batch] = await db
            .select()
            .from(batches)
            .where(eq(batches.id, batchId))
            .limit(1);

        if (!batch) {
            return res.status(404).json({ error: "Batch not found" });
        }

        const students = await db
            .select()
            .from(users)
            .where(and(eq(users.role, "student"), eq(users.batchId, batchId)));

        return res.status(200).json(students.map(serializeUser));
    } catch (err) {
        return serverError(res, err, "Failed to fetch students");
    }
};

// Returns the currently authenticated user
export const getCurrentUser = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        return res.status(200).json(serializeUser(req.user));
    } catch (err) {
        return serverError(res, err, "Failed to fetch current user");
    }
};

// Updates the authenticated user's profile, including optional S3 picture upload and Rekognition face registration
export const updateCurrentUser = async (req: Request, res: Response) => {
    try {
        const user = req.user;

        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (!user.canUpdatePicture) {
            return res.status(403).json({
                error: "You require admin approval to update your profile picture",
            });
        }

        if (req.file) {
            let imageResult: { key: string; url: string };

            try {
                imageResult = await uploadToS3(req.file, "profile-pictures");
            } catch (err) {
                return serverError(res, err, "Failed to upload image to S3");
            }

            // Delete the old face from the collection before indexing the new one
            if (user.rekognitionFaceId) {
                try {
                    await deregisterFace(user.rekognitionFaceId as string);
                } catch (err) {
                    console.warn("[user.controller] Failed to deregister old face:", err);
                }
            }

            let faceId: string;
            console.log("====",user.id)
            try {
                faceId = await registerFace(
                    process.env.AWS_S3_BUCKET!,
                    imageResult.key,
                    user.id
                );
            } catch (err) {
                return serverError(res, err, "Failed to register face with Rekognition");
            }

            await db
                .update(users)
                .set({
                    profilePicture: imageResult.url,
                    rekognitionFaceId: faceId,
                    faceRegistered: true,
                    rekognitionCollectionId: process.env.AWS_REKOGNITION_COLLECTION
                })
                .where(eq(users.id, user.id));
        }


        return res.status(200).json({ "message": "Profile Updated Successfully" });
    } catch (err) {
        return serverError(res, err, "Failed to update current user");
    }
};

// Updates the authenticated user's latitude and longitude
export const updateLocation = async (req: Request, res: Response) => {
    try {
        const { latitude, longitude } = req.body;

        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({
                error: "'latitude' and 'longitude' are required",
            });
        }

        const lat = Number(latitude);
        const lon = Number(longitude);

        if (isNaN(lat) || isNaN(lon)) {
            return res.status(400).json({ error: "Invalid latitude/longitude values" });
        }

        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return res.status(400).json({ error: "Latitude/longitude out of valid range" });
        }

        const [updated] = await db
            .update(users)
            .set({
                latitude: String(lat),
                longitude: String(lon),
            })
            .where(eq(users.email, req.user.email))
            .returning();

        if (!updated) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json(serializeUser(updated));
    } catch (err) {
        return serverError(res, err, "Failed to update location");
    }
};