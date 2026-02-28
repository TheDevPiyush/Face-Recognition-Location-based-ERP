import { db } from "../../db";
import { users, batches, courses, universities } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { uploadToS3 } from "./../aws/s3.service";
import { registerFace, deregisterFace } from "./../aws/rekognition.service";

export function stripUser(user: Record<string, unknown>) {
    const { loginOtp, loginOtpExpiresAt, lastOtpSentAt, rekognitionFaceId, rekognitionCollectionId, isDeleted, ...safe } = user;
    return safe;
}

export async function resolveBatchChain(batchId: string | null | undefined) {
    if (!batchId) return null;

    const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
    if (!batch) return null;

    const courseId = (batch as any).courseId as string | null;
    if (!courseId) return { ...batch, course: null };

    const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
    if (!course) return { ...batch, course: null };

    const universityId = (course as any).universityId as string | null;
    if (!universityId) return { ...batch, course: { ...course, university: null } };

    const [university] = await db.select().from(universities).where(eq(universities.id, universityId)).limit(1);
    return { ...batch, course: { ...course, university: university ?? null } };
}

export async function getAllUsers() {
    const all = await db.select().from(users);
    return all.map((u) => stripUser(u as any));
}

export async function getUserById(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user ?? null;
}

export async function insertUsers(payload: any | any[]) {
    const values = Array.isArray(payload) ? payload : [payload];
    const inserted = await db.insert(users).values(values).returning();
    return inserted.map((u) => stripUser(u as any));
}

export async function updateUserById(id: string, data: any) {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated ?? null;
}

export async function getStudentsInBatch(batchId: string) {
    const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
    if (!batch) throw { status: 404, message: "Batch not found" };

    const students = await db.select().from(users).where(and(eq(users.role, "student"), eq(users.batchId, batchId)));
    return students.map((u) => stripUser(u as any));
}

export async function updateProfilePicture(user: any, file: Express.Multer.File) {
    const imageResult = await uploadToS3(file, "profile-pictures");

    if (user.rekognitionFaceId) {
        await deregisterFace(user.rekognitionFaceId).catch((e) =>
            console.warn("[user] Failed to deregister old face:", e)
        );
    }

    const faceId = await registerFace(process.env.AWS_S3_BUCKET!, imageResult.key, user.id);

    await db.update(users).set({
        profilePicture: imageResult.url,
        rekognitionFaceId: faceId,
        rekognitionCollectionId: process.env.AWS_REKOGNITION_COLLECTION!,
        faceRegistered: true,
    }).where(eq(users.id, user.id));
}

export async function updateLocation(userId: string, lat: number, lon: number) {
    const [updated] = await db
        .update(users)
        .set({ latitude: String(lat), longitude: String(lon) })
        .where(eq(users.id, userId))
        .returning();
    return updated ?? null;
}