import { Router } from "express";
import { authenticate, requireStaff } from "../../middlewares/verifyToken";
import { createCourse, getCourse, getCourses } from "../../controllers/course/course.controller";

const courseRouter = Router();

courseRouter.get("/", authenticate, getCourses);
courseRouter.post("/", authenticate, requireStaff, createCourse);
courseRouter.get("/:pk", authenticate, getCourse);

export default courseRouter;