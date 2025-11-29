import React from "react";
import { Button, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { HomeOutlined } from "@ant-design/icons";
import "./NotFound.css";

const { Title, Text } = Typography;

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="not-found-container">
      <div className="not-found-decoration">
        <div className="circle circle-1" />
        <div className="circle circle-2" />
        <div className="circle circle-3" />
      </div>

      <div className="not-found-content">
        <h1 className="not-found-title">404</h1>
        <Title level={2} style={{ marginBottom: 16, color: "#1f1f1f" }}>
          Not Found
        </Title>
        <Text
          type="secondary"
          style={{ fontSize: 16, display: "block", marginBottom: 40 }}
        >
          对不起，您访问的页面不存在或已被移除。
        </Text>
        <Button
          type="primary"
          size="large"
          icon={<HomeOutlined />}
          onClick={() => navigate("/dashboard")}
          shape="round"
          style={{
            minWidth: 160,
            height: 48,
            fontSize: 16,
            background: "linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)",
            border: "none",
            boxShadow: "0 4px 15px rgba(24, 144, 255, 0.3)",
          }}
        >
          返回首页
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
