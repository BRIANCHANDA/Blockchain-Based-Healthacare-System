/**
 * Chaincode entry point — the contracts Fabric instantiates on the channel.
 *
 * Fabric reads `exports.contracts` when the chaincode package starts, so a
 * contract that is not in this array is not deployed no matter what it defines.
 * The three below split by responsibility:
 *
 *   AccessControlContract — who may read a patient's records (consent)
 *   RecordContract        — hashes anchoring off-chain records (integrity)
 *   AuditContract         — an append-only log of accesses (accountability)
 *
 * They are separate contracts rather than one because they have different
 * callers and different rules about who may invoke them; keeping them apart
 * keeps each contract's authorisation check simple enough to reason about.
 */

import { AccessControlContract } from './accessControl';
import { AuditContract } from './audit';
import { RecordContract } from './record';

const contracts: any[] = [AccessControlContract, AuditContract, RecordContract];
exports.contracts = contracts;
