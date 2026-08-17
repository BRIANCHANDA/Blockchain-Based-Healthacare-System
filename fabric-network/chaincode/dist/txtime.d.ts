import { Context } from 'fabric-contract-api';
/**
 * Milliseconds since the Unix epoch for the current transaction.
 * Identical on every endorsing peer.
 */
export declare function txTimeMillis(ctx: Context): number;
/** ISO-8601 string for the current transaction time. Safe to write to the ledger. */
export declare function txTimeISO(ctx: Context): string;
