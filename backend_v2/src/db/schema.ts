import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  decimal,
  date,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";

/* ============================================================
   ENUMS
============================================================ */

export const userRoleEnum = pgEnum("user_role", [
  "student",
  "teacher",
  "admin",
  "parent",
  "other",
]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "P",
  "A",
  "NA",
]);

export const announcementTypeEnum = pgEnum("announcement_type", [
  "text",
  "audio",
  "video",
]);

/* ============================================================
   UNIVERSITY
============================================================ */

export const universities = pgTable("universities", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: varchar("name", { length: 255 }),
  code: varchar("code", { length: 50 }).unique(),
  address: text("address"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ============================================================
   COURSE
============================================================ */

export const courses = pgTable("courses", {
  id: uuid("id").defaultRandom().primaryKey(),

  universityId: uuid("university_id")
    .references(() => universities.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 255 }),
  code: varchar("code", { length: 50 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ============================================================
   BATCH
============================================================ */

export const batches = pgTable("batches", {
  id: uuid("id").defaultRandom().primaryKey(),

  courseId: uuid("course_id")
    .references(() => courses.id, { onDelete: "cascade" }),

  code: varchar("code", { length: 50 }),
  startYear: integer("start_year"),
  endYear: integer("end_year"),

  name: varchar("name", { length: 100 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ============================================================
   USERS (AWS Rekognition Ready)
============================================================ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /* ================= AUTH ================= */

    email: varchar("email", { length: 255 }).notNull(),
    // OTP login
    loginOTP: varchar("login_otp", { length: 10 }),
    loginOTPExpiresAt: timestamp("login_otp_expires_at"),
    lastOtpSentAt: timestamp("last_otp_sent_at"),

    isEmailVerified: boolean("is_email_verified").default(false),

    authProvider: varchar("auth_provider", { length: 50 })
      .default("email_otp"),

    /* ================= BASIC INFO ================= */

    name: varchar("name", { length: 255 }),

    imageUrl: text("image_url"),
    collegeId: varchar("college_id", { length: 255 }).unique(),

    role: userRoleEnum("role").default("student"),

    batchId: uuid("batch_id").references(() => batches.id, {
      onDelete: "cascade",
    }),

    /* ================= LOCATION ================= */

    latitude: decimal("latitude", { precision: 10, scale: 8 }),
    longitude: decimal("longitude", { precision: 11, scale: 8 }),

    /* ================= CONTACT ================= */

    phone: varchar("phone", { length: 20 }),
    address: text("address"),
    city: varchar("city", { length: 255 }),
    state: varchar("state", { length: 255 }),
    country: varchar("country", { length: 255 }),
    pincode: varchar("pincode", { length: 20 }),

    profilePicture: varchar("profile_picture", { length: 255 }),

    /* ================= AWS REKOGNITION ================= */

    rekognitionFaceId: varchar("rekognition_face_id", { length: 255 }),
    rekognitionCollectionId: varchar(
      "rekognition_collection_id",
      { length: 255 }
    ),
    faceRegistered: boolean("face_registered").default(false),

    canUpdatePicture: boolean("can_update_picture").default(false),

    /* ================= STATUS ================= */

    isActive: boolean("is_active").default(true),
    isStaff: boolean("is_staff").default(false),
    isDeleted: boolean("is_deleted").default(false),

    /* ================= TIMESTAMPS ================= */

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    lastLogin: timestamp("last_login"),
  },
  (t) => ({
    emailIdx: uniqueIndex("email_unique").on(t.email),
  })
);

/* ============================================================
   SUBJECT
============================================================ */

export const subjects = pgTable("subjects", {
  id: uuid("id").defaultRandom().primaryKey(),

  batchId: uuid("batch_id")
    .references(() => batches.id, { onDelete: "cascade" }),

  facultyId: uuid("faculty_id")
    .references(() => users.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 255 }),
  code: varchar("code", { length: 50 }),

  createdAt: timestamp("created_at").defaultNow(),
});

/* ============================================================
   ATTENDANCE WINDOW
============================================================ */

export const attendanceWindows = pgTable(
  "attendance_windows",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    targetBatchId: uuid("target_batch_id")
      .references(() => batches.id, { onDelete: "cascade" }),

    targetSubjectId: uuid("target_subject_id")
      .references(() => subjects.id, { onDelete: "cascade" }),

    startTime: timestamp("start_time").defaultNow(),
    duration: integer("duration").default(30),

    isActive: boolean("is_active").default(false),

    lastInteractedBy: uuid("last_interacted_by")
      .references(() => users.id, { onDelete: "cascade" }),

    date: date("date").default(sql`CURRENT_DATE`),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    uniqueWindow: uniqueIndex("attendance_window_unique").on(
      t.targetBatchId,
      t.targetSubjectId,
      t.date
    ),
  })
);

/* ============================================================
   ATTENDANCE RECORD
============================================================ */

export const attendanceRecords = pgTable("attendance_records", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" }),

  attendanceWindowId: uuid("attendance_window_id")
    .references(() => attendanceWindows.id, { onDelete: "cascade" }),

  status: attendanceStatusEnum("status").default("NA"),

  markedBy: uuid("marked_by")
    .references(() => users.id, { onDelete: "cascade" }),

  date: date("date").default(sql`CURRENT_DATE`),

  createdAt: timestamp("created_at").defaultNow(),
});

/* ============================================================
   ANNOUNCEMENTS
============================================================ */

export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),

    announcementType:
      announcementTypeEnum("announcement_type").default("text"),

    textContent: text("text_content"),
    audioUrl: text("audio_url"),
    videoUrl: text("video_url"),

    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),

    targetBatchId: uuid("target_batch_id")
      .references(() => batches.id, { onDelete: "cascade" }),

    targetUniversityId: uuid("target_university_id")
      .references(() => universities.id, { onDelete: "cascade" }),

    isPublished: boolean("is_published").default(true),
    isPinned: boolean("is_pinned").default(false),

    publishedAt: timestamp("published_at").defaultNow(),
    expiresAt: timestamp("expires_at"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    orderingIdx: index("announcement_ordering_idx").on(
      t.isPinned,
      t.publishedAt
    ),
  })
);