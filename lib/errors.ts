/** Errors that are safe to show to the user. Anything else is reported as a generic failure. */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Your session has expired. Please sign in again.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "This item no longer exists.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class StorageUnavailableError extends AppError {
  constructor(message = "The data store is not reachable right now. Please try again shortly.") {
    super(message);
    this.name = "StorageUnavailableError";
  }
}
