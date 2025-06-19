interface Headers {
  [header: string]: string | number | boolean;
}

interface CustomError extends Error {
  statusCode: number;
  build(headers?: Headers): {
    headers?: Headers;
    body: string;
    statusCode: number;
  };
}

export { CustomError };
