import sharp from "sharp";

export async function compress(src, dest, { quality, format }) {
  let img = sharp(src);
  if (format) img = img.toFormat(format, { quality });
  else img = img.jpeg({ quality });
  await img.toFile(dest);
}
