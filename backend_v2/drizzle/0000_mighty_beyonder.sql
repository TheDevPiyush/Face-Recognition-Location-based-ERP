CREATE TYPE "public"."announcement_type" AS ENUM('text', 'audio', 'video');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('P', 'A', 'NA');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'teacher', 'admin', 'parent', 'other');--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"announcement_type" "announcement_type" DEFAULT 'text',
	"text_content" text,
	"audio_url" text,
	"video_url" text,
	"created_by" uuid,
	"target_batch_id" uuid,
	"target_university_id" uuid,
	"is_published" boolean DEFAULT true,
	"is_pinned" boolean DEFAULT false,
	"published_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"attendance_window_id" uuid,
	"status" "attendance_status" DEFAULT 'NA',
	"marked_by" uuid,
	"date" date DEFAULT CURRENT_DATE,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "attendance_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_batch_id" uuid,
	"target_subject_id" uuid,
	"start_time" timestamp DEFAULT now(),
	"duration" integer DEFAULT 30,
	"is_active" boolean DEFAULT false,
	"last_interacted_by" uuid,
	"date" date DEFAULT CURRENT_DATE,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid,
	"code" varchar(50),
	"start_year" integer,
	"end_year" integer,
	"name" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"university_id" uuid,
	"name" varchar(255),
	"code" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid,
	"faculty_id" uuid,
	"name" varchar(255),
	"code" varchar(50),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "universities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255),
	"code" varchar(50),
	"address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "universities_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"login_otp" varchar(10),
	"login_otp_expires_at" timestamp,
	"last_otp_sent_at" timestamp,
	"is_email_verified" boolean DEFAULT false,
	"auth_provider" varchar(50) DEFAULT 'email_otp',
	"name" varchar(255),
	"image_url" text,
	"college_id" varchar(255),
	"role" "user_role" DEFAULT 'student',
	"batch_id" uuid,
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"phone" varchar(20),
	"address" text,
	"city" varchar(255),
	"state" varchar(255),
	"country" varchar(255),
	"pincode" varchar(20),
	"profile_picture" varchar(255),
	"rekognition_face_id" varchar(255),
	"rekognition_collection_id" varchar(255),
	"face_registered" boolean DEFAULT false,
	"can_update_picture" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"is_staff" boolean DEFAULT false,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_login" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_college_id_unique" UNIQUE("college_id")
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_target_batch_id_batches_id_fk" FOREIGN KEY ("target_batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_target_university_id_universities_id_fk" FOREIGN KEY ("target_university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_attendance_window_id_attendance_windows_id_fk" FOREIGN KEY ("attendance_window_id") REFERENCES "public"."attendance_windows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_marked_by_users_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_windows" ADD CONSTRAINT "attendance_windows_target_batch_id_batches_id_fk" FOREIGN KEY ("target_batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_windows" ADD CONSTRAINT "attendance_windows_target_subject_id_subjects_id_fk" FOREIGN KEY ("target_subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_windows" ADD CONSTRAINT "attendance_windows_last_interacted_by_users_id_fk" FOREIGN KEY ("last_interacted_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_faculty_id_users_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcement_ordering_idx" ON "announcements" USING btree ("is_pinned","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_window_unique" ON "attendance_windows" USING btree ("target_batch_id","target_subject_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "email_unique" ON "users" USING btree ("email");