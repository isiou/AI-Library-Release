import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Spin, message } from "antd";
import { borrowAPI } from "../services/api";
import useAppStore from "../stores/appStore";
import BookDetail from "./BookDetail";

const BorrowBookRedirect = () => {
  const [searchParams] = useSearchParams();
  const borrowId = searchParams.get("id");
  const navigate = useNavigate();
  const [bookId, setBookId] = useState(null);
  const { setBreadcrumbs } = useAppStore();

  useEffect(() => {
    setBreadcrumbs([
      { title: "首页", path: "/dashboard" },
      { title: "借阅记录", path: "/borrow" },
      { title: "详情" },
    ]);

    const fetchBookId = async () => {
      try {
        const record = await borrowAPI.getRecordById(borrowId);
        if (record && record.book_id) {
          setBookId(record.book_id);
        } else {
          message.error("未找到相关图书信息");
          navigate("/borrow");
        }
      } catch (error) {
        message.error(
          "获取借阅记录失败: " +
            (error.response?.data?.message || error.message || "未知错误"),
        );
        navigate("/borrow");
      }
    };

    if (borrowId) {
      fetchBookId();
    }

    return () => {
      setBreadcrumbs([]);
    };
  }, [borrowId, navigate, setBreadcrumbs]);

  if (!bookId) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Spin size="large" tip="正在加载图书详情..." />
      </div>
    );
  }

  return <BookDetail bookId={bookId} backPath="/borrow" />;
};

export default BorrowBookRedirect;
