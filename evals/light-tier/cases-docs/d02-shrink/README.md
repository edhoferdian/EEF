# shrink

Batch-compress images from the command line.

## Usage

    shrink <files...> [options]

| Option | Default | Description |
|---|---|---|
| `-o, --output <dir>` | `./out` | Directory to write compressed files to |
| `-q, --quality <n>` | `80` | JPEG/WebP quality, 1-100 |
| `--format <fmt>` | keep | Convert to `webp`, `jpeg` or `png` |
| `--dry-run` | off | Print what would be written without writing anything |

Example:

    shrink photos/*.jpg --format webp -q 70 -o compressed
