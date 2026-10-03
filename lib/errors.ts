/** Errors whose message is safe to show to the user. Anything else is reported generically. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly meta?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Sesi Anda telah berakhir. Silakan masuk kembali.") {
    super(message, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Anda tidak memiliki izin untuk melakukan tindakan ini.") {
    super(message, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Data tidak ditemukan atau sudah dihapus.") {
    super(message, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = "CONFLICT", meta?: Record<string, string>) {
    super(message, code, meta);
    this.name = "ConflictError";
  }
}

export class StorageUnavailableError extends AppError {
  constructor(message = "Penyimpanan data sedang tidak dapat dijangkau. Silakan coba lagi sebentar.") {
    super(message, "STORAGE_UNAVAILABLE");
    this.name = "StorageUnavailableError";
  }
}
