import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import { Result, Button } from "antd";
import { HomeOutlined } from "@ant-design/icons";
import useAuthStore from "../stores/authStore";

const AdminRoute = () => {
  const { isAdmin } = useAuthStore();

  // 检查是否为管理员
  if (!isAdmin()) {
    return (
      <Result
        status="403"
        title="403"
        subTitle="抱歉，您没有权限访问此页面"
        extra={
          <Button type="primary" icon={<HomeOutlined />} href="/dashboard">
            返回首页
          </Button>
        }
      />
    );
  }

  return <Outlet />;
};

export default AdminRoute;
