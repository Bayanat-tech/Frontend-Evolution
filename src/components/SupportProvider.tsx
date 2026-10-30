import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../state/AuthContext';
import { api } from '../api/client';
import { supportApi, type SupportRole } from '../api/support';
import { useToast } from './ui/AlertToast';
import type { MenuNode } from '../types/auth';
const Context = createContext<{
    role: SupportRole;
    ready: boolean;
    unread: number;
}>({ role: 'user', ready: false, unread: 0 });
export const useSupport = () => useContext(Context);
export function SupportProvider({ children }: {
    children: ReactNode;
}) {
    const { toast } = useToast();
    const [unread, setUnread] = useState(0);
    const { user } = useAuth();
    const [state, setState] = useState<{
        role: SupportRole;
        ready: boolean;
    }>({ role: 'user', ready: false });
    useEffect(() => {
        setUnread(0);
        setState({ role: 'user', ready: false });
        if (!user)
            return;
        let active = true;
        const load = () => supportApi.context().then(r => { if (active) {
            setState({ role: r.role, ready: true });
            void supportApi.tickets(r.role).then(t => { if (active)
                setUnread(t.reduce((n, x) => n + Number(x.UNREAD_COUNT || 0), 0)); }).catch(() => undefined);
        } }).catch(() => { if (active)
            setState({ role: 'user', ready: false }); });
        void load();
        const beat = () => { if (document.visibilityState === 'visible')
            void supportApi.heartbeat().catch(() => undefined); };
        beat();
        const token = localStorage.getItem('bayanat_service_token');
        const socket = io(api.defaults.baseURL, { auth: { token }, transports: ['websocket', 'polling'] });
        socket.on('support:ready', () => void load());
        socket.on('support:tickets-changed', payload => { window.dispatchEvent(new Event('support:updated')); void load(); if (payload?.actorLoginid && String(payload.actorLoginid).toUpperCase() !== user.loginid?.toUpperCase())
            toast.info(`Support ticket #${payload.ticketId} has a new update.`); });
        const read = () => void load();
        window.addEventListener('support:read', read);
        socket.on('support:typing', payload => window.dispatchEvent(new CustomEvent('support:typing-updated', { detail: payload })));
        const typing = (event: Event) => socket.emit('support:typing', (event as CustomEvent).detail);
        window.addEventListener('support:typing-request', typing);
        const timer = window.setInterval(() => { beat(); void load(); }, 30000);
        document.addEventListener('visibilitychange', beat);
        return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', beat); window.removeEventListener('support:typing-request', typing); window.removeEventListener('support:read', read); socket.disconnect(); };
    }, [user?.loginid, user?.tenantId, user?.company_code]);
    return <Context.Provider value={{ ...state, unread }}>{children}</Context.Provider>;
}
