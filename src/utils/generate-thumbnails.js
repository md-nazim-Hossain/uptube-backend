import ffmpeg from "fluent-ffmpeg";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

ffmpeg.setFfprobePath(join(__dirname, "bin", "ffprobe"));
ffmpeg.setFfmpegPath(join(__dirname, "bin", "ffmpeg"));

export function generateThumbnails({ url }) {
  let filePath;
  return new Promise((resolve, reject) => {
    return ffmpeg(url)
      .on("filenames", (filenames) => {
        console.log("Will generate", filenames.join(", "));
        filePath = `public/thumbnails/${filenames[0]}`;
      })
      .on("end", () => {
        console.log("Screenshots taken");
        resolve({
          success: true,
          url: filePath,
        });
      })
      .on("error", (err) => {
        console.log(err);
        reject({ success: false, err });
      })
      .screenshots({
        count: 1,
        folder: "public/thumbnails",
        filename: "thumbnail-%b.png",
      });
  });
}
