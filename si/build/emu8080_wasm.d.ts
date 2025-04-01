/* tslint:disable */
/* eslint-disable */
export class Emu {
  private constructor();
  free(): void;
  static new(): Emu;
  read_prog(filename: string, offset: number): void;
  load_prog(buf: Uint8Array, offset: number): void;
  get_framebuf(): Uint32Array;
  try_fire_interrupt(n: number): void;
  run_cycles(n: number): void;
  coin_switch(val: boolean): void;
  p1start(val: boolean): void;
  p1left(val: boolean): void;
  p1right(val: boolean): void;
  p1shot(val: boolean): void;
  step(): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_emu_free: (a: number, b: number) => void;
  readonly emu_new: () => number;
  readonly emu_read_prog: (a: number, b: number, c: number, d: number) => void;
  readonly emu_load_prog: (a: number, b: number, c: number, d: number) => void;
  readonly emu_get_framebuf: (a: number) => [number, number];
  readonly emu_try_fire_interrupt: (a: number, b: number) => void;
  readonly emu_run_cycles: (a: number, b: number) => void;
  readonly emu_coin_switch: (a: number, b: number) => void;
  readonly emu_p1start: (a: number, b: number) => void;
  readonly emu_p1left: (a: number, b: number) => void;
  readonly emu_p1right: (a: number, b: number) => void;
  readonly emu_p1shot: (a: number, b: number) => void;
  readonly emu_step: (a: number) => number;
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
