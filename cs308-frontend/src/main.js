import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";

import { authStore } from "./store/auth";
import { notificationStore } from "./store/notificationStore";

import "./style.css";
import "./styles/fonts.css";

if (
  authStore.isLoggedIn &&
  authStore.role === "customer"
) {
  notificationStore.loadNotifications();
}

createApp(App)
  .use(router)
  .mount("#app");
