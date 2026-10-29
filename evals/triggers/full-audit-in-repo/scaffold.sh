#!/usr/bin/env bash
# Copy this case's fixture files into the empty workspace (cwd).
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp -R "$here/fixture/." .
