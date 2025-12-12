import pandas as pd
import json
import os
from .utils import export_to_parquet, export_to_csv

# 文件路径配置
CSV_FILE = os.path.join("data", "original", "books.csv")
PARQUET_FILE = os.path.join("data", "cleaned", "parquet", "books.parquet")
CLEANED_CSV_FILE = os.path.join("data", "cleaned", "csv", "books_cleaned.csv")
STATS_OUTPUT = os.path.join("data", "cleaned", "stats", "books_stats.json")
CHUNK_SIZE = 50000


# 清洗 CSV 并返回 DataFrame
def clean_csv_to_dataframe(input_file=CSV_FILE):
    chunks = []
    total_original = 0
    total_cleaned = 0

    for chunk in pd.read_csv(
        input_file,
        encoding="utf-8",
        chunksize=CHUNK_SIZE,
        on_bad_lines="skip",
    ):
        total_original += len(chunk)

        # 删除字段为空的记录
        chunk.dropna(how="any", inplace=True)

        # 删除任何字段为空字符串的记录
        for col in chunk.columns:
            chunk = chunk[chunk[col].astype(str).str.strip() != ""]

        # YEAR 字段: 只保留能转换为整数的记录
        if "YEAR" in chunk.columns:
            chunk["YEAR"] = pd.to_numeric(chunk["YEAR"], errors="coerce")
            chunk.dropna(subset=["YEAR"], inplace=True)
            chunk = chunk[chunk["YEAR"] == chunk["YEAR"].astype(int)]
            chunk["YEAR"] = chunk["YEAR"].astype(int)

        # PUBLISHER 字段: 去除末尾逗号和空格
        if "PUBLISHER" in chunk.columns:
            chunk["PUBLISHER"] = chunk["PUBLISHER"].astype(str).str.rstrip(", ")

        # 语言和文献类型字段转为字符串
        for col in ["LANGUAGE", "DOCTYPE"]:
            if col in chunk.columns:
                chunk[col] = chunk[col].astype(str)

        total_cleaned += len(chunk)

        if not chunk.empty:
            chunks.append(chunk)

    if not chunks:
        print("错误: 清洗后无有效数据")
        return None

    df = pd.concat(chunks, ignore_index=True)
    print(
        f"原始记录数: {total_original} 清洗后记录数: {total_cleaned} 删除记录数: {total_original - total_cleaned}",
    )
    return df


# 对 DataFrame 进行统计分析并保存结果
def analyze_dataframe(df: pd.DataFrame):
    if df is None or df.empty:
        print("错误: 数据集为空无法进行统计分析")
        return

    df_for_analysis = df[["LANGUAGE", "DOCTYPE", "PUBLISHER", "YEAR"]].copy()

    stats = {
        "total_books": len(df_for_analysis),
        "language_distribution": df_for_analysis["LANGUAGE"].value_counts().to_dict(),
        "doctype_distribution": df_for_analysis["DOCTYPE"].value_counts().to_dict(),
        "top_publishers": df_for_analysis["PUBLISHER"]
        .value_counts()
        .head(10)
        .to_dict(),
        "year_distribution": df_for_analysis["YEAR"]
        .value_counts()
        .sort_index()
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

    print("\033[92m图书数据清洗与分析已完成\033[0m")


if __name__ == "__main__":
    main()
