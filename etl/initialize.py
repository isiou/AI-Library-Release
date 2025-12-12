from src.clean.clean_books_csv import main as booksClean
from src.clean.clean_readers_csv import main as readersClean
from src.virtual.virtual_borrow_records import main as borrowRecordsInitial
from src.create_dirs import main as ensure_dirs


def main():
    try:
        print("初始化开始...")

        print("正在创建数据目录...")
        ensure_dirs()

        print("正在清洗图书数据...")
        booksClean()

        print("正在清洗读者数据...")
        readersClean()

        print("正在生成借阅记录...")
        borrowRecordsInitial()

        print("\033[4;96m===== 数据清洗与生成已完成 =====\033[0m")

    except Exception as e:
        print(f"\033[91m===== 出现错误 =====]\033[0m")
        print(e)


if __name__ == "__main__":
    main()
