import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import os
from typing import Optional

# 文件路径配置
READERS_FILE = os.path.join("data", "cleaned", "csv", "readers_cleaned.csv")
BOOKS_FILE = os.path.join("data", "cleaned", "csv", "books_cleaned.csv")
BORROW_RECORDS_FILE = os.path.join("data", "virtual", "csv", "borrow_records.csv")
BORROW_PARQUET_FILE = os.path.join(
    "data", "virtual", "parquet", "borrow_records.parquet"
)

# 参数配置
# 生成人数
NUM_READERS_TO_GENERATE = 3000
# 每位读者借阅次数范围
MIN_BORROWS_PER_READER = 10
MAX_BORROWS_PER_READER = 30
# 借阅周期
BORROW_PERIOD_DAYS = 60
# 逾期和未还概率
OVERDUE_PROBABILITY = 0.05
UNRETURNED_PROBABILITY = 0.02
# 借阅日期范围
START_DATE = datetime(2000, 9, 1)
END_DATE = datetime(2025, 6, 30)

# 权重配置
# 院系对特定书籍分类的偏好权重值
PREFERRED_BOOK_WEIGHT = 3.0
# 书籍选择时全局热度所占权重
POPULARITY_WEIGHT = 0.7
# 书籍选择时院系偏好所占权重
DEPARTMENT_PREFERENCE_WEIGHT = 0.3
# 幂律分布参数 alpha 用于模拟书籍热度
POPULARITY_ALPHA = 1.5

# 索书号前缀与院系偏好映射
DEPARTMENT_BOOK_PREFERENCE = {
    "国际商务学院": ["F", "C"],
    "人文与传播学院": ["I", "H", "G2", "K"],
    "法学院": ["D", "DF"],
    "管理学院": ["C", "F"],
    "设计与创意学院": ["J", "TB"],
    "环境科学与工程学院": ["X", "Q", "S"],
    "信息科学与技术学院": ["TP", "TN", "O"],
    "机电工程与自动化学院": ["T", "O", "N"],
    "建筑学院": ["TU", "J"],
    "厦大双创学院": ["F", "C", "TP"],
    "日本语言与文化学院": ["H", "K", "I"],
    "音乐系": ["J6"],
    "土木工程学院": ["TU", "U"],
    "厦大国际学院": ["H", "F"],
    "电子科学与技术学院": ["TN", "O4", "TP"],
    "信息学院": ["TP", "TN", "O"],
    "英语语言文化学院": ["H", "I"],
    "社会与人类学院": ["C", "K"],
    "会计与金融学院": ["F"],
    "英语语言文化学院/国际商务学院": ["H", "F"],
    "海洋与海岸带发展研究院": ["P", "X"],
    "南海研究院": ["D", "K", "P"],
    "中国语言文学系": ["H", "I"],
    "电影学院": ["J", "I"],
    "历史与文化遗产学院": ["K", "G"],
    "哲学系": ["B"],
    "国际中文教育学院/国际商务学院": ["H", "F"],
}


# 提取索书号前缀
def get_callno_prefix(callno: str) -> str:
    if pd.isna(callno):
        return ""
    callno_str = str(callno).strip()
    prefix = ""
    for i, char in enumerate(callno_str):
        if char.isalpha():
            prefix += char
        elif char.isdigit() and i < 3:
            prefix += char
        else:
            break
    return prefix


# 根据院系偏好计算每本书的权重
def calculate_book_weights(books_df: pd.DataFrame, department: str) -> np.ndarray:
    preferred_prefixes = DEPARTMENT_BOOK_PREFERENCE.get(department, [])

    # 预计算所有图书的分类前缀
    book_callno_prefixes = books_df["CALLNO"].apply(get_callno_prefix)

    # 计算院系偏好权重
    dept_weights = np.ones(len(books_df))
    for pref in preferred_prefixes:
        dept_weights[book_callno_prefixes.str.startswith(pref)] = PREFERRED_BOOK_WEIGHT

    return dept_weights


# 生成借阅日期
def generate_borrow_date(enroll_year: int) -> Optional[datetime]:
    try:
        reader_start = datetime(enroll_year, 9, 1)
    except ValueError:
        return None

    actual_start = max(reader_start, START_DATE)

    if actual_start > END_DATE:
        return None

    days_diff = (END_DATE - actual_start).days
    random_days = random.randint(0, days_diff)
    return actual_start + timedelta(days=random_days)


# 生成借阅记录
def generate_borrow_records():
    try:
        readers_df = pd.read_csv(READERS_FILE, encoding="utf-8")
        books_df = pd.read_csv(BOOKS_FILE, encoding="utf-8")
    except FileNotFoundError as e:
        print(f"错误: 缺少输入文件 -> {e}")
        return

    print(f"读者总数: {len(readers_df)}\n图书总数: {len(books_df)}")

    if readers_df.empty or books_df.empty:
        print("错误: 读者或图书数据为空无法生成借阅记录")
        return

    # 选择生成读者记录数量
    actual_num_readers = max(NUM_READERS_TO_GENERATE, len(readers_df))
    selected_readers = readers_df.head(actual_num_readers)
    print(f"将为 {actual_num_readers} 位读者生成借阅记录")

    # 预计算书籍全局热度权重
    num_books = len(books_df)
    book_popularity = (
        np.random.zipf(POPULARITY_ALPHA, num_books)
        if num_books > 1
        else np.array([1.0])
    )

    # 归一化全局热度权重
    book_popularity = book_popularity / book_popularity.sum()

    borrow_records = []
    record_id = 1
    department_weights_cache = {}

    # 为每位读者生成记录
    for idx, reader in selected_readers.iterrows():
        department = reader["DEPARTMENT"]

        # 计算院系偏好权重
        if department not in department_weights_cache:
            department_weights_cache[department] = calculate_book_weights(
                books_df, department
            )
        dept_weights = department_weights_cache[department]

        # 计算综合权重
        # 综合权重 = 全局热度 * 权重 + 院系偏好 * 权重
        combined_weights = (
            book_popularity * POPULARITY_WEIGHT
            + (dept_weights / PREFERRED_BOOK_WEIGHT) * DEPARTMENT_PREFERENCE_WEIGHT
        )
        # 标准化权重
        combined_weights /= combined_weights.sum()

        num_borrows = random.randint(MIN_BORROWS_PER_READER, MAX_BORROWS_PER_READER)

        try:
            borrowed_book_indices = np.random.choice(
                num_books, size=num_borrows, replace=True, p=combined_weights
            )
        except ValueError as e:
            print(f"错误: 无法为读者 {reader['ID']} 生成记录，权重计算错误 -> {e})")
            continue

        for book_idx in borrowed_book_indices:
            borrow_date = generate_borrow_date(reader["ENROLLYEAR"])
            if borrow_date is None:
                continue

            due_date = borrow_date + timedelta(days=BORROW_PERIOD_DAYS)
            rand = random.random()

            if rand < UNRETURNED_PROBABILITY:
                return_date, status = None, "借阅中"
            else:
                if random.random() < OVERDUE_PROBABILITY:
                    overdue_days = random.randint(1, 60)
                    return_date = due_date + timedelta(days=overdue_days)
                    status = "逾期归还"
                else:
                    days_before_due = random.randint(0, BORROW_PERIOD_DAYS)
                    return_date = borrow_date + timedelta(days=days_before_due)
                    status = "已归还"

            record = {
                "BORROW_ID": f"BR{record_id:08d}",
                "READER_ID": reader["ID"],
                "BOOK_ID": books_df.iloc[book_idx]["ID"],
                "BORROW_DATE": borrow_date.strftime("%Y-%m-%d"),
                "DUE_DATE": due_date.strftime("%Y-%m-%d"),
                "RETURN_DATE": (
                    return_date.strftime("%Y-%m-%d") if return_date else None
                ),
                "STATUS": status,
            }
            borrow_records.append(record)
            record_id += 1

        print(
            f"\r\033[93m已处理 {idx}/{actual_num_readers} 位读者...\033[0m",
            end="",
            flush=True,
        )

    print(f"\n生成借阅记录总数: {len(borrow_records)}")
    if not borrow_records:
        return

    borrow_df = pd.DataFrame(borrow_records)

    # 保存为 CSV
    os.makedirs(os.path.dirname(BORROW_RECORDS_FILE), exist_ok=True)
    borrow_df.to_csv(BORROW_RECORDS_FILE, encoding="utf-8", index=False)
    print(f"借阅记录已保存 -> {BORROW_RECORDS_FILE}")

    # 保存为 Parquet
    os.makedirs(os.path.dirname(BORROW_PARQUET_FILE), exist_ok=True)
    borrow_df.to_parquet(
        BORROW_PARQUET_FILE, engine="pyarrow", compression="zstd", index=False
    )
    print(f"借阅记录已保存 -> {BORROW_PARQUET_FILE}")


def main():
    if not all(os.path.exists(f) for f in [READERS_FILE, BOOKS_FILE]):
        print(f"错误: {READERS_FILE} 或 {BOOKS_FILE} 文件不存在")
        return

    generate_borrow_records()
    print("\033[92m借阅记录生成完成\033[0m")


if __name__ == "__main__":
    main()
