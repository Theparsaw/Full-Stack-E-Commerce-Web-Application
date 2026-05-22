<template>
  <div class="max-w-4xl mx-auto p-6">
    <h1 class="font-page-title mb-6">
      Notifications
    </h1>

    <div
      v-if="notificationStore.loading"
      class="rounded-2xl border border-dashed border-orange-100 bg-orange-50/60 px-5 py-6 text-gray-500"
    >
      Loading notifications...
    </div>

    <div
      v-else-if="notificationStore.notifications.length === 0"
      class="text-gray-500"
    >
      No notifications found.
    </div>

    <div v-else>
      <div
        v-for="notification in notificationStore.notifications"
        :key="notification._id"
        class="mb-4 rounded-2xl border p-4 shadow-sm"
        :class="notification.isRead ? 'border-gray-200 bg-white' : 'border-orange-200 bg-orange-50/60'"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span
                v-if="!notification.isRead"
                class="h-2 w-2 rounded-full bg-orange-500"
              />

              <p class="font-semibold text-gray-900">
                {{ getNotificationTitle(notification) }}
              </p>

              <span class="rounded-full bg-white px-2 py-1 text-xs font-medium text-orange-600 ring-1 ring-orange-100">
                -{{ notification.discountPercentage }}%
              </span>
            </div>

            <p class="text-gray-600 mt-1">
              {{ notification.message }}
            </p>

            <p class="font-notification-timestamp text-gray-400 mt-2">
              {{ formatNotificationTimestamp(notification.createdAt) }}
            </p>
          </div>
          <button
            v-if="!notification.isRead"
            type="button"
            @click="notificationStore.markAsRead(notification._id)"
            class="relative z-50 pointer-events-auto rounded-xl bg-orange-500 px-3 py-2 text-sm text-white hover:bg-orange-600"
          >
            Mark as read
          </button>
          <span
            v-else
            class="text-sm text-green-600 font-medium"
          >
            Read
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import { notificationStore } from "../store/notificationStore";

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const getNotificationTitle = (notification) =>
  notification?.productName || "Discount alert";

const formatNotificationTimestamp = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const minutes = Math.round((date.getTime() - Date.now()) / 60000);

  if (Math.abs(minutes) < 60) {
    return relativeTimeFormatter.format(minutes, "minute");
  }

  const hours = Math.round(minutes / 60);

  if (Math.abs(hours) < 24) {
    return relativeTimeFormatter.format(hours, "hour");
  }

  const days = Math.round(hours / 24);

  if (Math.abs(days) < 7) {
    return relativeTimeFormatter.format(days, "day");
  }

  return date.toLocaleString();
};

onMounted(() => {
  notificationStore.loadNotifications();
});
</script>
