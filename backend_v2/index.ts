import express from 'express';
import type { Response } from 'express';
import dotenv from 'dotenv'
import { errorHandler } from './src/middlewares/errorMiddleware';
import { authRouter } from './src/routes/auth.route';
import userRouter from './src/routes/user.route';
import attendanceRouter from './src/routes/attendance.router';
import batchRouter from './src/routes/batch.route';
import universityRouter from './src/routes/university.route';
import courseRouter from './src/routes/course.route';
import subjectRouter from './src/routes/subject.route';
import { analyticsRouter } from './src/routes/analytics.router';
import { announcementRouter } from './src/routes/annoucement.route';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

app.get('/', (_, res: Response) => {
    res.send({ "message": "OK" });
});

app.use('/api/auth', authRouter);
app.use("/api/users", userRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/university", universityRouter);
app.use("/api/batch", batchRouter);
app.use("/api/course", courseRouter);
app.use("/api/subject", subjectRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/announcement", announcementRouter);

app.use(errorHandler);

app.listen(PORT as number, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
});