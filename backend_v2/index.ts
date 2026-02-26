import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv'
import { errorHandler } from './src/middlewares/errorMiddleware';
import { authRouter } from './src/routes/auth/auth.route';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json())

app.get('/', (_, res: Response) => {
    res.send({ "message": "OK" });
});

app.use('/auth', authRouter);

app.use(errorHandler);
app.listen(PORT as number, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
});