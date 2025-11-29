import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Spin } from "antd";
import useAuthStore from "../stores/authStore";

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, isLoading, initAuth, initialized } = useAuthStore();

  useEffect(() => {
    // 初始化认证状态
    if (!initialized) {
      initAuth();
    }
  }, [initialized, initAuth]);

  if (!initialized || isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  // 未认证则重定向到登录页
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
