// @effect/rpc@0.69.5 imports { Msgpackr } from "@effect/platform/MsgPack",
// but @effect/platform@0.92.1 no longer re-exports it. This stub satisfies
// webpack's static named-export analysis; the Msgpackr code path is dead
// in this app (we don't use msgpack RPC serialization).
export const Msgpackr = undefined;
