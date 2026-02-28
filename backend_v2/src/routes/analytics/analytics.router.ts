import { Router } from "express";
import { authenticate } from "../../middlewares/verifyToken";
import { getAttendanceAnalytics, getMonthlyPercentage, getStudentCalendar } from "../../controllers/analytics/analytics.controller";

const analyticsRouter = Router();

analyticsRouter.get("/", authenticate, getAttendanceAnalytics);

analyticsRouter.get("/monthly-percentage", authenticate, getMonthlyPercentage);

analyticsRouter.get("/student-calendar", authenticate, getStudentCalendar);

export { analyticsRouter };