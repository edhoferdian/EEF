"""Make a thumbnail for an uploaded image with ImageMagick."""
import subprocess
from pathlib import Path

UPLOADS = Path("/srv/uploads")


def make_thumbnail(filename: str, width: int = 200) -> Path:
    src = UPLOADS / Path(filename).name
    dest = src.with_suffix(".thumb.jpg")
    subprocess.run(f"convert '{src}' -resize {width}x '{dest}'", shell=True, check=True)
    return dest
