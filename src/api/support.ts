import { api } from './client';

export type SupportRole = 'user' | 'developer' | 'admin';

export type Ticket = {
    TICKET_ID: number;
    SUBJECT: string;
    REQUESTER_NAME: string;
    REQUESTER_LOGINID: string;
    COMPANY_CODE: string;
    TENANT_ID: string;
    MODULE_NAME: string;
    PAGE_URL: string;
    STATUS: string;
    PRIORITY: string;
    LAST_MESSAGE: string;
    LAST_MESSAGE_AT: string;
    CREATED_AT: string;
    DUE_AT?: string;
    DEVELOPER_LOGINID?: string;
    DEVELOPER_NAME?: string;
    DEV_STATUS?: string;
    UNREAD_COUNT: number;
    RESOLUTION?: string;
    SLA_MINUTES?: number;
};

export type Attachment = {
    ATTACHMENT_ID: number;
    FILE_NAME: string;
    FILE_TYPE: string;
    FILE_SIZE: number;
};

export type Message = {
    MESSAGE_ID: number;
    SENDER_LOGINID: string;
    SENDER_NAME: string;
    SENDER_ROLE: string;
    SENDER_TENANT_ID: string;
    SENDER_COMPANY_CODE: string;
    MESSAGE_TEXT: string;
    IS_DELETED?: string;
    CREATED_AT: string;
    attachments: Attachment[];
};

export type Upload = {
    file_name: string;
    file_type: string;
    file_size: number;
    data_url: string;
};

async function data<T>(request: Promise<any>): Promise<T> {
    const r = await request;
    if (!r.data.success)
        throw Error(r.data.message || 'Support request failed');
    return r.data.data;
}

export const supportApi = {
    context: () => data<{
        role: SupportRole;
    }>(api.get('/api/support/context')),
    tickets: (role: SupportRole) => data<Ticket[]>(api.get('/api/support/tickets', { params: { role } })),
    messages: (id: number) => data<Message[]>(api.get(`/api/support/tickets/${id}/messages`)),
    create: (body: any) => data<{
        ticketId: number;
    }>(api.post('/api/support/tickets', body)),
    reply: (id: number, body: any) => data(api.post(`/api/support/tickets/${id}/messages`, body)),
    read: (id: number, mid: number) => data(api.post(`/api/support/tickets/${id}/read`, { last_message_id: mid })),
    update: (id: number, body: any) => data(api.patch(`/api/support/tickets/${id}`, body)),
    progress: (id: number, status: string) => data(api.patch(`/api/support/tickets/${id}/developer-status`, { dev_status: status })),
    assign: (id: number, body: any) => data(api.post(`/api/support/tickets/${id}/assign-developer`, body)),
    developers: () => data<any[]>(api.get('/api/support/developers')),
    candidateDevelopers: () => data<any[]>(api.get('/api/support/candidate-developers')),
    developer: (body: any) => data(api.post('/api/support/developers', body)),
    sendReminder: (id: number) => data(api.post(`/api/support/tickets/${id}/reminder`)),
    events: (id: number) => data<any[]>(api.get(`/api/support/tickets/${id}/events`)),
    settings: () => data<{
        contacts: any[];
        queue: any[];
    }>(api.get('/api/support/settings')),
    contact: (body: any) => data(api.post('/api/support/settings/contacts', body)),
    liveChat: (sessionKey: string) => data<any[]>(api.get('/api/support/live-chat', { params: { sessionKey } })),
    sendLiveChat: (body: { sessionKey: string; message: string; pageUrl: string }) => data(api.post('/api/support/live-chat', body)),
    attachment: async (id: number, aid: number) => {
        try {
            return await api.get(`/api/support/tickets/${id}/attachments/${aid}`, { responseType: 'blob' });
        }
        catch (error: any) {
            if (error.response?.data instanceof Blob) {
                const body = await error.response.data.text();
                let message = 'Unable to download attachment. Please retry.';
                try {
                    message = JSON.parse(body).message || message;
                }
                catch {
                    /* Non-JSON gateway response. */
                }
                throw new Error(message);
            }
            throw error;
        }
    },
    heartbeat: () => api.post('/api/support/heartbeat'),
};

export function playSupportNotificationSound() {
    try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.33);
    } catch {
        // audio might be blocked before first user gesture
    }
}

export function supportMessage(e: any) {
    return e?.response?.data?.message || e?.message || 'Unable to complete this action. Please retry.';
}
