import ffmpeg from 'fluent-ffmpeg';
import { existsSync, readdirSync, writeFileSync, readFileSync, createWriteStream } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';

const streamPipeline = promisify(pipeline);

// --- SRT Parser ---
function parseSRT(srtPath: string): any[] {
  const content = readFileSync(srtPath, 'utf8');
  const blocks = content.trim().split(/\n\s*\n/);
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
    const alignment = config.position === 'top' ? 8 : config.position === 'center' ? 5 : 2;
    const marginV = 50;
    const styleName = 'BoldStroke';

    // Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
    const styleValue = `${styleName},DejaVu Sans,80,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,5,0,${alignment},10,10,${marginV},1`;

    const scriptInfo = `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
ScaledBorderAndShadow: yes`;

    const stylesHeader = `[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ${styleValue}`;

    const formatTime = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      const ms = Math.floor((s % 1) * 100);
      return `${h}:${m.toString().padStart(2, '0')}:${Math.floor(s).toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    const events = `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${timings.map((t) => `Dialogue: 0,${formatTime(t.start)},${formatTime(t.end)},${styleName},,0,0,0,,${t.text}`).join('\n')}`;

    return `${scriptInfo}\n\n${stylesHeader}\n\n${events}`;
  }
}

async function main() {
  const ASSETS_DIR = join(__dirname, '../../test-assets');
  const audioPath = join(ASSETS_DIR, 'audio.mp3');
  const srtPath = join(ASSETS_DIR, 'caption.srt');
  const allFiles = readdirSync(ASSETS_DIR);
  const imageFiles = allFiles.filter((f) => f.match(/\.(png|jpg|jpeg)$/i)).sort();
  const assetPaths = imageFiles.map((f) => join(ASSETS_DIR, f));

  console.log('--- FOCUSED SUBTITLE TEST (CORRECTED FORMAT) ---');

  const timings = parseSRT(srtPath);
  const provider = new LightAssSubtitleProvider();
  const assContent = provider.generateAssContent(timings, {
    preset: 'bold-stroke',
    position: 'center',
  });
  const assPath = join(ASSETS_DIR, 'debug_caption_fixed.ass');
  writeFileSync(assPath, assContent);
  console.log(`Generated ASS: ${assPath}`);

  const outputFile = join(ASSETS_DIR, 'debug_output_fixed.mp4');
  const width = 720;
  const height = 1280;

  const command = ffmpeg();
  assetPaths.forEach((img) => command.input(img));
  command.input(audioPath);

  const complexFilters: string[] = [];
  assetPaths.forEach((_, i) => {
    complexFilters.push(
      `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[v${i}]`,
    );
  });

  const concatStr = assetPaths.map((_, i) => `[v${i}]`).join('');
  complexFilters.push(`${concatStr}concat=n=${assetPaths.length}:v=1:a=0[v_merged]`);

  // Robuster path escaping
  const escapedAssPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\''");
  complexFilters.push(`[v_merged]subtitles='${escapedAssPath}'[v_final]`);

  command
    .complexFilter(complexFilters)
    .outputOptions([
      '-map [v_final]',
      `-map ${assetPaths.length}:a`,
      '-c:v libx264',
      '-preset ultrafast',
      '-pix_fmt yuv420p',
      '-shortest',
      '-f mp4',
    ])
    .on('start', (cmd) => console.log(`FFmpeg: ${cmd}`))
    .on('error', (err) => console.error('FFmpeg Error:', err));

  console.log('Rendering...');
  const outputStream = createWriteStream(outputFile);
  await streamPipeline(command.pipe() as any, outputStream);
  console.log(`Finished: ${outputFile}`);
}

main().catch(console.error);
