// ── Customer domain events ────────────────────────────────────────────────────

export interface CustomerRegisteredEvent {
  readonly _type:     "customer.registered";
  readonly id:        string;
  readonly email:     string;
  readonly firstName: string;
  readonly lastName:  string;
  readonly createdAt: string;
}

export interface CustomerUpdatedEvent {
  readonly _type:      "customer.updated";
  readonly id:         string;
  readonly firstName?: string;
  readonly lastName?:  string;
  readonly phone?:     string;
  readonly updatedAt:  string;
}

export type CustomerEvent = CustomerRegisteredEvent | CustomerUpdatedEvent;
