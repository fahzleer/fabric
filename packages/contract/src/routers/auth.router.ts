export type RegisterInput = {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
};

export type RegisterOutput = {
  readonly userId: string;
};

export type LoginInput = {
  readonly email: string;
  readonly password: string;
};

export type LoginOutput = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
};

export type RefreshInput = {
  readonly refreshToken: string;
};

export type RefreshOutput = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
};

export type LogoutInput = {
  readonly refreshToken: string;
};
