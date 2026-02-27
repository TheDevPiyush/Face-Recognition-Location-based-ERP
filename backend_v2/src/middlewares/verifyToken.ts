import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

// ------------------------------------------------------------------ //
// Types
// ------------------------------------------------------------------ //

interface JwtPayload {
    email: string;
    iat: number;
    exp: number;
}

// ------------------------------------------------------------------ //
// Middleware
// ------------------------------------------------------------------ //

export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ error: "Authorization header missing or malformed" });
            return;
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            res.status(401).json({ error: "Token missing" });
            return;
        }

        const secret = process.env.JSON_WEB_SECRET;

        if (!secret) {
            console.error("[auth.middleware] JWT_SECRET is not set in environment variables");
            res.status(500).json({ error: "Server misconfiguration" });
            return;
        }

        let decoded: JwtPayload;

        try {
            decoded = jwt.verify(token, secret) as JwtPayload;
        } catch (err) {
            if (err instanceof jwt.TokenExpiredError) {
                res.status(401).json({ error: "Token has expired" });
                return;
            }
            if (err instanceof jwt.JsonWebTokenError) {
                res.status(401).json({ error: "Invalid token" });
                return;
            }
            throw err; // unexpected error — let outer catch handle it
        }

        // Fetch fresh user from DB so req.user always has up-to-date data
        const user = await db.query.users.findFirst({
            where: eq(users.email, decoded.email),
        });

        if (!user) {
            res.status(401).json({ error: "User belonging to this token no longer exists" });
            return;
        }

        req.user = user;
        next();
    } catch (err) {
        console.error("[auth.middleware] Unexpected error:", err);
        res.status(500).json({ error: "Authentication failed" });
    }
};

// ------------------------------------------------------------------ //
// Role-based guard — use AFTER authenticate
// Usage: router.get("/admin", authenticate, requireRole("admin"), handler)
// ------------------------------------------------------------------ //

export const requireRole = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        if (!roles.includes(req.user.role as string)) {
            res.status(403).json({
                error: `Access denied. Required role: ${roles.join(" or ")}`,
            });
            return;
        }

        next();
    };
};

// ------------------------------------------------------------------ //
// Staff-only guard — use AFTER authenticate
// ------------------------------------------------------------------ //

export const requireStaff = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    if (!req.user.isStaff) {
        res.status(403).json({ error: "Staff access required" });
        return;
    }

    next();
};