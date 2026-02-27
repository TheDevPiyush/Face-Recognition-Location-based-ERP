import { db } from "../db";
import { universities, courses, batches, subjects, users } from "../db/schema";

const UNIVERSITY_DATA = [
    { name: "Patliputra University", code: "PPU" },
    { name: "Aryabhatta Knowledge University", code: "AKU" },
];

const COURSE_DATA = [
    { name: "Bachelor of Computer Applications", code: "BCA" },
    { name: "Bachelor of Business Administration", code: "BBA" },
    { name: "Bachelor of Science in Information Technology", code: "BScIT" },
];

const BATCH_DATA = [
    { code: "B1", name: "Batch 1", startYear: 2022, endYear: 2025 },
    { code: "B2", name: "Batch 2", startYear: 2023, endYear: 2026 },
    { code: "B3", name: "Batch 3", startYear: 2024, endYear: 2027 },
];

const SUBJECT_DATA = [
    { name: "Django", code: "DJG" },
    { name: "Mathematics", code: "MTH" },
    { name: "English", code: "ENG" },
    { name: "Web Development", code: "WEB" },
    { name: "Management", code: "MGT" },
    { name: "Operating Systems", code: "OS" },
];

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!;
}

async function seed() {
    console.log("🌱 Starting seed...\n");

    // ---- Universities ------------------------------------------------- //
    console.log("Inserting universities...");
    const insertedUniversities = await db
        .insert(universities)
        .values(UNIVERSITY_DATA)
        .returning();

    insertedUniversities.forEach((u) => console.log(`  ✅ ${u.code} — ${u.name} (${u.id})`));

    // ---- Courses ------------------------------------------------------ //
    console.log("\nInserting courses...");
    const courseValues = COURSE_DATA.map((c) => ({
        ...c,
        universityId: pick(insertedUniversities).id,
    }));

    const insertedCourses = await db.insert(courses).values(courseValues).returning();
    insertedCourses.forEach((c) => console.log(`  ✅ ${c.code} — ${c.name} (${c.id})`));

    // ---- Batches ------------------------------------------------------ //
    console.log("\nInserting batches...");
    const batchValues = BATCH_DATA.map((b) => ({
        ...b,
        courseId: pick(insertedCourses).id,
    }));

    const insertedBatches = await db.insert(batches).values(batchValues).returning();
    insertedBatches.forEach((b) => console.log(`  ✅ ${b.code} — ${b.name} (${b.id})`));

    // ---- Users (students) -------------------------------------------- //
    console.log("\nInserting students...");
    const studentValues = Array.from({ length: 5 }, (_, i) => ({
        email: `thedevpiyush+${i}@gmail.com`,
        name: `Test Student ${i}`,
        role: "student" as const,
        batchId: pick(insertedBatches).id,
        isEmailVerified: true,
        isActive: true,
        collegeId: `STU00${i}`,
    }));

    const insertedStudents = await db.insert(users).values(studentValues).returning();
    insertedStudents.forEach((s) =>
        console.log(`  ✅ ${s.email} — batch: ${s.batchId} (${s.id})`)
    );

    // ---- Subjects ----------------------------------------------------- //
    // Each subject is assigned to a random batch and a random faculty user.
    // Since we only have students right now we skip facultyId (it's nullable).
    console.log("\nInserting subjects...");
    const subjectValues = SUBJECT_DATA.map((s) => ({
        ...s,
        batchId: pick(insertedBatches).id,
    }));

    const insertedSubjects = await db.insert(subjects).values(subjectValues).returning();
    insertedSubjects.forEach((s) => console.log(`  ✅ ${s.code} — ${s.name} (${s.id})`));

    // ---- Summary ------------------------------------------------------ //
    console.log("\n✅ Seed complete!");
    console.log(`   Universities : ${insertedUniversities.length}`);
    console.log(`   Courses      : ${insertedCourses.length}`);
    console.log(`   Batches      : ${insertedBatches.length}`);
    console.log(`   Students     : ${insertedStudents.length}`);
    console.log(`   Subjects     : ${insertedSubjects.length}`);

    process.exit(0);
}

seed().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});