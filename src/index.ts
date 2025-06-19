import { APIGatewayProxyHandler } from "aws-lambda";
import { InternalServerError, logger } from "./util";

export const handler: APIGatewayProxyHandler = async () => {
  try {
    return {
      body: JSON.stringify({}),
      statusCode: 200,
    };
  } catch (err) {
    logger.error(
      "Blockbuster index calculation failed: ",
      (err as Error).message,
    );
    return new InternalServerError(
      "There was an error calculating the blockbuster index!",
    ).build();
  }
};
