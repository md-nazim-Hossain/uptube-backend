import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static"; // For ffmpeg binary
import ffprobeStatic from "ffprobe-static"; // For ffprobe binary

// Set the paths for ffmpeg and ffprobe
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

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
