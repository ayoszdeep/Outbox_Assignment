import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors/app.error";
import logger from "../config/logger.config";

export const appErrorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
    // Anything that is not one of our AppErrors has no statusCode. Passing it on keeps
    // res.status(undefined) - which would itself throw - out of the error path.
    if (typeof err?.statusCode !== 'number') {
        next(err);
        return;
    }

    logger.error(err.message, { name: err.name, statusCode: err.statusCode });

    res.status(err.statusCode).json({
        success: false,
        message: err.message
    });
}

export const genericErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', { message: err?.message, stack: err?.stack });

    res.status(500).json({
        success: false,
        message: "Internal Server Error"
    });
}