/** An error that is safe to show to API clients. */
export class AppError extends Error {
  constructor(statusCode, message, code = 'ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}
