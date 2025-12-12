import pandas as pd
import json
import os
import re
from .utils import export_to_parquet, export_to_csv

# 文件路径配置
CSV_FILE = os.path.join("data", "original", "readers.csv")
PARQUET_FILE = os.path.join("data", "cleaned", "parquet", "readers.parquet")
CLEANED_CSV_FILE = os.path.join("data", "cleaned", "csv", "readers_cleaned.csv")
STATS_OUTPUT = os.path.join("data", "cleaned", "stats", "readers_stats.json")
CHUNK_SIZE = 50000


# 验证 ID 格式
def validate_id(id_str: str) -> bool:
    pattern = r"^[A-Z]{3,5}\d{5}$"
    return bool(re.match(pattern, str(id_str)))


# 清洗 CSV 并返回 DataFrame
def clean_csv_to_dataframe(input_file=CSV_FILE):
    chunks = []
    total_original = 0
    total_cleaned = 0
    seen_ids = set()

    for chunk in pd.read_csv(
        input_file,
        encoding="utf-8",
        chunksize=CHUNK_SIZE,
        on_bad_lines="skip",
    ):
        total_original += len(chunk)

        # 删除任何字段为空的记录
        chunk.dropna(how="any", inplace=True)

        # 删除任何字段为空字符串的记录
        for col in chunk.columns:
            chunk = chunk[chunk[col].astype(str).str.strip() != ""]

        # ID 字段: 验证格式
        if "ID" in chunk.columns:
            chunk["ID"] = chunk["ID"].astype(str).str.strip()
            chunk = chunk[chunk["ID"].apply(validate_id)]

        # GENDER 字段: 只保留 F 或 M 记录
        if "GENDER" in chunk.columns:
            chunk["GENDER"] = chunk["GENDER"].astype(str).str.strip().str.upper()
            chunk = chunk[chunk["GENDER"].isin(["F", "M"])]

        # ENROLLYEAR 字段: 2000-2025 区间的整数
        if "ENROLLYEAR" in chunk.columns:
            chunk["ENROLLYEAR"] = pd.to_numeric(chunk["ENROLLYEAR"], errors="coerce")
            chunk.dropna(subset=["ENROLLYEAR"], inplace=True)
            chunk = chunk[chunk["ENROLLYEAR"] == chunk["ENROLLYEAR"].astype(int)]
            chunk["ENROLLYEAR"] = chunk["ENROLLYEAR"].astype(int)
            chunk = chunk[(chunk["ENROLLYEAR"] >= 2000) & (chunk["ENROLLYEAR"] <= 2025)]

        # 清洗 TYPE 和 DEPARTMENT 字段: 去除前后空格
        for col in ["TYPE", "DEPARTMENT"]:
            if col in chunk.columns:
                chunk[col] = chunk[col].astype(str).str.strip()

        # 基于 ID 去重，保留第一次出现的记录
        if "ID" in chunk.columns and not chunk.empty:
            # 移除此块中已见过的 ID
            chunk = chunk[~chunk["ID"].isin(seen_ids)]
            # 移除此块内的重复项
            chunk.drop_duplicates(subset=["ID"], keep="first", inplace=True)
            # 更新已见 ID 集合
            seen_ids.update(chunk["ID"])

        total_cleaned += len(chunk)

        if not chunk.empty:
            chunks.append(chunk)

    if not chunks:
        print("错误: 清洗后无有效数据")
        return None

    df = pd.concat(chunks, ignore_index=True)
    print(
        f"原始记录数: {total_original}\n清洗后记录数: {total_cleaned}\n删除记录数: {total_original - total_cleaned}"
    )
    return df


# 对 DataFrame 进行统计分析并保存结果
def analyze_dataframe(df: pd.DataFrame):
    if df is None or df.empty:
        print("错误: 数据集为空无法进行统计分析")
        return

    df_for_analysis = df[["GENDER", "ENROLLYEAR", "TYPE", "DEPARTMENT"]].copy()

    stats = {
        "total_readers": len(df_for_analysis),
        "gender_distribution": df_for_analysis["GENDER"].value_counts().to_dict(),
        "enrollyear_distribution": df_for_analysis["ENROLLYEAR"]
        .value_counts()
        .sort_index()
        .to_dict(),
        "type_distribution": df_for_analysis["TYPE"].value_counts().to_dict(),
        "department_distribution": df_for_analysis["DEPARTMENT"]
        .value_counts()
        .to_dict(),
    }

    try:
        os.makedirs(os.path.dirname(STATS_OUTPUT), exist_ok=True)
        with open(STATS_OUTPUT, "w", encoding="utf-8") as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)
        print(f"统计结果已保存 -> {STATS_OUTPUT}")
    except IOError as e:
        print(f"错误: 统计结果保存失败 -> {e}")


def main():
    if not os.path.exists(CSV_FILE):
        print(f"错误: 未找到待处理文件 -> {CSV_FILE}")
        return

    # 清洗数据
    cleaned_df = clean_csv_to_dataframe()

    if cleaned_df is None or cleaned_df.empty:
        print("错误: 数据清洗未能生成有效数据，流程终止")
        return

    # 保存为 Parquet
    export_to_parquet(cleaned_df, PARQUET_FILE)

    # 导出为清洗后的 CSV
    export_to_csv(cleaned_df, CLEANED_CSV_FILE)

    # 统计分析
    analyze_dataframe(cleaned_df)

    print("\033[92m读者数据清洗与分析已完成\033[0m")


if __name__ == "__main__":
    main()
