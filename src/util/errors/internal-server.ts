import { CustomError } from "./custom-error";

class InternalServerError extends Error implements CustomError {
  statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = "InternalServerError";
    this.statusCode = 500;
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }

  build(headers = {}) {
    return {
      headers,
      body: JSON.stringify({
        error: this.name,
        message: this.message,
      }),
      statusCode: this.statusCode,
    };
  }
}

export { InternalServerError };
