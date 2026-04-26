from pathlib import Path
import pandas as pd


def safe_name(value: str) -> str:
    return (
        value.strip()
        .lower()
        .replace(" ", "_")
        .replace("-", "_")
        .replace("/", "_")
    )


def convert_xlsx_to_csv(xlsx_path: str, output_dir: str) -> list[str]:
    """
    Converts every worksheet in an XLSX workbook into a separate CSV file.
    Returns created CSV paths.
    """
    xlsx_path = Path(xlsx_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    excel_file = pd.ExcelFile(xlsx_path)
    csv_paths = []

    for sheet_name in excel_file.sheet_names:
        df = pd.read_excel(xlsx_path, sheet_name=sheet_name)
        csv_path = output_dir / f"{xlsx_path.stem}_{safe_name(sheet_name)}.csv"
        df.to_csv(csv_path, index=False)
        csv_paths.append(str(csv_path))

    return csv_paths


def upload_user_message(file_extension: str, sheet_count: int | None = None) -> str:
    if file_extension == ".xlsx":
        if sheet_count and sheet_count > 1:
            return (
                "You uploaded an Excel workbook (.xlsx). dolls1 will automatically "
                "convert each worksheet into a separate CSV file before importing the data. "
                "The original Excel file will be saved for reference."
            )
        return (
            "You uploaded an Excel workbook (.xlsx). dolls1 will automatically convert it "
            "to CSV format before importing the data. The original Excel file will be saved."
        )

    if file_extension == ".csv":
        return "CSV file detected. dolls1 will import this file directly."

    if file_extension == ".sql":
        return "SQL seed file detected. dolls1 will validate the file before import."

    if file_extension == ".zip":
        return "ZIP file detected. dolls1 will extract and validate CSV files before import."

    return "Unsupported file type."

