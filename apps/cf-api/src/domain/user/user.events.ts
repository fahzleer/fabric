export type {
  AuthMethod,
  UserRegisteredPayload,
  UserRegistered,
  UserLoggedInPayload,
  UserLoggedIn,
  UserLoggedOutPayload,
  UserLoggedOut,
  UserLoginFailedPayload,
  UserLoginFailed,
  UserDomainEvent,
} from "@fabric/types";

export {
  makeUserRegistered,
  makeUserLoggedIn,
  makeUserLoggedOut,
  makeUserLoginFailed,
} from "@fabric/types";
