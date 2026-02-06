import ffmpeg from 'fluent-ffmpeg';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, unlinkSync, readFileSync } from 'fs';

async function analyze() {
  const audioPath = join(process.cwd(), '../render-worker/debug_output/audio.mp3');

  // Get segments with -26dB
  const silences: any[] = [];
  await new Promise<void>((resolve) => {
    ffmpeg(audioPath)
      .audioFilters('silencedetect=noise=-26dB:d=0.15')
      .format('null')
      .on('stderr', (line) => {
        const startMatch = line.match(/silence_start: (\d+(\.\d+)?)/);
        if (startMatch) silences.push({ start: parseFloat(startMatch[1]), end: 40.61 });
        const endMatch = line.match(/silence_end: (\d+(\.\d+)?)/);
        if (endMatch && silences.length > 0) {
          silences[silences.length - 1].end = parseFloat(endMatch[1]);
        }
      })
      .on('end', () => resolve())
      .on('error', () => resolve())
      .output('/dev/null')
      .run();
  });

  let segments: any[] = [];
  let cursor = 0;
  for (const s of silences) {
    if (s.start > cursor) segments.push({ start: cursor, end: s.start });
    cursor = s.end;
  }
  if (cursor < 40.61) segments.push({ start: cursor, end: 40.61 });

  console.log(`Detected ${segments.length} segments.`);

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const duration = seg.end - seg.start;
    if (duration < 0.1) continue;

    // Detect volume for this segment
    const volume = await new Promise<string>((resolve) => {
      ffmpeg(audioPath)
        .setStartTime(seg.start)
        .setDuration(duration)
        .audioFilters('volumedetect')
        .format('null')
        .on('stderr', (line) => {
          const match = line.match(/max_volume: (-?\d+(\.\d+)?) dB/);
          if (match) resolve(match[1]);
        })
        .on('end', () => {})
        .on('error', () => resolve('0'))
        .output('/dev/null')
        .run();
    });
    console.log(
      `Seg ${i} (${seg.start.toFixed(2)}-${seg.end.toFixed(2)}, len ${duration.toFixed(2)}s): Max Volume ${volume}dB`,
    );
  }
}

analyze().catch(console.error);
