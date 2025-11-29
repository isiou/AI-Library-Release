import React, { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { ConfigProvider, App as AntdApp } from "antd";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import router from "./router";
import useAuthStore from "./stores/authStore";
import useAppStore from "./stores/appStore";
import "./App.css";

dayjs.locale("zh-cn");

function App() {
  const { initAuth } = useAuthStore();
  const { notifications, removeNotification } = useAppStore();
  const antdApp = AntdApp.useApp();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    notifications.forEach((notif) => {
      if (notif.type === "message") {
        antdApp.message[notif.level || "info"](notif.content);
      } else {
        antdApp.notification[notif.level || "info"]({
          message: notif.title,
          description: notif.content,
          duration: notif.duration,
          onClose: () => removeNotification(notif.id),
        });
      }
    });
  }, [notifications, removeNotification, antdApp]);

  const theme = {
    token: {
      colorPrimary: "#1890ff",
      borderRadius: 6,
    },
    components: {
      Layout: {
        headerBg: "#fff",
        siderBg: "#fff",
      },
      Menu: {
        itemBg: "transparent",
      },
    },
  };

  return (
    <ConfigProvider locale={zhCN} theme={theme}>
      <AntdApp>
        <RouterProvider router={router} />
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
