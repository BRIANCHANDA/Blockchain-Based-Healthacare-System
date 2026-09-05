import client from './client';

// ── Who has access to my records ──────────────────────────
// GET /permissions/mine
export const getMyPermissions = async () => {
    const res = await client.get('/permissions/mine');
    return res.data; // { success, data: { permissions: [], blockchainPermissions: [] } }
};

// ── Grant access ──────────────────────────────────────────
// POST /permissions/grant
export const grantAccess = async (payload: {
    practitionerId: string;
    durationHours: number;
    permissionType?: 'read' | 'write' | 'full';
    allowedRecordTypes?: string[];
}) => {
    const res = await client.post('/permissions/grant', {
        permissionType: 'read',
        allowedRecordTypes: ['all'],
        ...payload,
    });
    return res.data; // { success, data: { message, expiresAt, blockchainTxId } }
};

// ── Revoke access ─────────────────────────────────────────
// POST /permissions/revoke
export const revokeAccess = async (practitionerId: string) => {
    const res = await client.post('/permissions/revoke', { practitionerId });
    return res.data; // { success, data: { message } }
};

// ── Pending access requests from clinical staff ───────────
// GET /permissions/requests  (you may need to add this endpoint if not present)
// For now we read from accessRequests table via a dedicated route.
// We'll check what's available and add a stub:
export const getAccessRequests = async () => {
    const res = await client.get('/permissions/requests');
    return res.data;
};

// ── Approve an access request ─────────────────────────────
// POST /permissions/requests/:requestId/approve
export const approveAccessRequest = async (requestId: string, durationHours = 24) => {
    const res = await client.post(`/permissions/requests/${requestId}/approve`, {
        durationHours,
    });
    return res.data;
};

// ── Reject an access request ──────────────────────────────
// POST /permissions/requests/:requestId/reject
export const rejectAccessRequest = async (requestId: string) => {
    const res = await client.post(`/permissions/requests/${requestId}/reject`);
    return res.data;
};

// ── Audit log — who accessed my records & when ────────────
// GET /audit/my-log
export const getMyAuditLog = async () => {
    const res = await client.get('/audit/my-log');
    return res.data; // { success, data: { dbLogs, blockchainLogs } }
};
// ── Push device registration ──────────────────────────────
// POST /notifications/register-device
//
// Registers this install's Expo push token so the backend can reach the phone
// when it is closed. Called on every launch while signed in: Expo reissues the
// token on reinstall or device restore, and the endpoint upserts rather than
// duplicating.
export const registerPushToken = async (token: string, platform?: 'ios' | 'android') => {
    const res = await client.post('/notifications/register-device', { token, platform });
    return res.data;
};

// ── Push device de-registration ───────────────────────────
// DELETE /notifications/register-device
//
// Called on sign-out. Without it the handset keeps receiving the previous
// user's consent requests — one patient being notified about another patient's
// records.
export const unregisterPushToken = async (token: string) => {
    const res = await client.delete('/notifications/register-device', { data: { token } });
    return res.data;
};
