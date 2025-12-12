from pathlib import Path


def ensure_dirs(base_dir: Path):
    dirs = [
        base_dir,
        base_dir / "cleaned",
        base_dir / "cleaned" / "csv",
        base_dir / "cleaned" / "parquet",
        base_dir / "cleaned" / "stats",
        base_dir / "original",
        base_dir / "virtual",
        base_dir / "virtual" / "csv",
        base_dir / "virtual" / "parquet",
    ]

    results = []
    for d in dirs:
        created = False
        if not d.exists():
            d.mkdir(parents=True, exist_ok=True)
            created = True
        results.append((d, created))
    return results


def main():
    base_dir = Path("data")
    results = ensure_dirs(base_dir)

    print(f"目标根目录: {base_dir}")
    created_count = sum(1 for _, c in results if c)
    print(f"已创建目录: {created_count}\n总计: {len(results)}")
    for d, c in results:
        status = "创建" if c else "已存在"
        print(f"{status} -> {d}")


if __name__ == "__main__":
    main()
