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

      const text = lines.slice(2).join(' ').trim();
      const start = parseTime(timeMatch[1]);
      const end = parseTime(timeMatch[2]);
      const duration = end - start;

      // Mock word timings for karaoke
      const words = text.split(' ').map((w) => ({
        word: w,
        durationMs: Math.round((duration / text.split(' ').length) * 1000),
      }));

      return { start, end, text, words };
    })
    .filter((b) => b !== null);
}

// --- Replica of Production AssSubtitleProvider Logic ---
class ProductionMirrorAssProvider {
  generateAssContent(timings: any[], config: any): string {
    const alignment = config.position === 'top' ? 8 : config.position === 'center' ? 5 : 2;
    const marginV = config.position === 'top' ? 100 : config.position === 'center' ? 50 : 150;
    const format =
      'Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding';
    const common = `-1,0,0,0,100,100,0,0,1`;
    const margins = `10,10,${marginV},1`;

    const styles: Record<string, string> = {
      BoldStroke: `BoldStroke,DejaVu Sans,70,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,${common},4,0,${alignment},${margins}`,
      RedHighlight: `RedHighlight,DejaVu Sans,70,&H00FFFFFF,&H000000FF,&H000000FF,&H000000FF,${common},4,1,${alignment},${margins}`,
      Sleek: `Sleek,DejaVu Sans,70,&H00FFFFFF,&H000000FF,&H00000000,&H00FFFFFF,${common},0,3,${alignment},${margins}`,
      KaraokeCard: `KaraokeCard,DejaVu Sans,60,&H00FFFFFF,&H000000FF,&H00000000,&H00FF00FF,${common},3,0,${alignment},${margins}`,
      Majestic: `Majestic,DejaVu Sans,80,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,${common},1,4,${alignment},${margins}`,
      Beast: `Beast,DejaVu Sans,85,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,1,1,0,100,100,0,0,1,5,0,${alignment},${margins}`,
      Elegant: `Elegant,DejaVu Serif,55,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,1,${alignment},${margins}`,
    };

    const presetKey = config.preset
      .split('-')
      .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('');
    const styleLine = styles[presetKey] || styles.BoldStroke;
    const styleName = styleLine.split(',')[0];

    const formatTime = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      const ms = Math.floor((s % 1) * 100);
      return `${h}:${m.toString().padStart(2, '0')}:${Math.floor(s).toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    const events = timings
      .map((t) => {
        let text = t.text;
        if (config.timing === 'word' && t.words) {
          text = t.words
            .map((w: any) => `{\\k${Math.round(w.durationMs / 10)}}${w.word}`)
            .join(' ');
        }
        return `Dialogue: 0,${formatTime(t.start)},${formatTime(t.end)},${styleName},,0,0,0,,${text}`;
      })
      .join('\n');

    return `[Script Info]\nScriptType: v4.00+\nPlayResX: 720\nPlayResY: 1280\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: ${format}\nStyle: ${styleLine}\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${events}`;
  }
}

async function renderCase(
  test: any,
  ASSETS_DIR: string,
  audioPath: string,
  assetPaths: string[],
  timings: any[],
) {
  const provider = new ProductionMirrorAssProvider();
  const assContent = provider.generateAssContent(timings, {
    preset: test.preset,
    position: test.position,
    timing: test.timing || 'sentence',
  });
  const assPath = join(ASSETS_DIR, `verify_${test.name}.ass`);
  writeFileSync(assPath, assContent);

  const outputFile = join(ASSETS_DIR, `verify_${test.name}.mp4`);

  const command = ffmpeg();
  assetPaths.forEach((img) => command.input(img).inputOptions(['-loop 1', '-t 3']));
  command.input(audioPath);

  const complexFilters: string[] = [];
  assetPaths.forEach((_, i) => {
    complexFilters.push(
      `[${i}:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1[v${i}]`,
    );
  });
  const concatStr = assetPaths.map((_, i) => `[v${i}]`).join('');
  complexFilters.push(`${concatStr}concat=n=${assetPaths.length}:v=1:a=0[v_merged]`);
  complexFilters.push(`[v_merged]subtitles='${assPath}'[v_final]`);

  return new Promise((resolve, reject) => {
    command
      .complexFilter(complexFilters)
      .outputOptions([
        '-map [v_final]',
        `-map ${assetPaths.length}:a`,
        '-c:v libx264',
        '-preset ultrafast',
        '-pix_fmt yuv420p',
        '-t 9',
        '-f mp4',
      ])
      .on('start', (cmd) => console.log(`Started ${test.name}`))
      .on('error', (err, stdout, stderr) => {
        console.error(`FFmpeg Error for ${test.name}:`, stderr);
        reject(err);
      })
      .on('end', () => resolve(outputFile));

    command.save(outputFile);
  });
}

async function main() {
  const ASSETS_DIR = join(__dirname, '../../test-assets');
  const audioPath = join(ASSETS_DIR, 'audio.mp3');
  const srtPath = join(ASSETS_DIR, 'caption.srt');
  const imageFiles = readdirSync(ASSETS_DIR)
    .filter((f) => f.match(/\.(png|jpg|jpeg)$/i))
    .slice(0, 3);
  const assetPaths = imageFiles.map((f) => join(ASSETS_DIR, f));
  const timings = parseSRT(srtPath).slice(0, 10);

  const testCases = [
    { name: 'karaoke-card', preset: 'karaoke-card', position: 'bottom', timing: 'word' },
    { name: 'bold-stroke', preset: 'bold-stroke', position: 'bottom' },
  ];

  console.log(`--- TESTING KARAOKE ---`);
  for (const test of testCases) {
    try {
      await renderCase(test, ASSETS_DIR, audioPath, assetPaths, timings);
      console.log(`✅ Success: ${test.name}`);
    } catch (err) {
      console.error(`❌ Failed: ${test.name}`);
    }
  }
}

main().catch(console.error);
