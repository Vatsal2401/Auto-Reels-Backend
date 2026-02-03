import ffmpeg from 'fluent-ffmpeg';
import { existsSync, readdirSync, unlinkSync, createWriteStream, statSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

function logMemoryUsage(label: string) {
  const mem = process.memoryUsage();
  const toMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);
  console.log(
    `[MEMORY] [${label}] RSS: ${toMB(mem.rss)} MB, Heap: ${toMB(mem.heapUsed)}/${toMB(mem.heapTotal)} MB, External: ${toMB(mem.external)} MB`,
  );
}

function getProcessMemory(pid: number): string {
  try {
    const output = execSync(`ps -p ${pid} -o rss=`).toString().trim();
    const rssKB = parseInt(output, 10);
    return (rssKB / 1024).toFixed(2) + ' MB';
  } catch (_e) {
    return 'N/A';
  }
}

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
  preset: string;
  width?: number;
}

// ...

class VideoComposer {
  async compose(options: ComposeOptions): Promise<Readable> {
    const { audioPath, captionPath, assetPaths, preset, width = 720 } = options;
    const height = Math.round(width * (16 / 9)); // Maintain 9:16 aspect ratio

    console.log(`[Composer] Rendering with preset: ${preset}, Resolution: ${width}x${height}...`);

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

      // --- SLIDESHOW MODE ---
      if (assetPaths.length > 0) {
        assetPaths.forEach((img) => command.input(img));

        assetPaths.forEach((_, i) => {
          const effect = this.getRandomKenBurnsEffect();
          const frames = Math.ceil((slideDuration + transitionDuration) * 25);

          // Optimized for target resolution
          complexFilters.push(
            `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,` +
              `zoompan=${effect}d=${frames}:s=${width}x${height}:fps=25[v${i}]`,
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
        command
          .input(`color=c=black:s=${width}x${height}:d=` + (audioDuration || 30))
          .inputFormat('lavfi');
        complexFilters.push(`[0:v]null[v_merged]`);
      }

      // --- FINAL COMPOSITION ---
      const audioIndex = assetPaths.length > 0 ? assetPaths.length : 1;
      command.input(audioPath);

      // Adjust caption font size based on resolution (approx 2.2% of height)
      const fontSize = Math.round(height * 0.022);
      const marginV = Math.round(height * 0.04);

      complexFilters.push(
        `[v_merged]subtitles='${captionPath}':force_style='FontSize=${fontSize},PrimaryColour=&Hffffff,OutlineColour=&H000000,BorderStyle=1,Outline=1,Shadow=0,Bold=1,Alignment=2,MarginV=${marginV}'[v_final]`,
      );

      command
        .complexFilter(complexFilters)
        .outputOptions([
          '-map [v_final]',
          `-map ${audioIndex}:a`,
          '-c:v libx264',
          `-preset ${preset}`,
          '-threads 1',
          '-filter_threads 1',
          '-filter_complex_threads 1',
          '-crf 23',
          '-c:a aac',
          '-b:a 128k', // Lower audio bitrate slightly for speed
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
      const stream = command.pipe();
      (stream as any).getFFmpegProc = () => (command as any).ffmpegProc;
      resolve(stream as any);
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
  const imageFiles = allFiles.filter((f) => f.match(/\.(png|jpg|jpeg)$/i)).sort();

  if (imageFiles.length === 0) {
    console.error(`ERROR: No images found in ${ASSETS_DIR}`);
    process.exit(1);
  }

  console.log(`Found Assets:`);
  console.log(` - Audio: ${audioPath}`);
  console.log(` - Caption: ${captionPath}`);
  console.log(` - Images (${imageFiles.length}): ${imageFiles.join(', ')}`);

  const assetPaths = imageFiles.map((f) => join(ASSETS_DIR, f));

  const presets = ['fast', 'superfast', 'ultrafast'];
  // We will handle 'fast_540p' as a special case in the loop logic if needed,
  // or just add a 'resolution' param to compose options.

  const results: any[] = [];

  // Define test cases
  const testCases = [
    { name: 'fast_720p', preset: 'fast', width: 720 },
    { name: 'superfast_720p', preset: 'superfast', width: 720 },
    { name: 'ultrafast_720p', preset: 'ultrafast', width: 720 },
    { name: 'fast_540p', preset: 'fast', width: 540 },
    { name: 'superfast_540p', preset: 'superfast', width: 540 },
  ];

  for (const test of testCases) {
    const outputFile = OUTPUT_FILE.replace('.mp4', `_${test.name}.mp4`);
    console.log(`\n--- BENCHMARK: ${test.name.toUpperCase()} ---`);

    logMemoryUsage(`START_${test.name}`);
    const startTime = Date.now();

    const composer = new VideoComposer();
    const videoStream = await composer.compose({
      audioPath,
      captionPath,
      assetPaths,
      preset: test.preset,
      width: test.width,
    });

    const outputStream = createWriteStream(outputFile);
    const memInterval = setInterval(() => {
      const ffmpegProc = (videoStream as any).getFFmpegProc
        ? (videoStream as any).getFFmpegProc()
        : null;
      if (ffmpegProc && ffmpegProc.pid) {
        logMemoryUsage(`PIPING_${test.name}`);
        console.log(`[MEMORY] [FFMPEG] PID ${ffmpegProc.pid}: ${getProcessMemory(ffmpegProc.pid)}`);
      }
    }, 2000);

    try {
      await streamPipeline(videoStream, outputStream);
    } finally {
      clearInterval(memInterval);
    }

    const endTime = Date.now();
    const stats = statSync(outputFile);
    const duration = (endTime - startTime) / 1000;

    results.push({
      name: test.name,
      time: duration.toFixed(2) + 's',
      size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
    });

    logMemoryUsage(`END_${test.name}`);
  }

  console.log('\n' + '='.repeat(30));
  console.log('BENCHMARK RESULTS');
  console.log('='.repeat(30));
  console.table(results);
  console.log('='.repeat(30));
}

main().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
