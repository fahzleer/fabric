import type { Result } from "@fabric/types";
import type { Order, OrderSummary } from "../../domain/order";
import type { OrderNotFoundError } from "../../domain/order/order.errors";
import type { OrderId } from "../../domain/order/order.value-objects";
import type {
  ProductNotFoundError,
  ProductOutOfStockError,
} from "../../domain/product/product.errors";
import type { UserId } from "../../domain/user/user.value-objects";
import type {
  PaginatedResult,
  PaginationInput,
  RepositoryError,
  StockReservationItem,
} from "./product.repository.port";

export interface OrderRepositoryPort {
  findById(id: OrderId): Promise<Result<Order, OrderNotFoundError | RepositoryError>>;

  findByUserId(
    userId: UserId,
    pagination: PaginationInput
  ): Promise<Result<PaginatedResult<OrderSummary>, RepositoryError>>;

  save(order: Order): Promise<Result<Order, RepositoryError>>;

  atomicReserveAndSave(
    order: Order,
    stockItems: readonly StockReservationItem[]
  ): Promise<Result<Order, ProductNotFoundError | ProductOutOfStockError | RepositoryError>>;
}

export const ORDER_REPOSITORY = Symbol("ORDER_REPOSITORY");
