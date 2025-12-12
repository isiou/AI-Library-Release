import shutil
import tempfile
from pathlib import Path
import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from starlette.background import BackgroundTask

from src.clean import clean_books_csv, clean_readers_csv

app = FastAPI(title="AI-Library ETL Service")

# 配置路径
BASE_DIR = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = BASE_DIR / "templates"

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


def cleanup_file(path: str | Path):
    path = Path(path)
    try:
        if path.exists():
            path.unlink()
    except Exception as e:
        print(f"ERROR: \n{e}")


@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/clean/books")
async def clean_books(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    tmp_input_path = None
    tmp_output_path = None

    try:
        # 创建输入临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp_input:
            shutil.copyfileobj(file.file, tmp_input)
            tmp_input_path = Path(tmp_input.name)

        # 清洗数据
        df = clean_books_csv.clean_csv_to_dataframe(tmp_input_path)

        if df is None or df.empty:
            raise HTTPException(
                status_code=400, detail="Resulting dataset is empty or cleaning failed"
            )

        # 保存到临时输出
        with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp_output:
            tmp_output_path = Path(tmp_output.name)

        df.to_csv(tmp_output_path, index=False, encoding="utf-8")

        return FileResponse(
            path=tmp_output_path,
            filename=f"cleaned_{file.filename}",
            media_type="text/csv",
            background=BackgroundTask(cleanup_file, tmp_output_path),
        )

    except Exception as e:
        if tmp_output_path:
            cleanup_file(tmp_output_path)
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")
    finally:
        if tmp_input_path:
            cleanup_file(tmp_input_path)


@app.post("/clean/readers")
async def clean_readers(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    tmp_input_path = None
    tmp_output_path = None

    try:
        # 创建输入临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp_input:
            shutil.copyfileobj(file.file, tmp_input)
            tmp_input_path = Path(tmp_input.name)

        # 清洗数据
        df = clean_readers_csv.clean_csv_to_dataframe(tmp_input_path)

        if df is None or df.empty:
            raise HTTPException(
                status_code=400, detail="Cleaning resulted in empty dataset or failed"
            )

        # 保存到临时输出
        with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp_output:
            tmp_output_path = Path(tmp_output.name)

        df.to_csv(tmp_output_path, index=False, encoding="utf-8")

        return FileResponse(
            path=tmp_output_path,
            filename=f"cleaned_{file.filename}",
            media_type="text/csv",
            background=BackgroundTask(cleanup_file, tmp_output_path),
        )

    except Exception as e:
        if tmp_output_path:
            cleanup_file(tmp_output_path)
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")
    finally:
        if tmp_input_path:
            cleanup_file(tmp_input_path)


if __name__ == "__main__":
    uvicorn.run("src.web_app:app", host="127.0.0.1", port=8000, reload=True)
