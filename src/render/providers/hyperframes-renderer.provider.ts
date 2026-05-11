import { Injectable, Logger } from '@nestjs/common';
import { IVideoRenderer, ComposeOptions, SceneData } from '../interfaces/video-renderer.interface';
import { Readable } from 'stream';
import { writeFileSync, createReadStream, mkdirSync, symlinkSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import ffmpeg from 'fluent-ffmpeg';

// આ service HyperFrames વડે HTML-based animated video બનાવે છે
// Puppeteer + FFmpeg નો ઉપયોગ કરીને HTML ને MP4 માં convert કરે છે
@Injectable()
export class HyperFramesRendererProvider implements IVideoRenderer {
  private readonly logger = new Logger(HyperFramesRendererProvider.name);

  // મુખ્ય method: audio, images અને scenes લઈને final video stream return કરે છે
  async compose(options: ComposeOptions): Promise<Readable> {
    const {
      audioPath,       // audio file નો path
      assetPaths,      // images ના paths
      scenes,          // દરેક scene ની info (caption, duration)
      musicPath,       // background music નો path (optional)
      musicVolume = 0.1,             // music નો volume (default 10%)
      hyperframesTemplate = 'cinematic', // visual style template
    } = options;

    // audio ની કુલ લંબાઈ જાણો, અને 0.5 second extra add કરો
    const audioDuration = await this.getAudioDuration(audioPath);
    const totalDuration = audioDuration + 0.5;

    const sceneCount = assetPaths.length || 1;
    const defaultSceneDuration = totalDuration / sceneCount;

    // દરેક scene ક્યારે start અને end થાય તે calculate કરો
    const sceneTimings = this.buildSceneTimings(scenes, totalDuration, defaultSceneDuration);

    // temporary folder બનાવો જ્યાં બધી files store થશે
    const workDir = join(tmpdir(), `hf-${randomUUID()}`);
    mkdirSync(workDir, { recursive: true });
    this.logger.log(`HyperFrames workDir: ${workDir}`);

    try {
      // audio file ને workDir માં symlink (shortcut) બનાવો
      const audioName = 'audio.mp3';
      symlinkSync(audioPath, join(workDir, audioName));

      // દરેક image ને workDir માં symlink બનાવો
      const imageNames = assetPaths.map((imgPath, i) => {
        const name = `image-${i}.jpg`;
        symlinkSync(imgPath, join(workDir, name));
        return name;
      });

      // background music હોય તો symlink બનાવો
      if (musicPath && existsSync(musicPath)) {
        symlinkSync(musicPath, join(workDir, 'music.mp3'));
      }

      // HyperFrames ને media elements (audio, music) ની JSON info આપો
      const mediaElements = this.buildMediaElements(
        audioName,
        totalDuration,
        musicPath ? 'music.mp3' : null,
        musicVolume,
        totalDuration,
      );

      // HTML page generate કરો જે scenes, captions અને animations show કરે
      const html = this.generateHtml(
        sceneTimings,
        imageNames,
        totalDuration,
        hyperframesTemplate,
        mediaElements,
      );
      writeFileSync(join(workDir, 'index.html'), html, 'utf-8');

      const outputPath = join(workDir, 'output.mp4');
      // Dynamic import: @hyperframes/producer ESM-only package છે, require() થી load ન થાય
      const { createRenderJob, executeRenderJob } = await import('@hyperframes/producer' as string) as any;

      // render job create કરો: 30fps, standard quality, mp4 format
      const job = createRenderJob({ fps: 30, quality: 'standard', format: 'mp4' });

      this.logger.log(`Starting HyperFrames render (${totalDuration.toFixed(1)}s, ${sceneCount} scenes)`);

      // Puppeteer Chrome વડે HTML render કરીને video બનાવો
      await executeRenderJob(job, workDir, outputPath, (j: any, msg: string) => {
        this.logger.log(`HyperFrames [${j.status}] ${msg}`);
      });

      this.logger.log(`HyperFrames render complete → ${outputPath}`);
      // output video file નું readable stream return કરો
      return createReadStream(outputPath);
    } catch (err) {
      // error આવે તો temporary folder delete કરો અને error throw કરો
      this.logger.error(`HyperFrames render failed: ${(err as Error).message}`);
      rmSync(workDir, { recursive: true, force: true });
      throw err;
    }
  }

  // દરેક scene ક્યારે start/end થાય તે calculate કરે છે
  // scenes ની duration ના proportion પ્રમાણે timing divide કરે છે
  private buildSceneTimings(
    scenes: SceneData[] | undefined,
    totalDuration: number,
    defaultSceneDuration: number,
  ): Array<{ start: number; end: number; caption: string }> {
    if (!scenes?.length) {
      // scenes ન હોય તો આખી video એક scene ગણો
      return [{ start: 0, end: totalDuration, caption: '' }];
    }

    const totalWeight = scenes.reduce((sum, s) => sum + (s.duration || 5), 0);
    const timings: Array<{ start: number; end: number; caption: string }> = [];
    let cursor = 0;

    scenes.forEach((scene, i) => {
      // દરેક scene ની duration ના proportion પ્રમાણે time allocate કરો
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

  // HyperFrames ને audio elements નું JSON બનાવે છે
  // voice (narration) અને optional background music include કરે છે
  private buildMediaElements(
    audioName: string,
    audioDuration: number,
    musicName: string | null,
    musicVolume: number,
    totalDuration: number,
  ): string {
    const elements: object[] = [
      {
        elementId: 'voice',  // narration audio
        src: audioName,
        startTime: 0,
        endTime: audioDuration,
        hasAudio: true,
        volume: 1,  // full volume
      },
    ];

    if (musicName) {
      // background music ઓછા volume સાથે add કરો
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

  // HTML page generate કરે છે જે HyperFrames render કરશે
  // scenes, CSS template styles, અને window.__hf protocol include છે
  private generateHtml(
    scenes: Array<{ start: number; end: number; caption: string }>,
    imageNames: string[],
    totalDuration: number,
    template: string,  // cinematic | bold | minimal | neon
    mediaElementsJson: string,
  ): string {
    // દરેક scene ના HTML div બનાવો (image + caption)
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

  /* દરેક scene initially hidden, visible class add થાય ત્યારે show થાય */
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

  /* caption નો base style */
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

  /* cinematic template: નીચે dark gradient overlay */
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

  /* bold template: caption ની background dark box */
  body.bold .caption {
    background: rgba(0,0,0,0.65);
    border-radius: 12px;
    padding: 14px 20px;
    font-size: 46px;
  }

  /* minimal template: clean, simple text */
  body.minimal .caption {
    font-size: 38px;
    font-weight: 700;
    letter-spacing: -0.5px;
    text-shadow: 0 1px 6px rgba(0,0,0,1);
  }

  /* neon template: glowing cyan color */
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

  // window.__hf: HyperFrames producer ને video control આપવા માટેનો protocol
  window.__hf = {
    duration: totalDuration,
    // seek(t): time 't' પર કઈ scene visible હોવી જોઈએ તે decide કરે
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

  // page load થાય ત્યારે first scene show કરો
  window.__hf.seek(0);
</script>
</body>
</html>`;
  }

  // HTML special characters escape કરે છે (XSS prevent કરવા)
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ffprobe વડે audio file ની duration (seconds માં) જાણે છે
  private getAudioDuration(path: string): Promise<number> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(path, (err, metadata) => {
        if (err || !metadata) resolve(30); // error આવે તો default 30 seconds
        else resolve(metadata.format.duration || 30);
      });
    });
  }
}
