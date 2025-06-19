import * as utilModule from "./util";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { handler } from "./index";

describe("Blockbuster Index MCP Handler", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return status 200 and an empty body", async () => {
    const result = (await handler(
      {} as APIGatewayProxyEvent,
      {} as Context,
      () => {},
    )) as APIGatewayProxyResult;
    expect(result.statusCode).toBe(200);
    expect(result.body).toBe("{}");
  });

  it("should catch errors and return a 500 response", async () => {
    const spyLogger = jest
      .spyOn(utilModule.logger, "error")
      .mockImplementation();
    const spyError = jest
      .spyOn(JSON, "stringify")
      .mockImplementationOnce(() => {
        throw new Error("Simulated failure");
      });

    const result = (await handler(
      {} as APIGatewayProxyEvent,
      {} as Context,
      () => {},
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(500);
    expect(result.body).toContain(
      "There was an error calculating the blockbuster index!",
    );
    expect(spyLogger).toHaveBeenCalledWith(
      "Blockbuster index calculation failed: ",
      "Simulated failure",
    );

    spyError.mockRestore();
  });
});
