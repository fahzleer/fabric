import { Option } from "effect";

export interface ProductState {
  readonly productId: string;
  readonly ownerId: string;
  readonly name: string;
  readonly tagline: string;
  readonly price: number;
  readonly currency: string;
  readonly category: string;
  readonly status: string;
  readonly rev: number;
  readonly lastEventAt: string;
}

export interface ProductDelta {
  readonly productId: string;
  readonly ownerId: Option.Option<string>;
  readonly name: Option.Option<string>;
  readonly tagline: Option.Option<string>;
  readonly price: Option.Option<number>;
  readonly currency: Option.Option<string>;
  readonly category: Option.Option<string>;
  readonly status: Option.Option<string>;
  readonly rev: Option.Option<number>;
  readonly lastEventAt: Option.Option<string>;
}

export const applyDelta = (state: ProductState, delta: ProductDelta): ProductState => ({
  productId: state.productId,
  ownerId: Option.getOrElse(delta.ownerId, () => state.ownerId),
  name: Option.getOrElse(delta.name, () => state.name),
  tagline: Option.getOrElse(delta.tagline, () => state.tagline),
  price: Option.getOrElse(delta.price, () => state.price),
  currency: Option.getOrElse(delta.currency, () => state.currency),
  category: Option.getOrElse(delta.category, () => state.category),
  status: Option.getOrElse(delta.status, () => state.status),
  rev: Option.getOrElse(delta.rev, () => state.rev),
  lastEventAt: Option.getOrElse(delta.lastEventAt, () => state.lastEventAt),
});

export const emptyProduct = (productId: string): ProductState => ({
  productId,
  ownerId: "",
  name: "",
  tagline: "",
  price: 0,
  currency: "THB",
  category: "basic",
  status: "draft",
  rev: 0,
  lastEventAt: "",
});
