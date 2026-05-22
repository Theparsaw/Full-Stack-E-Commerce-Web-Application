import { reactive } from "vue";
import {
  getNotifications,
  markNotificationAsRead,
} from "../api/notificationApi";
import { authStore } from "./auth";

const AUTO_REFRESH_INTERVAL_MS = 30000;

let activeNotificationsRequest = null;
let refreshIntervalId = null;
let visibilityChangeHandler = null;
let pendingSilentRefresh = false;

const applyNotifications = (notifications = []) => {
  notificationStore.notifications = notifications;
  notificationStore.unreadCount = notifications.filter(
    (notification) => !notification.isRead
  ).length;
};

const isCustomerSessionActive = () =>
  authStore.isLoggedIn && authStore.role === "customer";

const flushPendingSilentRefresh = () => {
  if (!pendingSilentRefresh || !isCustomerSessionActive()) {
    pendingSilentRefresh = false;
    return;
  }

  pendingSilentRefresh = false;
  notificationStore.loadNotifications({
    silent: true,
    clearOnError: false,
  }).catch(() => {});
};

export const notificationStore = reactive({
  notifications: [],
  unreadCount: 0,
  loading: false,
  syncing: false,

  clear() {
    this.stopAutoRefresh();
    pendingSilentRefresh = false;
    applyNotifications([]);
    this.loading = false;
    this.syncing = false;
  },

  async loadNotifications(options = {}) {
    const {
      silent = false,
      clearOnError = !silent,
    } = options;

    if (!isCustomerSessionActive()) {
      this.clear();
      return [];
    }

    if (activeNotificationsRequest) {
      if (silent) {
        pendingSilentRefresh = true;
      } else if (this.notifications.length === 0) {
        this.loading = true;

        return activeNotificationsRequest.finally(() => {
          this.loading = false;
        });
      }

      return activeNotificationsRequest;
    }

    const requestToken = authStore.token;
    const requestUserId = authStore.user?.id ?? authStore.user?._id ?? null;

    if (silent) {
      this.syncing = true;
    } else {
      this.loading = true;
    }

    const request = getNotifications()
      .then((res) => {
        const hasSameSession =
          authStore.token === requestToken &&
          (authStore.user?.id ?? authStore.user?._id ?? null) === requestUserId &&
          isCustomerSessionActive();

        if (hasSameSession) {
          applyNotifications(res.data.notifications || []);
        }

        return res.data.notifications || [];
      })
      .catch((err) => {
        if (clearOnError) {
          applyNotifications([]);
        }

        console.error("Failed to load notifications", err);
        throw err;
      })
      .finally(() => {
        if (activeNotificationsRequest === request) {
          activeNotificationsRequest = null;
        }

        if (silent) {
          this.syncing = false;
        } else {
          this.loading = false;
        }

        flushPendingSilentRefresh();
      });

    activeNotificationsRequest = request;
    return request;
  },

  requestRefresh() {
    if (!isCustomerSessionActive()) {
      return Promise.resolve([]);
    }

    if (activeNotificationsRequest) {
      pendingSilentRefresh = true;
      return activeNotificationsRequest;
    }

    return this.loadNotifications({
      silent: true,
      clearOnError: false,
    });
  },

  startAutoRefresh(intervalMs = AUTO_REFRESH_INTERVAL_MS) {
    this.stopAutoRefresh();

    if (typeof window === "undefined") {
      return;
    }

    refreshIntervalId = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }

      this.requestRefresh().catch(() => {});
    }, intervalMs);

    if (typeof document !== "undefined") {
      visibilityChangeHandler = () => {
        if (!document.hidden) {
          this.requestRefresh().catch(() => {});
        }
      };

      document.addEventListener(
        "visibilitychange",
        visibilityChangeHandler
      );
    }
  },

  stopAutoRefresh() {
    if (refreshIntervalId !== null) {
      clearInterval(refreshIntervalId);
      refreshIntervalId = null;
    }

    if (
      visibilityChangeHandler &&
      typeof document !== "undefined"
    ) {
      document.removeEventListener(
        "visibilitychange",
        visibilityChangeHandler
      );
    }

    visibilityChangeHandler = null;
  },

  async markAsRead(notificationId) {
    try {
      await markNotificationAsRead(notificationId);

      const notif = this.notifications.find(
        (n) => n._id === notificationId
      );

      if (notif && !notif.isRead) {
        notif.isRead = true;
        this.unreadCount = Math.max(this.unreadCount - 1, 0);
      }

      this.requestRefresh().catch(() => {});
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  },
});
