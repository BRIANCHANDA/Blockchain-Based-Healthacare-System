// Keep HTTP expiry handling independent of the store/API import graph.
let expire: (token: string) => Promise<void> = async () => {};
export function onSessionExpired(handler: typeof expire) { expire = handler; }
export function expireSession(token: string) { return expire(token); }

// Serialize durable session writes, including expiry followed by a new login.
let pending: Promise<unknown> = Promise.resolve();
export function writeSession<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(operation, operation);
    pending = result.catch(() => {});
    return result;
}
