import { HTTPException } from "hono/http-exception";

export type PresentableError = {
  readonly _tag: string;
  readonly message: string;
};

export const presentDomainError = (error: PresentableError): never => {
  switch (error._tag) {
    case "ProductNotFoundError":
    case "CartNotFoundError":
    case "OrderNotFoundError":
    case "UserNotFoundError":
      throw new HTTPException(404, { message: error.message });

    case "InvalidStatusTransitionError":
    case "InvalidOrderStateTransitionError":
    case "ProductOutOfStockError":
    case "InvalidQuantityError":
    case "InvalidSizeError":
    case "EmptyOrderError":
    case "PasswordComplexityError":
    case "ValidationError":
      throw new HTTPException(422, { message: error.message });

    case "DuplicateEmailError":
      throw new HTTPException(409, { message: error.message });

    case "InvalidCredentialsError":
      throw new HTTPException(401, { message: error.message });

    case "ForbiddenError":
      throw new HTTPException(403, { message: error.message });
    default:
      throw new HTTPException(500, { message: `${error._tag}: ${error.message}` });
  }
};
