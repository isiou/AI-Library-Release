import { createBrowserRouter, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Spin } from "antd";

// 布局组件
import MainLayout from "../layouts/MainLayout";
import AuthLayout from "../layouts/AuthLayout";

// 路由守卫
import ProtectedRoute from "../components/ProtectedRoute";
import AdminRoute from "../components/AdminRoute";

// 懒加载组件
const Login = lazy(() => import("../pages/auth/Login"));
const Register = lazy(() => import("../pages/auth/Register"));
const Dashboard = lazy(() => import("../pages/Dashboard"));
const Profile = lazy(() => import("../pages/Profile"));
const Books = lazy(() => import("../pages/Books"));
const BookDetail = lazy(() => import("../pages/BookDetail"));
const BorrowRecords = lazy(() => import("../pages/BorrowRecords"));
const BorrowBookRedirect = lazy(() => import("../pages/BorrowBookRedirect"));
const Recommendations = lazy(() => import("../pages/Recommendations"));
const SmartAssistant = lazy(() => import("../pages/SmartAssistant"));
const AdminUsers = lazy(() => import("../pages/admin/UserManagement"));
const AdminBooks = lazy(() => import("../pages/admin/BookManagement"));
const AdminUserBorrowRecords = lazy(
  () => import("../pages/admin/UserBorrowRecords"),
);
const AdminImport = lazy(() => import("../pages/admin/DataImport"));
const AdminStats = lazy(() => import("../pages/admin/Statistics"));
const AdminAnnouncements = lazy(() => import("../pages/admin/Announcements"));
const NotFound = lazy(() => import("../pages/NotFound"));

const loadingFallback = (
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

const renderWithSuspense = (element) => (
  <Suspense fallback={loadingFallback}>{element}</Suspense>
);

const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: "/auth",
    element: <AuthLayout />,
    children: [
      {
        path: "login",
        element: <Login />,
      },
      {
        path: "register",
        element: <Register />,
      },
    ],
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: "dashboard",
        element: renderWithSuspense(<Dashboard />),
      },
      {
        path: "profile",
        element: renderWithSuspense(<Profile />),
      },
      {
        path: "books",
        children: [
          {
            index: true,
            element: renderWithSuspense(<Books />),
          },
          {
            path: ":id",
            element: renderWithSuspense(<BookDetail />),
          },
        ],
      },
      {
        path: "borrow",
        element: renderWithSuspense(<BorrowRecords />),
      },
      {
        path: "borrows/book",
        element: renderWithSuspense(<BorrowBookRedirect />),
      },
      {
        path: "recommendations",
        element: renderWithSuspense(<Recommendations />),
      },
      {
        path: "smart-assistant",
        element: renderWithSuspense(<SmartAssistant />),
      },
      {
        path: "admin",
        element: <AdminRoute />,
        children: [
          {
            path: "users",
            children: [
              {
                index: true,
                element: renderWithSuspense(<AdminUsers />),
              },
              {
                path: ":userId/borrow-records",
                element: renderWithSuspense(<AdminUserBorrowRecords />),
              },
            ],
          },
          {
            path: "books",
            element: renderWithSuspense(<AdminBooks />),
          },
          {
            path: "import",
            element: renderWithSuspense(<AdminImport />),
          },
          {
            path: "stats",
            element: renderWithSuspense(<AdminStats />),
          },
          {
            path: "announcements",
            element: renderWithSuspense(<AdminAnnouncements />),
          },
        ],
      },
    ],
  },
  {
    path: "/login",
    element: <Navigate to="/auth/login" replace />,
  },
  {
    path: "/register",
    element: <Navigate to="/auth/register" replace />,
  },
  {
    path: "*",
    element: renderWithSuspense(<NotFound />),
  },
]);

export default router;
