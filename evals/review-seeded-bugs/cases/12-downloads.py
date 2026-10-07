import os

from flask import Flask, abort, send_file
from flask_login import current_user, login_required

app = Flask(__name__)
UPLOAD_DIR = "/srv/app/uploads"


@app.get("/files/<path:filename>")
@login_required
def download(filename: str):
    """Let a signed-in user download a file from their own upload folder."""
    user_dir = os.path.join(UPLOAD_DIR, str(current_user.id))
    path = os.path.join(user_dir, filename)
    if not os.path.isfile(path):
        abort(404)
    return send_file(path, as_attachment=True)
