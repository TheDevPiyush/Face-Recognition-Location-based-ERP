import type { NextFunction, Response, Request } from "express"

export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        status: statusCode,
        message: err.message || "Internal Server Error"
    });
};

export const throwError = (message = "Internal Server Error", statusCode = 500) => {
    const err: any = new Error(message);
    err.statusCode = statusCode;
    return err;
};
