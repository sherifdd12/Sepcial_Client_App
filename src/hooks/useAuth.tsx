import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

export interface UserWithRoles extends User {
    roles: string[];
}

interface AuthContextType {
    session: Session | null;
    user: UserWithRoles | null;
    signOut: () => void;
    isLoading: boolean;
    hasRole: (role: string) => boolean;
    isReadOnly: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<UserWithRoles | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const fetchUserRoles = async (userId: string) => {
            try {
                const { data: roles, error } = await supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', userId);
                if (error) throw error;
                return roles?.map(r => r.role) || [];
            } catch (error) {
                console.error("Error fetching user roles:", error);
                return [];
            }
        };

        const handleAuthChange = async (newSession: Session | null) => {
            if (!mounted) return;

            if (newSession?.user) {
                const roles = await fetchUserRoles(newSession.user.id);
                if (mounted) {
                    setUser({ ...newSession.user, roles });
                    setSession(newSession);
                    setIsLoading(false);
                }
            } else {
                if (mounted) {
                    setUser(null);
                    setSession(null);
                    setIsLoading(false);
                }
            }
        };

        // Initialize auth state
        const initialize = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            await handleAuthChange(session);
        };

        initialize();

        // Listen for auth changes
        const { data: authListener } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (event === 'SIGNED_OUT') {
                    if (mounted) {
                        setUser(null);
                        setSession(null);
                        setIsLoading(false);
                    }
                } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
                    if (event === 'SIGNED_IN' && session?.user) {
                        // Log the login event - non-blocking and with error handling
                        const logLogin = async () => {
                            try {
                                await (supabase as any).rpc('log_user_login', {
                                    p_user_id: session.user.id,
                                    p_user_agent: window.navigator.userAgent
                                });
                            } catch (err) {
                                console.error("Error logging login:", err);
                            }
                        };
                        logLogin();
                    }
                    handleAuthChange(session);
                }
            }
        );

        return () => {
            mounted = false;
            authListener.subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
    };

    const hasRole = (role: string) => {
        return user?.roles.includes(role) ?? false;
    };

    const isReadOnly = user?.roles.some(role => ['temporary_user', 'limited_user'].includes(role)) ?? false;

    const value = {
        session,
        user,
        signOut,
        isLoading,
        hasRole,
        isReadOnly,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
