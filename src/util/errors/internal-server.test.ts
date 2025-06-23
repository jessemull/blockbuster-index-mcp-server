import { InternalServerError } from './internal-server';

describe('InternalServerError', () => {
  const message = 'Something went wrong';

  it('should create an error with the correct name and message', () => {
    const error = new InternalServerError(message);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('InternalServerError');
    expect(error.message).toBe(message);
    expect(error.statusCode).toBe(500);
  });

  it('should preserve prototype chain', () => {
    const error = new InternalServerError(message);
    expect(error instanceof InternalServerError).toBe(true);
  });

  it('should build a response with default headers', () => {
    const error = new InternalServerError(message);
    const response = error.build();

    expect(response).toEqual({
      headers: {},
      body: JSON.stringify({
        error: 'InternalServerError',
        message,
      }),
      statusCode: 500,
    });
  });

  it('should build a response with custom headers', () => {
    const headers = { 'Content-Type': 'application/json' };
    const error = new InternalServerError(message);
    const response = error.build(headers);

    expect(response.headers).toBe(headers);
    expect(response.statusCode).toBe(500);

    const body = JSON.parse(response.body);
    expect(body.error).toBe('InternalServerError');
    expect(body.message).toBe(message);
  });
});
