import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';

export function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

/** Central error handler. Never leaks stack traces or internal details in production. */
export function createErrorHandler(env) {
  // Express identifies error handlers by their 4 arguments.
  // eslint-disable-next-line no-unused-vars
  return function errorHandler(err, req, res, next) {
    if (res.headersSent) return next(err);

    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    if (err instanceof ZodError) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      });
    }
    if (err?.name === 'ValidationError' && err.errors) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid data',
          details: Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })),
        },
      });
    }
    if (err?.code === 11000) {
      return res.status(409).json({ error: { code: 'DUPLICATE', message: 'Resource already exists' } });
    }
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Malformed JSON body' } });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'Request body too large' } });
    }

    if (env.NODE_ENV !== 'test') console.error(err);
    const body = { error: { code: 'INTERNAL', message: 'Something went wrong' } };
    if (env.NODE_ENV === 'development') body.error.stack = err?.stack;
    return res.status(500).json(body);
  };
}
