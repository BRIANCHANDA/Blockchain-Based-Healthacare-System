import { randomUUID } from 'node:crypto';

type Stream = { write: (data: string) => void; close: () => void };
const connections = new Map<string, Set<Stream>>();
const institutions = new Map<Stream, string | null>();

function discard(userId: string, stream: Stream) {
  try { stream.close(); } catch { /* Already closed or failed transport. */ }
  institutions.delete(stream);
  connections.get(userId)?.delete(stream);
  if (!connections.get(userId)?.size) connections.delete(userId);
}

export function addConnection(userId: string, stream: Stream, institutionId: string | null = null) {
  if (!connections.has(userId)) connections.set(userId, new Set());
  connections.get(userId)!.add(stream);
  institutions.set(stream, institutionId);
  return () => {
    institutions.delete(stream);
    connections.get(userId)?.delete(stream);
    if (!connections.get(userId)?.size) connections.delete(userId);
  };
}

export function notifyUser(userId: string, event: string, data: object) {
  const streams = connections.get(userId);
  if (!streams) return;
  const payload = JSON.stringify({ ...data, notificationId: randomUUID() });
  for (const stream of streams) {
    try { stream.write(`event: ${event}\ndata: ${payload}\n\n`); }
    catch { discard(userId, stream); }
  }
}

// An invalidation contains no identifiers or clinical data. Only sockets at the
// changed institution (and the acting user) are prompted to re-query.
export function notifyDataChanged(institutionId: string | null, userId: string) {
  for (const [recipient, streams] of connections) {
    for (const stream of streams) {
      if (recipient !== userId && (!institutionId || institutions.get(stream) !== institutionId)) continue;
      try { stream.write('event: data_changed\ndata: {}\n\n'); }
      catch { discard(recipient, stream); }
    }
  }
}

export function activeConnectionCount() {
  return [...connections.values()].reduce((count, streams) => count + streams.size, 0);
}
