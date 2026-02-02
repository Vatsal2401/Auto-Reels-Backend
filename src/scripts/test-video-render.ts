import ffmpeg from 'fluent-ffmpeg';
import { existsSync, readdirSync, unlinkSync, createWriteStream, statSync } from 'fs';
import { join } from 'path';

// Config
const ASSETS_DIR = join(__dirname, '../../test-assets'); // Root/backend/test-assets
const OUTPUT_FILE = join(ASSETS_DIR, 'output.mp4');

// Interfaces
import { Readable, pipeline } from 'stream';
import { promisify } from 'util';
const streamPipeline = promisify(pipeline);

// Interfaces
interface ComposeOptions {
  audioPath: string;
  captionPath: string;
  assetPaths: string[];
}

// Ensure FFmpeg is available
// ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');

class VideoComposer {
  async compose(options: ComposeOptions): Promise<Readable> {
    const { audioPath, captionPath, assetPaths } = options;

    console.log(`[Composer] Rendering from local paths...`);

    // 1. Get Audio Duration
    const audioDuration = await this.getMediaDuration(audioPath);
    console.log(`[Composer] Audio Duration: ${audioDuration}s`);

    const imageCount = assetPaths.length || 1;
    const transitionDuration = 0.5;
    const audioDurationWithBuffer = audioDuration + 0.5;

    let slideDuration: number;
    if (imageCount > 1) {
      slideDuration =
        (audioDurationWithBuffer + (imageCount - 1) * transitionDuration) / imageCount;
    } else {
      slideDuration = audioDurationWithBuffer;
    }

    slideDuration = Math.max(3, slideDuration);

    return new Promise((resolve, reject) => {
      const command = ffmpeg();
      const complexFilters: string[] = [];
      const videoStreams: string[] = [];

      // --- SLIDESHOW MODE (720p Optimized) ---
      if (assetPaths.length > 0) {
        assetPaths.forEach((img) => command.input(img));

        assetPaths.forEach((_, i) => {
          const effect = this.getRandomKenBurnsEffect();
          const frames = Math.ceil((slideDuration + transitionDuration) * 25);

          // Optimized for 720p
          complexFilters.push(
            `[${i}:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,` +
              `zoompan=${effect}d=${frames}:s=720x1280:fps=25[v${i}]`,
          );
          videoStreams.push(`v${i}`);
        });

        if (videoStreams.length > 1) {
          let prevStream = videoStreams[0];
          let currentOffset = slideDuration - transitionDuration;

          for (let i = 1; i < videoStreams.length; i++) {
            const nextStream = videoStreams[i];
            const outStream = i === videoStreams.length - 1 ? 'v_merged' : `x${i}`;
            complexFilters.push(
              `[${prevStream}][${nextStream}]xfade=transition=fade:duration=${transitionDuration}:offset=${currentOffset}[${outStream}]`,
            );
            prevStream = outStream;
            currentOffset += slideDuration - transitionDuration;
          }
        } else {
          complexFilters.push(`[v0]copy[v_merged]`);
        }
      } else {
        command.input('color=c=black:s=720x1280:d=' + (audioDuration || 30)).inputFormat('lavfi');
        complexFilters.push(`[0:v]null[v_merged]`);
      }

      // --- FINAL COMPOSITION ---
      const audioIndex = assetPaths.length > 0 ? assetPaths.length : 1;
      command.input(audioPath);

      complexFilters.push(
        `[v_merged]subtitles='${captionPath}':force_style='FontSize=16,PrimaryColour=&Hffffff,OutlineColour=&H000000,BorderStyle=1,Outline=1,Shadow=0,Bold=1,Alignment=2,MarginV=50'[v_final]`,
      );

      command
        .complexFilter(complexFilters)
        .outputOptions([
          '-map [v_final]',
          `-map ${audioIndex}:a`,
          '-c:v libx264',
          '-preset fast',
          '-crf 23',
          '-c:a aac',
          '-b:a 192k',
          '-pix_fmt yuv420p',
          '-shortest',
          '-f mp4',
          '-movflags frag_keyframe+empty_moov+default_base_moof',
        ])
        .on('start', (cmdLine) => {
          console.log('[Composer] FFmpeg Command: ' + cmdLine);
        })
        .on('error', (err, _stdout, _stderr) => {
          console.error('[Composer] FFmpeg Error:', err.message);
          reject(err);
        });

      // Return stream
      resolve(command.pipe() as any);
    });
  }

  private getMediaDuration(path: string): Promise<number> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(path, (err, metadata) => {
        if (err || !metadata) resolve(0);
        else resolve(metadata.format.duration || 0);
      });
    });
  }

  private getRandomKenBurnsEffect(): string {
    const effects = [
      // Zoom In Center
      "z='min(zoom+0.0015,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':",
      // Zoom Out Center
      "z='if(eq(on,1),1.5,max(1.0,zoom-0.0015))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':",
      // Pan Left
      "z=1.2:x='if(eq(on,1),0,min(x+1,iw-iw/zoom))':y='(ih-ih/zoom)/2':",
      // Pan Right
      "z=1.2:x='if(eq(on,1),iw-iw/zoom,max(x-1,0))':y='(ih-ih/zoom)/2':",
    ];
    return effects[Math.floor(Math.random() * effects.length)];
  }

  private cleanup(paths: string[]): void {
    paths.forEach((p) => {
      try {
        if (p && existsSync(p)) unlinkSync(p);
      } catch (_e) {}
    });
  }
}

// --- MAIN EXECUTION ---
async function main() {
  console.log('--- TEST VIDEO RENDERER START ---');
  console.log(`Checking for assets in: ${ASSETS_DIR}`);

  // Checks
  if (!existsSync(ASSETS_DIR)) {
    console.error(`ERROR: Assets directory ${ASSETS_DIR} does not exist.`);
    process.exit(1);
  }

  // Find Audio (audio.mp3)
  let audioPath = join(ASSETS_DIR, 'audio.mp3');
  if (!existsSync(audioPath)) {
    // Try any mp3
    const files = readdirSync(ASSETS_DIR);
    const mp3 = files.find((f) => f.endsWith('.mp3'));
    if (mp3) audioPath = join(ASSETS_DIR, mp3);
    else {
      console.error(`ERROR: No audio.mp3 found in ${ASSETS_DIR}`);
      process.exit(1);
    }
  }

  // Find Caption (caption.srt or captions.srt)
  let captionPath = join(ASSETS_DIR, 'caption.srt');
  if (!existsSync(captionPath)) captionPath = join(ASSETS_DIR, 'captions.srt');
  if (!existsSync(captionPath)) {
    // Try any srt
    const files = readdirSync(ASSETS_DIR);
    const srt = files.find((f) => f.endsWith('.srt'));
    if (srt) captionPath = join(ASSETS_DIR, srt);
    else {
      console.error(`ERROR: No caption.srt found in ${ASSETS_DIR}`);
      process.exit(1);
    }
  }

  // Find Images (*.png, *.jpg) sorted by name
  const allFiles = readdirSync(ASSETS_DIR);
  const imageFiles = allFiles.filter((f) => f.match(/\.(png|jpg|jpeg)$/i)).sort(); // Sort makes sure 1.png comes before 2.png (usually)

  if (imageFiles.length === 0) {
    console.error(`ERROR: No images found in ${ASSETS_DIR}`);
    process.exit(1);
  }

  console.log(`Found Assets:`);
  console.log(` - Audio: ${audioPath}`);
  console.log(` - Caption: ${captionPath}`);
  console.log(` - Images (${imageFiles.length}): ${imageFiles.join(', ')}`);

  const assetPaths = imageFiles.map((f) => join(ASSETS_DIR, f));

  // Run Composer
  const composer = new VideoComposer();
  console.log('\nStarting Composition...');

  const videoStream = await composer.compose({
    audioPath,
    captionPath,
    assetPaths,
  });

  console.log(`\nComposition Success! Streaming output to: ${OUTPUT_FILE}`);

  // Pipe stream to output file
  const outputStream = createWriteStream(OUTPUT_FILE);
  await streamPipeline(videoStream, outputStream);

  const stats = statSync(OUTPUT_FILE);
  console.log(`Saved result to: ${OUTPUT_FILE} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
