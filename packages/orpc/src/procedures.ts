import { os, type Context, ORPCError } from "@orpc/server";
import { type AuthedFields, isAuthed } from "./context";

export { ORPCError };
export { os };

export const createPub = <T extends Context>() => os.$context<T>();

export const createAuthed = <T extends Context>(pub: ReturnType<typeof os.$context<T>>) =>
  pub.use(({ context, next }) => {
    if (!isAuthed(context)) {
      throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
    }
    return next({ context: context as T & AuthedFields });
  });
