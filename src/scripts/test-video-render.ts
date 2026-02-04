import ffmpeg from 'fluent-ffmpeg';
import {
  existsSync,
  readdirSync,
  unlinkSync,
  createWriteStream,
  statSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { Readable, pipeline } from 'stream';
import { promisify } from 'util';

const streamPipeline = promisify(pipeline);

// --- SRT Parser ---
function parseSRT(srtPath: string): any[] {
  const content = readFileSync(srtPath, 'utf8');
  const blocks = content.split(/\n\s*\n/);
  return blocks
    .map((block) => {
      const lines = block.split('\n');
      if (lines.length < 3) return null;
      const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
      if (!timeMatch) return null;

      const parseTime = (s: string) => {
        const [hms, ms] = s.split(',');
        const [h, m, s_val] = hms.split(':').map(Number);
        return h * 3600 + m * 60 + s_val + Number(ms) / 1000;
      };

      return {
        start: parseTime(timeMatch[1]),
        end: parseTime(timeMatch[2]),
        text: lines.slice(2).join(' ').trim(),
      };
    })
    .filter((b) => b !== null);
}

// --- Light AssSubtitleProvider ---
class LightAssSubtitleProvider {
  generateAssContent(timings: any[], config: any): string {
    const sections = [
      this.getScriptInfo(),
      this.getStyles(config),
      this.getEvents(timings, config),
    ];
    return sections.join('\n\n');
  }

  private getScriptInfo(): string {
    return `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
ScaledBorderAndShadow: yes`;
  }

  private getStyles(config: any): string {
    let alignment = 2; // Bottom Center
    let marginV = 50;

    if (config.position === 'top') {
      alignment = 8;
      marginV = 60;
    } else if (config.position === 'center') {
      alignment = 5;
      marginV = 50;
    }

    const styles: Record<string, string> = {
      BoldStroke: `Style: BoldStroke,DejaVu Sans,70,&H00FFFFFF,&H00000000,&H00000000,1,0,1,4,0,${alignment},40,40,${marginV},1`,
      RedHighlight: `Style: RedHighlight,DejaVu Sans,70,&H00FFFFFF,&H000000FF,&H000000FF,1,0,1,4,1,${alignment},40,40,${marginV},1`,
      Sleek: `Style: Sleek,DejaVu Sans,70,&H00FFFFFF,&H00000000,&H00FFFFFF,0,0,1,0,3,${alignment},40,40,${marginV},1`,
      KaraokeCard: `Style: KaraokeCard,DejaVu Sans,60,&H00FFFFFF,&H00000000,&H00FF00FF,1,0,3,0,0,${alignment},40,40,${marginV},1`,
      Majestic: `Style: Majestic,DejaVu Sans,80,&H00FFFFFF,&H00000000,&H00000000,1,0,1,1,4,${alignment},40,40,${marginV},1`,
      Beast: `Style: Beast,DejaVu Sans,80,&H00FFFFFF,&H00000000,&H00000000,1,1,1,5,0,${alignment},40,40,${marginV},1`,
      Elegant: `Style: Elegant,DejaVu Serif,50,&H00FFFFFF,&H00000000,&H00000000,0,0,1,0,1,${alignment},40,40,${marginV},1`,
    };

    const capitalized = config.preset
      .split('-')
      .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('');
    const selectedStyleLine = styles[capitalized] || styles['BoldStroke'];

    return `[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${selectedStyleLine}`;
  }

  private getEvents(timings: any[], config: any): string {
    const capitalized = config.preset
      .split('-')
      .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('');
    const lines = timings.map((t) => {
      const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        const ms = Math.floor((s % 1) * 100);
        return `${h}:${m.toString().padStart(2, '0')}:${Math.floor(s).toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
      };
      return `Dialogue: 0,${formatTime(t.start)},${formatTime(t.end)},${capitalized},,0,0,0,,${t.text}`;
    });

    return `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${lines.join('\n')}`;
  }
}

// Config
const ASSETS_DIR = join(__dirname, '../../test-assets');
const OUTPUT_FILE = join(ASSETS_DIR, 'output.mp4');

class VideoComposer {
  async compose(options: any): Promise<Readable> {
    const { audioPath, captionPath, assetPaths, preset, width = 720 } = options;
    const height = Math.round(width * (16 / 9));

    console.log(`[Composer] Rendering: ${width}x${height}...`);

    const audioDuration = await this.getMediaDuration(audioPath);
    const imageCount = assetPaths.length || 1;
    const transitionDuration = 0.5;
    const slideDuration = Math.max(
      3,
      (audioDuration + 0.5 + (imageCount - 1) * transitionDuration) / imageCount,
    );

    return new Promise((resolve, reject) => {
      const command = ffmpeg();
      const complexFilters: string[] = [];
      const videoStreams: string[] = [];

      assetPaths.forEach((img: string) => command.input(img));
      assetPaths.forEach((_: any, i: number) => {
        const frames = Math.ceil((slideDuration + transitionDuration) * 25);
        complexFilters.push(
          `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,zoompan=z='min(zoom+0.0015,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=25[v${i}]`,
        );
        videoStreams.push(`v${i}`);
      });

      let prevStream = videoStreams[0];
      let currentOffset = slideDuration - transitionDuration;
      for (let i = 1; i < videoStreams.length; i++) {
        const outStream = i === videoStreams.length - 1 ? 'v_merged' : `x${i}`;
        complexFilters.push(
          `[${prevStream}][${videoStreams[i]}]xfade=transition=fade:duration=${transitionDuration}:offset=${currentOffset}[${outStream}]`,
        );
        prevStream = outStream;
        currentOffset += slideDuration - transitionDuration;
      }

      const audioIndex = assetPaths.length;
      command.input(audioPath);

      // Robust path escaping for FFmpeg filters
      const escapedCaptionPath = captionPath
        .replace(/\\/g, '/')
        .replace(/:/g, '\\:')
        .replace(/'/g, "'\\''");
      complexFilters.push(`[v_merged]subtitles='${escapedCaptionPath}'[v_final]`);

      command
        .complexFilter(complexFilters)
        .outputOptions([
          '-map [v_final]',
          `-map ${audioIndex}:a`,
          '-c:v libx264',
          `-preset ${preset}`,
          '-crf 23',
          '-c:a aac',
          '-pix_fmt yuv420p',
          '-shortest',
          '-f mp4',
          '-movflags frag_keyframe+empty_moov+default_base_moof',
        ])
        .on('error', (err) => reject(err));

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
}

async function main() {
  const allFiles = readdirSync(ASSETS_DIR);
  const imageFiles = allFiles.filter((f) => f.match(/\.(png|jpg|jpeg)$/i)).sort();
  const assetPaths = imageFiles.map((f) => join(ASSETS_DIR, f));
  const audioPath = join(ASSETS_DIR, 'audio.mp3');
  const srtPath = join(ASSETS_DIR, 'caption.srt');

  const timings = parseSRT(srtPath);
  const provider = new LightAssSubtitleProvider();

  const styles = [
    'bold-stroke',
    'red-highlight',
    'sleek',
    'karaoke-card',
    'majestic',
    'beast',
    'elegant',
  ];
  const testCases = [
    ...styles.map((s) => ({ name: s, preset: s, position: 'bottom' })),
    { name: 'center-bold', preset: 'bold-stroke', position: 'center' },
    { name: 'top-bold', preset: 'bold-stroke', position: 'top' },
  ];

  for (const test of testCases) {
    console.log(`\n--- TESTING STYLE: ${test.name.toUpperCase()} ---`);
    const assPath = join(ASSETS_DIR, `test_${test.name}.ass`);
    const assContent = provider.generateAssContent(timings, {
      preset: test.preset,
      position: test.position,
      timing: 'sentence',
    });
    writeFileSync(assPath, assContent);

    const outputFile = join(ASSETS_DIR, `output_${test.name}.mp4`);
    const composer = new VideoComposer();
    const videoStream = await composer.compose({
      audioPath,
      captionPath: assPath,
      assetPaths,
      preset: 'ultrafast',
      width: 720,
    });

    await streamPipeline(videoStream, createWriteStream(outputFile));
    console.log(`Finished: ${outputFile}`);
  }
}

main().catch(console.error);
