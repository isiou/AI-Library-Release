import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Layout, Card, theme, Spin } from "antd";
import { BookOutlined } from "@ant-design/icons";

const { Content } = Layout;

const AuthLayout = () => {
  const { token } = theme.useToken();

  return (
    <Layout
      style={{
        minHeight: "100vh",
        background: `linear-gradient(135deg, ${token.colorPrimary}15 0%, ${token.colorPrimary}25 100%)`,
      }}
    >
      <Content
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <Card
          style={{
            width: "100%",
            maxWidth: 420,
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
            borderRadius: 12,
            minHeight: 560,
            margin: "0 12px",
          }}
          styles={{ body: { padding: 24 } }}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: 32,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${token.colorPrimary} 0%, ${token.colorPrimaryActive} 100%)`,
                marginBottom: 16,
              }}
            >
              <BookOutlined style={{ fontSize: 32, color: "white" }} />
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 600,
                color: token.colorText,
              }}
            >
              AI 智能图书馆
            </h1>
            <p
              style={{
                margin: "8px 0 0 0",
                color: token.colorTextSecondary,
                fontSize: 14,
              }}
            >
              智能推荐 · 高效管理 · 便捷借阅
            </p>
          </div>

          <Suspense
            fallback={
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "350px",
                }}
              >
                <Spin size="large" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </Card>
      </Content>
    </Layout>
  );
};

export default AuthLayout;
