/**
 * @rebarconfig/codepacks — pluggable code packs behind the core `CodePack` interface.
 * v1.0 ships BAEL-FR (P1, default) + EC2 (P4a) behind the SAME `code.*` names. Selecting a
 * pack swaps the implementation only — nothing else (spec §7.11; tests/pack_swap.spec.ts).
 *
 * Both packs export a `PackExtras` type of the same shape; re-export selectively (named, not
 * `export *`) so the two don't collide.
 */
export { makeBaelPack } from "./bael/index";
export type { BaelPack, PackExtras as BaelPackExtras } from "./bael/index";
export { makeEc2Pack } from "./ec2/index";
export type { Ec2Pack, PackExtras as Ec2PackExtras } from "./ec2/index";
// P4b — RPS 2000/2011 seismic overlay (composes on either pack, §7.10)
export { makeRpsOverlay } from "./seismic/index";
