import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";

ffmpeg.setFfmpegPath(ffmpegPath);

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
