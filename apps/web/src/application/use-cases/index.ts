export type {
  GetProductsInput,
  GetProductsOutput,
} from "./get-products.use-case";
export { getProductsUseCase } from "./get-products.use-case";

export type {
  GetProductDetailInput,
  GetProductDetailOutput,
} from "./get-product-detail.use-case";
export { getProductDetailUseCase } from "./get-product-detail.use-case";

export type {
  AddToCartInput,
  AddToCartOutput,
  RemoveFromCartInput,
  RemoveFromCartOutput,
} from "./add-to-cart.use-case";
export {
  addToCartUseCase,
  removeFromCartUseCase,
} from "./add-to-cart.use-case";
