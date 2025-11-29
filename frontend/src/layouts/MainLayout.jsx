import React, { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Button,
  theme,
  Breadcrumb,
  Space,
  Badge,
  Tooltip,
} from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  BookOutlined,
  HistoryOutlined,
  BulbOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  BellOutlined,
  HomeOutlined,
  CloseOutlined,
  RobotOutlined,
  NotificationOutlined,
} from "@ant-design/icons";
import useAuthStore from "../stores/authStore";
import useAppStore from "../stores/appStore";
import { announcementAPI } from "../services/api";
import { Alert } from "antd";

const { Header, Sider, Content } = Layout;

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  const { user, logout, isAdmin } = useAuthStore();
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    notifications,
    breadcrumbs,
    pageTitle,
  } = useAppStore();

  const siderWidth = sidebarCollapsed ? 80 : 200;
  const getInitialIsMobile = () =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 768px)").matches
      : false;
  const [isMobile, setIsMobile] = useState(getInitialIsMobile);
  const [announcements, setAnnouncements] = useState([]);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState(new Set());

  // 监听视口宽度以判断是否为移动端
  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // 加载已读通知记录
  useEffect(() => {
    if (!user) {
      return;
    }
    const userId = user.readerId || user.id || user.username;
    const storageKey = `read_announcements_${userId}`;

    const loadReadAnnouncements = () => {
      try {
        const saved = localStorage.getItem(storageKey);
        setReadAnnouncementIds(saved ? new Set(JSON.parse(saved)) : new Set());
      } catch (error) {
        console.error("加载已读通知记录失败\n", error);
      }
    };

    loadReadAnnouncements();
  }, [user]);

  // 加载公告
  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        const data = await announcementAPI.getActive();
        setAnnouncements(data);
      } catch (error) {
        console.error("加载公告失败\n", error);
      }
    };
    loadAnnouncements();
  }, [location.pathname]);

  const handleCloseAnnouncement = (id) => {
    if (!user) return;

    const userId = user.readerId || user.id || user.username;
    const storageKey = `read_announcements_${userId}`;

    const newReadIds = new Set(readAnnouncementIds);
    newReadIds.add(id);
    setReadAnnouncementIds(newReadIds);

    localStorage.setItem(storageKey, JSON.stringify([...newReadIds]));
  };

  // 菜单项配置
  const menuItems = [
    {
      key: "/dashboard",
      icon: <DashboardOutlined />,
      label: "仪表板",
    },
    {
      key: "/books",
      icon: <BookOutlined />,
      label: "图书查询",
    },
    {
      key: "/borrow",
      icon: <HistoryOutlined />,
      label: "借阅记录",
    },
    {
      key: "/recommendations",
      icon: <BulbOutlined />,
      label: "智能推荐",
    },
    {
      key: "/smart-assistant",
      icon: <RobotOutlined />,
      label: "智能助手",
    },
    ...(isAdmin()
      ? [
          {
            type: "divider",
          },
          {
            key: "admin",
            icon: <SettingOutlined />,
            label: "管理功能",
            children: [
              {
                key: "/admin/users",
                label: "用户管理",
              },
              {
                key: "/admin/books",
                label: "图书管理",
              },
              {
                key: "/admin/import",
                label: "数据导入",
              },
              {
                key: "/admin/stats",
                label: "统计分析",
              },
              {
                key: "/admin/announcements",
                label: "全局通知",
              },
            ],
          },
        ]
      : []),
  ];

  // 用户下拉菜单
  const userMenuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "个人信息",
      onClick: () => navigate("/profile"),
    },
    {
      type: "divider",
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "退出登录",
      onClick: handleLogout,
    },
  ];

  // 处理菜单点击
  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  // 处理登出
  async function handleLogout() {
    await logout();
    navigate("/auth/login");
  }

  // 获取当前选中的菜单项
  const getSelectedKeys = () => {
    const path = location.pathname;

    // 借阅详情页保持选中借阅记录
    if (path.startsWith("/borrows/book")) {
      return ["/borrow"];
    }

    // 图书详情页保持选中图书查询
    if (path.startsWith("/books/")) {
      return ["/books"];
    }

    // 推荐详情页保持选中智能推荐
    if (path.startsWith("/recommendations/")) {
      return ["/recommendations"];
    }

    if (path.startsWith("/admin/")) {
      if (path.startsWith("/admin/users")) return ["/admin/users"];
      return [path];
    }
    return [path];
  };

  // 获取展开的菜单项
  const getOpenKeys = () => {
    const path = location.pathname;
    if (path.startsWith("/admin/")) {
      return ["admin"];
    }
    return [];
  };

  // 生成面包屑
  const generateBreadcrumbs = () => {
    if (breadcrumbs && breadcrumbs.length > 0) {
      return breadcrumbs.map((item) => ({
        title: item.title === "首页" ? <HomeOutlined /> : item.title,
        href: item.path,
      }));
    }

    const path = location.pathname;

    // 防闪烁
    if (path === "/borrows/book") {
      return [
        { title: <HomeOutlined />, href: "/dashboard" },
        { title: "借阅记录", href: "/borrow" },
        { title: "详情" },
      ];
    }

    const pathSegments = path.split("/").filter(Boolean);

    const breadcrumbItems = [
      {
        title: <HomeOutlined />,
        href: "/dashboard",
      },
    ];

    const pathMap = {
      dashboard: "仪表板",
      books: "图书查询",
      borrow: "借阅记录",
      recommendations: "智能推荐",
      "smart-assistant": "智能助手",
      profile: "个人信息",
      admin: "管理功能",
      users: "用户管理",
      import: "数据导入",
      stats: "统计分析",
      announcements: "全局通知",
    };

    let currentPath = "";
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathSegments.length - 1;

      breadcrumbItems.push({
        title: pathMap[segment] || segment,
        href: isLast ? undefined : currentPath,
      });
    });

    return breadcrumbItems;
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={sidebarCollapsed}
        collapsedWidth={0}
        breakpoint="md"
        onBreakpoint={(broken) => {
          setSidebarCollapsed(broken);
        }}
        style={{
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorder}`,
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 1000,
        }}
      >
        <div
          style={{
            position: "relative",
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderBottom: `1px solid ${token.colorBorder}`,
            fontSize: sidebarCollapsed ? 16 : 20,
            fontWeight: "bold",
            color: token.colorPrimary,
          }}
        >
          {sidebarCollapsed ? "AI" : "AI 图书馆"}
          {isMobile && !sidebarCollapsed && (
            <Button
              aria-label="关闭侧边栏"
              type="text"
              shape="circle"
              size="small"
              className="ant-btn-icon"
              icon={<CloseOutlined />}
              onClick={() => setSidebarCollapsed(true)}
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                width: 32,
                height: 32,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            />
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={getOpenKeys()}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0 }}
        />
      </Sider>

      {/* 移动端遮罩 */}
      {isMobile && !sidebarCollapsed && (
        <div
          onClick={() => setSidebarCollapsed(true)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 900,
          }}
        />
      )}

      <Layout style={{ paddingLeft: isMobile ? 0 : siderWidth }}>
        <Header
          style={{
            padding: "0 12px",
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Space>
            <Button
              type="text"
              icon={
                sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
              }
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{
                fontSize: isMobile ? "14px" : "16px",
                width: isMobile ? 48 : 64,
                height: isMobile ? 48 : 64,
              }}
            />
            {pageTitle && (
              <span style={{ fontSize: 16, fontWeight: 500 }}>{pageTitle}</span>
            )}
          </Space>

          <Space>
            <Tooltip title="通知">
              <Badge count={notifications.length} size="small">
                <Button type="text" icon={<BellOutlined />} />
              </Badge>
            </Tooltip>

            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              arrow
            >
              <Space style={{ cursor: "pointer" }}>
                <Avatar
                  size="small"
                  icon={<UserOutlined />}
                  src={user?.avatar}
                />
                <span>{user?.username || user?.name}</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <div
          style={{
            padding: isMobile ? "12px" : "16px",
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorder}`,
          }}
        >
          {announcements.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {announcements
                .filter((a) => !readAnnouncementIds.has(a.id))
                .map((announcement) => (
                  <Alert
                    key={announcement.id}
                    message={announcement.title}
                    description={announcement.content}
                    type={announcement.type}
                    showIcon
                    closable
                    onClose={() => handleCloseAnnouncement(announcement.id)}
                    style={{ marginBottom: 8 }}
                  />
                ))}
            </div>
          )}
          <Breadcrumb items={generateBreadcrumbs()} />
        </div>

        <Content
          style={{
            background: token.colorBgContainer,
            borderRadius: token.borderRadius,
            ...(location.pathname === "/smart-assistant"
              ? {
                  margin: 0,
                  padding: 0,
                  overflow: "hidden",
                  height: isMobile
                    ? "calc(100vh - 112px)"
                    : "calc(100vh - 118px)",
                }
              : {
                  margin: isMobile ? "12px" : "16px",
                  padding: isMobile ? "16px" : "24px",
                  overflow: "auto",
                  minHeight: isMobile
                    ? "calc(100vh - 140px)"
                    : "calc(100vh - 128px)",
                }),
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
