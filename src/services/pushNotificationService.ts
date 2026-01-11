import { supabase } from "@/integrations/supabase/client";

export interface NotificationData {
    title: string;
    body: string;
    url?: string;
    tag?: string;
}

// Check if notifications are supported
export const isNotificationSupported = (): boolean => {
    return 'Notification' in window && 'serviceWorker' in navigator;
};

// Get current permission status
export const getNotificationPermission = (): NotificationPermission | 'unsupported' => {
    if (!isNotificationSupported()) return 'unsupported';
    return Notification.permission;
};

// Request notification permission
export const requestNotificationPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
    if (!isNotificationSupported()) return 'unsupported';

    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            await registerServiceWorker();
        }
        return permission;
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        return 'denied';
    }
};

// Register service worker
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
    if (!('serviceWorker' in navigator)) return null;

    try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        console.log('Service Worker registered:', registration);
        return registration;
    } catch (error) {
        console.error('Service Worker registration failed:', error);
        return null;
    }
};

// Show local notification
export const showNotification = async (data: NotificationData): Promise<boolean> => {
    if (!isNotificationSupported()) return false;
    if (Notification.permission !== 'granted') return false;

    try {
        const registration = await navigator.serviceWorker.ready;

        await registration.showNotification(data.title, {
            body: data.body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: data.tag || 'default',
            data: { url: data.url || '/tasks' },
            requireInteraction: true,
            dir: 'rtl',
            lang: 'ar'
        });

        return true;
    } catch (error) {
        console.error('Error showing notification:', error);
        return false;
    }
};

// Subscribe to task notifications via Supabase Realtime
export const subscribeToTaskNotifications = (userId: string, onNotification: (payload: any) => void) => {
    const channel = supabase
        .channel('task-notifications')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'employee_tasks',
                filter: `assigned_to=eq.${userId}`
            },
            async (payload) => {
                // Show browser notification
                await showNotification({
                    title: 'مهمة جديدة 📋',
                    body: payload.new.title || 'تم تعيين مهمة جديدة لك',
                    url: '/tasks',
                    tag: `task-${payload.new.id}`
                });

                // Call the callback
                onNotification(payload);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

// Initialize push notifications on app load
export const initializePushNotifications = async (): Promise<void> => {
    if (!isNotificationSupported()) {
        console.log('Push notifications not supported');
        return;
    }

    // Register service worker if not already registered
    if (Notification.permission === 'granted') {
        await registerServiceWorker();
    }
};
