import os
import pandas as pd


def export_to_parquet(df: pd.DataFrame, file_path: str):
    if df is None or df.empty:
        print("错误: 数据集为空无法导出")
        return
    try:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        df.to_parquet(
            file_path,
            engine="pyarrow",
            compression="zstd",
            index=False,
        )
        print(f"数据已保存 -> {file_path}")
    except Exception as e:
        print(f"错误: Parquet 导出失败 -> {e}")


def export_to_csv(df: pd.DataFrame, file_path: str):
    if df is None or df.empty:
        print("错误: 数据集为空无法导出")
        return
    try:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        df.to_csv(
            file_path,
            encoding="utf-8",
            index=False,
        )
        print(f"清洗后数据已导出 -> {file_path}")
    except IOError as e:
        print(f"错误: CSV 导出失败 -> {e}")
