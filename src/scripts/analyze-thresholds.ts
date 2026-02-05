import ffmpeg from 'fluent-ffmpeg';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, unlinkSync } from 'fs';

async function analyze() {
  const audioPath = join(process.cwd(), '../render-worker/debug_output/audio.mp3');
  const duration = 40.61;

  const thresholds = [-18, -21, -24, -27, -30];

  for (const db of thresholds) {
    const silences: any[] = [];
    await new Promise<void>((resolve) => {
      ffmpeg(audioPath)
        .audioFilters(`silencedetect=noise=${db}dB:d=0.2`)
        .format('null')
        .on('stderr', (line) => {
          const startMatch = line.match(/silence_start: (\d+(\.\d+)?)/);
          if (startMatch)
            silences.push({ start: parseFloat(startMatch[1]), end: duration, duration: 0 });
          const endMatch = line.match(/silence_end: (\d+(\.\d+)?)/);
          if (endMatch && silences.length > 0) {
            const last = silences[silences.length - 1];
            last.end = parseFloat(endMatch[1]);
            last.duration = last.end - last.start;
          }
        })
        .on('end', () => resolve())
        .on('error', () => resolve())
        .output('/dev/null')
        .run();
    });

    // Calculate speech segments
    const segments: any[] = [];
    let cursor = 0;
    for (const s of silences) {
      if (s.start > cursor + 0.1) {
        segments.push({ start: cursor, end: s.start, len: s.start - cursor });
      }
      cursor = s.end;
    }
    if (cursor < duration - 0.1) {
      segments.push({ start: cursor, end: duration, len: duration - cursor });
    }

    // Logic: Find last segment that isn't isolated noise
    let effectiveEnd = duration;
    for (let i = segments.length - 1; i > 0; i--) {
      const seg = segments[i];
      const prev = segments[i - 1];
      const gap = seg.start - prev.end;

      // If there's a large gap (>1.2s) OR if the segment is very short far from end
      if (gap > 1.2) {
        // Check if everything after this gap is "Small"
        const totalAfter = segments.slice(i).reduce((sum, s) => sum + s.len, 0);
        const timeAfter = duration - seg.start;
        if (totalAfter < 1.0 || totalAfter / timeAfter < 0.2) {
          effectiveEnd = prev.end;
          // Keep searching backwards to find the TRUE end if multiple gaps exist
        }
      }
    }

    console.log(
      `${db}dB: Effective End at ${effectiveEnd.toFixed(2)}s (${segments.length} segments)`,
    );
  }
}

analyze().catch(console.error);
