import type { Request, Response } from "express";
import {
    stripUser,
    resolveBatchChain,
    getAllUsers,
    getUserById,
    insertUsers,
    updateUserById,
    getStudentsInBatch,
    updateProfilePicture,
    updateLocation as setLocation,
} from "./../services/controller_services/user.service";

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

function param(v: any) {
    if (v === undefined) return null;
    return Array.isArray(v) ? v[0] : v;
}

function fail(res: Response, err: any, fallback = "Operation failed") {
    const status = err?.status ?? 500;
    const message = err?.message ?? fallback;
    if (status === 500) console.error("[user]", err);
    return res.status(status).json({ error: message });
}

export const getUsers = async (_req: Request, res: Response) => {
    try {
        return res.json(await getAllUsers());
    } catch (err) { return fail(res, err, "Failed to fetch users"); }
};

export const getUserDetail = async (req: Request, res: Response) => {
    try {
        
        const pk = param(req.params.pk);
        if (!pk) return res.status(400).json({ error: "User ID is required" });

        const user = await getUserById(pk);
        if (!user) return res.status(404).json({ error: "User not found" });

        return res.json(stripUser(user as any));
    } catch (err) { return fail(res, err, "Failed to fetch user"); }
};

export const createUser = async (req: Request, res: Response) => {
    try {
      
        const payload = req.body;

        if (!payload || (Array.isArray(payload) && !payload.length))
            return res.status(400).json({ error: "Request body is required" });

        return res.status(201).json(await insertUsers(payload));
    } catch (err: any) {
        if (err?.message?.includes("unique") || err?.message?.includes("violates"))
            return res.status(400).json({ error: "Invalid or duplicate data", detail: err.message });
        return fail(res, err, "Failed to create user");
    }
};

export const updateUser = async (req: Request, res: Response) => {
    try {

        const pk = param(req.params.pk);

        if (!pk) return res.status(400).json({ error: "User ID is required" });

        if (!req.body || !Object.keys(req.body).length) return res.status(400).json({ error: "Request body is required" });

        const updated = await updateUserById(pk, req.body);

        if (!updated) return res.status(404).json({ error: "User not found" });

        return res.json(stripUser(updated as any));
    } catch (err) { return fail(res, err, "Failed to update user"); }
};

export const getStudentsByBatch = async (req: Request, res: Response) => {
    try {

        const batchId = param(req.params.batchId);

        if (!batchId) return res.status(400).json({ error: "Batch ID is required" });

        return res.json(await getStudentsInBatch(batchId));
    } catch (err) { return fail(res, err, "Failed to fetch students"); }
};

export const getCurrentUser = async (req: Request, res: Response) => {
    try {

        const batch = await resolveBatchChain(req.user.batchId);

        return res.json({ ...stripUser(req.user as any), batch });
    } catch (err) { return fail(res, err, "Failed to fetch current user"); }
};

export const updateCurrentUser = async (req: Request, res: Response) => {
    try {

        const user = req.user;

        if (!user.canUpdatePicture)
            return res.status(403).json({ error: "You require admin approval to update your profile picture" });

        if (req.file) await updateProfilePicture(user, req.file);

        const { profilePicture, rekognitionFaceId, faceRegistered, isStaff, isActive, isDeleted, role, ...safeBody } = req.body ?? {};

        if (!Object.keys(safeBody).length) {
            const refreshed = await getUserById(user.id);
            return res.json(stripUser(refreshed as any));
        }

        const updated = await updateUserById(user.id, safeBody);
        if (!updated)
            return res.status(404).json({ error: "User not found" });

        return res.json(stripUser(updated as any));
    } catch (err) { return fail(res, err, "Failed to update current user"); }
};

export const updateLocation = async (req: Request, res: Response) => {
    try {

        const { latitude, longitude } = req.body;

        if (latitude === undefined || longitude === undefined)
            return res.status(400).json({ error: "'latitude' and 'longitude' are required" });


        const lat = Number(latitude);

        const lon = Number(longitude);

        if (isNaN(lat) || isNaN(lon))
            return res.status(400).json({ error: "Invalid latitude/longitude" });

        if (lat < -90 || lat > 90 || lon < -180 || lon > 180)
            return res.status(400).json({ error: "Latitude/longitude out of range" });

        const updated = await setLocation(req.user.id, lat, lon);
        if (!updated)
            return res.status(404).json({ error: "User not found" });

        return res.json(stripUser(updated as any));
    } catch (err) { return fail(res, err, "Failed to update location"); }
};