import { Injectable, Logger } from '@nestjs/common';
import { IVideoRenderer, ComposeOptions, SceneData } from '../interfaces/video-renderer.interface';
import { Readable } from 'stream';
import { writeFileSync, createReadStream, mkdirSync, symlinkSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import ffmpeg from 'fluent-ffmpeg';

@Injectable()
export class HyperFramesRendererProvider implements IVideoRenderer {
  private readonly logger = new Logger(HyperFramesRendererProvider.name);

  async compose(options: ComposeOptions): Promise<Readable> {
    const {
      audioPath,
      assetPaths,
      scenes,
      musicPath,
      musicVolume = 0.1,
      hyperframesTemplate = 'cinematic',
    } = options;

    const audioDuration = await this.getAudioDuration(audioPath);
    const totalDuration = audioDuration + 0.5;

    const sceneCount = assetPaths.length || 1;
    const defaultSceneDuration = totalDuration / sceneCount;

    const sceneTimings = this.buildSceneTimings(scenes, totalDuration, defaultSceneDuration);

    const workDir = join(tmpdir(), `hf-${randomUUID()}`);
    mkdirSync(workDir, { recursive: true });
    this.logger.log(`HyperFrames workDir: ${workDir}`);

    try {
      // Symlink assets into workDir so HyperFrames file server can serve them
      const audioName = 'audio.mp3';
      symlinkSync(audioPath, join(workDir, audioName));

      const imageNames = assetPaths.map((imgPath, i) => {
        const name = `image-${i}.jpg`;
        symlinkSync(imgPath, join(workDir, name));
        return name;
      });

      if (musicPath && existsSync(musicPath)) {
        symlinkSync(musicPath, join(workDir, 'music.mp3'));
      }

      const mediaElements = this.buildMediaElements(
        audioName,
        totalDuration,
        musicPath ? 'music.mp3' : null,
        musicVolume,
        totalDuration,
      );

      const html = this.generateHtml(
        sceneTimings,
        imageNames,
        totalDuration,
        hyperframesTemplate,
        mediaElements,
      );
      writeFileSync(join(workDir, 'index.html'), html, 'utf-8');

      const outputPath = join(workDir, 'output.mp4');
      // Dynamic import required: @hyperframes/producer is ESM-only and cannot be require()'d
      const { createRenderJob, executeRenderJob } = await import('@hyperframes/producer' as string) as any;
      const job = createRenderJob({ fps: 30, quality: 'standard', format: 'mp4' });

      this.logger.log(`Starting HyperFrames render (${totalDuration.toFixed(1)}s, ${sceneCount} scenes)`);
      await executeRenderJob(job, workDir, outputPath, (j: any, msg: string) => {
        this.logger.log(`HyperFrames [${j.status}] ${msg}`);
      });

      this.logger.log(`HyperFrames render complete → ${outputPath}`);
      return createReadStream(outputPath);
    } catch (err) {
      // Clean up on error; on success the caller streams the file and session cleanup handles the rest
      this.logger.error(`HyperFrames render failed: ${(err as Error).message}`);
      rmSync(workDir, { recursive: true, force: true });
      throw err;
    }
  }

  private buildSceneTimings(
    scenes: SceneData[] | undefined,
    totalDuration: number,
    defaultSceneDuration: number,
  ): Array<{ start: number; end: number; caption: string }> {
    if (!scenes?.length) {
      return [{ start: 0, end: totalDuration, caption: '' }];
    }

    // Use proportional timing based on scene duration weights
    const totalWeight = scenes.reduce((sum, s) => sum + (s.duration || 5), 0);
    const timings: Array<{ start: number; end: number; caption: string }> = [];
    let cursor = 0;

    scenes.forEach((scene, i) => {
      const weight = (scene.duration || defaultSceneDuration) / totalWeight;
      const duration = weight * totalDuration;
      timings.push({
        start: cursor,
        end: i === scenes.length - 1 ? totalDuration : cursor + duration,
        caption: scene.audio_text || '',
      });
      cursor += duration;
    });

    return timings;
  }

  private buildMediaElements(
    audioName: string,
    audioDuration: number,
    musicName: string | null,
    musicVolume: number,
    totalDuration: number,
  ): string {
    const elements: object[] = [
      {
        elementId: 'voice',
        src: audioName,
        startTime: 0,
        endTime: audioDuration,
        hasAudio: true,
        volume: 1,
      },
    ];

    if (musicName) {
      elements.push({
        elementId: 'music',
        src: musicName,
        startTime: 0,
        endTime: totalDuration,
        hasAudio: true,
        volume: musicVolume,
      });
    }

    return JSON.stringify(elements);
  }

  private generateHtml(
    scenes: Array<{ start: number; end: number; caption: string }>,
    imageNames: string[],
    totalDuration: number,
    template: string,
    mediaElementsJson: string,
  ): string {
    const sceneHtml = scenes
      .map(
        (s, i) => `
  <div class="scene" id="s${i}">
    <img src="${imageNames[i] || imageNames[0]}" alt="" />
    ${s.caption ? `<div class="caption">${this.escapeHtml(s.caption)}</div>` : ''}
  </div>`,
      )
      .join('');

    const hasMusic = mediaElementsJson.includes('"music"');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 720px; height: 1280px; overflow: hidden; background: #000; }

  .scene {
    position: absolute; inset: 0;
    opacity: 0;
    transition: opacity 0.4s ease;
  }
  .scene.visible { opacity: 1; }

  .scene img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
  }

  /* Caption styles */
  .caption {
    position: absolute;
    left: 24px; right: 24px; bottom: 120px;
    text-align: center;
    font-family: 'Arial Black', Arial, sans-serif;
    font-size: 42px;
    font-weight: 900;
    line-height: 1.25;
    color: #fff;
    word-break: break-word;
  }

  /* Template: cinematic */
  body.cinematic .scene::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 50%);
    pointer-events: none;
  }
  body.cinematic .caption {
    text-shadow: 0 2px 12px rgba(0,0,0,0.9);
    bottom: 120px;
  }

  /* Template: bold */
  body.bold .caption {
    background: rgba(0,0,0,0.65);
    border-radius: 12px;
    padding: 14px 20px;
    font-size: 46px;
  }

  /* Template: minimal */
  body.minimal .caption {
    font-size: 38px;
    font-weight: 700;
    letter-spacing: -0.5px;
    text-shadow: 0 1px 6px rgba(0,0,0,1);
  }

  /* Template: neon */
  body.neon .caption {
    color: #00f0ff;
    text-shadow:
      0 0 8px #00f0ff,
      0 0 24px #00f0ff,
      0 2px 8px rgba(0,0,0,0.8);
    font-size: 44px;
  }
</style>
</head>
<body class="${template}">
${sceneHtml}

<audio id="voice" src="audio.mp3" preload="auto"></audio>
${hasMusic ? '<audio id="music" src="music.mp3" preload="auto"></audio>' : ''}

<script>
  var scenes = ${JSON.stringify(scenes.map((s) => ({ start: s.start, end: s.end })))};
  var totalDuration = ${totalDuration};

  window.__hf = {
    duration: totalDuration,
    seek: function(t) {
      for (var i = 0; i < scenes.length; i++) {
        var el = document.getElementById('s' + i);
        if (!el) continue;
        if (t >= scenes[i].start && t < scenes[i].end) {
          el.classList.add('visible');
        } else {
          el.classList.remove('visible');
        }
      }
    },
    media: ${mediaElementsJson}
  };

  // Show first scene immediately
  window.__hf.seek(0);
</script>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private getAudioDuration(path: string): Promise<number> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(path, (err, metadata) => {
        if (err || !metadata) resolve(30);
        else resolve(metadata.format.duration || 30);
      });
    });
  }
}
