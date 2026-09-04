/**
 * In-memory stub of the Hyperledger Fabric Context, shared by every chaincode
 * test in this directory.
 *
 * Why a stub rather than a running network: the contracts are pure logic over
 * world state and client identity. Standing up peers, an orderer and a CA to
 * exercise that logic would make the suite slow, flaky and impossible to run in
 * CI — while testing Fabric rather than this project's contracts. The stub
 * implements exactly the surface the contracts touch, and nothing else.
 *
 * Fidelity notes — the places where getting the stub wrong would make tests
 * pass against behaviour the real network does not have:
 *
 *   getTxTimestamp  returns an object with getSeconds()/getNanos() METHODS, not
 *                   plain fields. fabric-shim 2.5 builds it with google-protobuf,
 *                   and src/txtime.ts exists precisely because of that shape.
 *   getState        returns an EMPTY Uint8Array for a missing key, never null —
 *                   which is why contracts test `.length` rather than truthiness.
 *   composite keys  are `objectType\u0000attr1\u0000attr2...`, and a partial
 *                   query matches on that prefix.
 *   transaction time is fixed for the life of one context, as it is on a real
 *                   peer: every peer endorsing a proposal sees the same value.
 */

/** One entry in a key's history, as getHistoryForKey yields it. */
type HistoryEntry = { txId: string; timestamp: string; isDelete: boolean; value: Uint8Array };

export type StubbedCtx = {
  ctx: any;
  /** The world state, for asserting on what a contract wrote. */
  state: Map<string, Uint8Array>;
  /** Events emitted via setEvent, decoded. */
  events: { name: string; payload: any }[];
  /** The fixed transaction time this context reports, in milliseconds. */
  nowMs: number;
};

export const HOUR = 60 * 60 * 1000;
export const NUL = "\u0000";

let txCounter = 0;

export function makeCtx(opts: {
  /** Organisation the caller belongs to. Defaults to PatientOrgMSP. */
  mspId?: string;
  /** Value of the `patientId` certificate attribute; null means absent. */
  patientAttr?: string | null;
  /** Full client identity string. Audit checks use substring matching on it. */
  clientId?: string;
  /** Fixed transaction time. */
  nowMs?: number;
  /** Pre-existing world state, to simulate a later transaction on the same ledger. */
  state?: Map<string, Uint8Array>;
  /** Pre-existing key history, keyed by state key. */
  history?: Map<string, HistoryEntry[]>;
} = {}): StubbedCtx {
  const state = opts.state ?? new Map<string, Uint8Array>();
  const history = opts.history ?? new Map<string, HistoryEntry[]>();
  const events: { name: string; payload: any }[] = [];
  const nowMs = opts.nowMs ?? Date.parse("2026-09-03T10:00:00.000Z");
  const txId = `tx-${++txCounter}`;

  /** Fabric's iterator protocol: next() until done, then close(). */
  const makeIterator = (entries: { key: string; value: Uint8Array }[]) => {
    let i = 0;
    return {
      next: async () => {
        if (i >= entries.length) return { done: true, value: undefined as any };
        const e = entries[i++];
        return { done: false, value: { key: e.key, value: e.value } };
      },
      close: async () => {},
    };
  };

  const ctx: any = {
    stub: {
      getTxID: () => txId,

      // Methods, not fields — see the fidelity note above.
      getTxTimestamp: () => ({
        getSeconds: () => Math.floor(nowMs / 1000),
        getNanos: () => (nowMs % 1000) * 1_000_000,
      }),

      // Fabric returns an empty buffer for an absent key, not null.
      getState: async (k: string) => state.get(k) ?? new Uint8Array(),

      putState: async (k: string, v: Uint8Array) => {
        const prev = history.get(k) ?? [];
        prev.push({
          txId,
          timestamp: new Date(nowMs).toISOString(),
          isDelete: false,
          value: v,
        });
        history.set(k, prev);
        state.set(k, v);
      },

      deleteState: async (k: string) => {
        const prev = history.get(k) ?? [];
        prev.push({ txId, timestamp: new Date(nowMs).toISOString(), isDelete: true, value: new Uint8Array() });
        history.set(k, prev);
        state.delete(k);
      },

      createCompositeKey: (objectType: string, attrs: string[]) =>
        `${objectType}${NUL}${attrs.join(NUL)}${NUL}`,

      // Prefix match on the composite key, as the real implementation does.
      getStateByPartialCompositeKey: async (objectType: string, attrs: string[]) => {
        const prefix = `${objectType}${NUL}${attrs.join(NUL)}`;
        const hits = [...state.entries()]
          .filter(([k]) => k.startsWith(prefix))
          .map(([key, value]) => ({ key, value }));
        return makeIterator(hits);
      },

      // Newest first, matching Fabric's ordering.
      getHistoryForKey: async (k: string) => {
        const entries = [...(history.get(k) ?? [])].reverse();
        return {
          next: async () => {
            const e = entries.shift();
            return e ? { done: false, value: e } : { done: true, value: undefined as any };
          },
          close: async () => {},
        };
      },

      getStateByRange: async (start: string, end: string) => {
        const hits = [...state.entries()]
          .filter(([k]) => k >= start && (end === "" || k < end))
          .map(([key, value]) => ({ key, value }));
        return makeIterator(hits);
      },

      setEvent: (name: string, payload: Uint8Array) => {
        events.push({ name, payload: JSON.parse(Buffer.from(payload).toString()) });
      },
    },

    clientIdentity: {
      getID: () => opts.clientId ?? "x509::/CN=test",
      getMSPID: () => opts.mspId ?? "PatientOrgMSP",
      getAttributeValue: (_a: string) =>
        opts.patientAttr === undefined ? null : opts.patientAttr,
    },
  };

  return { ctx, state, events, nowMs };
}

/** Parse a JSON value out of the stubbed world state. */
export function readState<T = any>(state: Map<string, Uint8Array>, key: string): T | null {
  const raw = state.get(key);
  return raw && raw.length ? (JSON.parse(Buffer.from(raw).toString()) as T) : null;
}
