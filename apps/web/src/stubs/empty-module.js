// Universal no-op module stub. Aliased to every optional wallet SDK / RPC peer-dep
// that wagmi/connectors or @effect-atom/atom-react reference statically but that
// this app does not actually invoke. Every named import from this stub resolves
// to `undefined`, which is what the connector code expects when a feature is
// disabled. This silences webpack's "Module not found" warnings without
// pulling in real browser SDKs the user never clicks.
export default {};
