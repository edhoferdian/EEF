from utils.textfmt import slugify


def report_filename(title: str, year: int) -> str:
    return f"{year}-{slugify(title)}.pdf"
