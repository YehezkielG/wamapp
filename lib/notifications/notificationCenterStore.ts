import { create } from 'zustand';
import { createSupabaseClientForDevice } from '../supabaseClient';
import { getCurrentDeviceId } from '../explore/markedLocationsService';

export type NotificationCenterItem = {
  id: string;
  title: string;
  message: string;
  category: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

type NotificationCenterStore = {
  notifications: NotificationCenterItem[];
  isLoading: boolean;
  errorMessage: string | null;
  lastLoadedAt: string | null;
  loadNotifications: () => Promise<void>;
  clearNotifications: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markNotificationUnread: (notificationId: string) => Promise<void>;
  markNotificationsRead: (notificationIds?: string[]) => Promise<void>;
};

async function getDeviceClient() {
  const deviceId = await getCurrentDeviceId().catch(() => null);
  if (!deviceId) return null;

  return {
    deviceId,
    client: createSupabaseClientForDevice(deviceId),
  };
}

export const useNotificationCenterStore = create<NotificationCenterStore>((set, get) => ({
  notifications: [],
  isLoading: false,
  errorMessage: null,
  lastLoadedAt: null,

  loadNotifications: async () => {
    set({ isLoading: true, errorMessage: null });

    try {
      const device = await getDeviceClient();
      if (!device) {
        set({ notifications: [], lastLoadedAt: new Date().toISOString() });
        return;
      }

      const { data, error } = await device.client
        .from('notifications')
        .select('id,title,message,category,data,is_read,created_at')
        .eq('device_id', device.deviceId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      set({
        notifications: (data ?? []) as NotificationCenterItem[],
        lastLoadedAt: new Date().toISOString(),
      });
    } catch (error) {
      set({
        errorMessage: error instanceof Error ? error.message : 'Failed to load notifications.',
        notifications: [],
      });
    } finally {
      set({ isLoading: false });
    }
  },

  clearNotifications: async () => {
    const device = await getDeviceClient();
    if (!device) return;

    const previousNotifications = get().notifications;

    set({ notifications: [] });

    const { error } = await device.client
      .from('notifications')
      .delete()
      .eq('device_id', device.deviceId);

    if (error) {
      set({ notifications: previousNotifications });
      throw new Error(`Failed to clear notifications: ${error.message}`);
    }
  },

  deleteNotification: async (notificationId: string) => {
    const device = await getDeviceClient();
    if (!device) return;

    const { error } = await device.client
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('device_id', device.deviceId);

    if (error) {
      throw new Error(`Failed to delete notification: ${error.message}`);
    }

    set((state) => ({
      notifications: state.notifications.filter((item) => item.id !== notificationId),
    }));
  },

  markNotificationRead: async (notificationId: string) => {
    const device = await getDeviceClient();
    if (!device) return;

    const { error } = await device.client
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('device_id', device.deviceId);

    if (error) {
      throw new Error(`Failed to update notification state: ${error.message}`);
    }

    set((state) => ({
      notifications: state.notifications.map((item) =>
        item.id === notificationId ? { ...item, is_read: true } : item
      ),
    }));
  },

  markNotificationUnread: async (notificationId: string) => {
    const device = await getDeviceClient();
    if (!device) return;

    const { error } = await device.client
      .from('notifications')
      .update({ is_read: false })
      .eq('id', notificationId)
      .eq('device_id', device.deviceId);

    if (error) {
      throw new Error(`Failed to update notification state: ${error.message}`);
    }

    set((state) => ({
      notifications: state.notifications.map((item) =>
        item.id === notificationId ? { ...item, is_read: false } : item
      ),
    }));
  },

  markNotificationsRead: async (notificationIds) => {
    const targetIds = notificationIds ?? get().notifications.filter((item) => !item.is_read).map((item) => item.id);
    if (!targetIds.length) return;

    const device = await getDeviceClient();
    if (!device) return;

    const { error } = await device.client
      .from('notifications')
      .update({ is_read: true })
      .in('id', targetIds)
      .eq('device_id', device.deviceId);

    if (error) {
      throw new Error(`Failed to mark notifications as read: ${error.message}`);
    }

    set((state) => ({
      notifications: state.notifications.map((item) =>
        targetIds.includes(item.id) ? { ...item, is_read: true } : item
      ),
    }));
  },
}));