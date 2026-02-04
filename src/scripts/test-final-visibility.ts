import ffmpeg from 'fluent-ffmpeg';
import { existsSync, readdirSync, writeFileSync, readFileSync, createWriteStream } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';

const streamPipeline = promisify(pipeline);

async function main() {
  const ASSETS_DIR = join(__dirname, '../../test-assets');
  const imgPath = join(ASSETS_DIR, '29a86fcf-271e-4140-8acf-ac4172ae7320.jpg');
  const audioPath = join(ASSETS_DIR, 'audio.mp3');

  console.log('--- FINAL CAPTION VISIBILITY TEST ---');

  // 1. Create a very simple ASS file with a 10s caption
  const assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,80,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,4,0,2,10,10,100,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:10.00,Default,,0,0,0,,TEST CAPTION VISIBLE
`;
  const assPath = join(ASSETS_DIR, 'final_test.ass');
  writeFileSync(assPath, assContent);

  const outputFile = join(ASSETS_DIR, 'final_verification.mp4');

  const command = ffmpeg();
  command.input(imgPath).inputOptions(['-loop 1', '-t 10']);
  command.input(audioPath);

  // We use subtitles filter with explicit font file just in case
  const escapedAssPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\''");

  command
    .complexFilter([
      `[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1[bg]`,
      `[bg]subtitles='${escapedAssPath}'[v_final]`,
    ])
    .outputOptions([
      '-map [v_final]',
      '-map 1:a',
      '-c:v libx264',
      '-preset ultrafast',
      '-pix_fmt yuv420p',
      '-t 10',
      '-f mp4',
    ])
    .on('start', (cmd) => console.log(`FFmpeg: ${cmd}`))
    .on('error', (err) => console.error('FFmpeg Error:', err));

  console.log('Rendering 10s test video...');
  await streamPipeline(command.pipe() as any, createWriteStream(outputFile));
  console.log(`Finished: ${outputFile}`);
}

main().catch(console.error);
