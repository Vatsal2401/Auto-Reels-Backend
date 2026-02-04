import { Injectable } from '@nestjs/common';
import { IVideoRenderer, ComposeOptions } from '../interfaces/video-renderer.interface';
import ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';

@Injectable()
export class FFmpegRendererProvider implements IVideoRenderer {
  async compose(options: ComposeOptions): Promise<Readable> {
    const { audioPath, captionPath, assetPaths } = options;

    try {
      // 1. Get Audio Duration to calculate pacing
      const audioDuration = await this.getMediaDuration(audioPath);

      // Calculate duration per slide accounting for overlapping transitions
      // With xfade: total_duration = slideDuration + (imageCount - 1) * (slideDuration - transitionDuration)
      // Solving for slideDuration: slideDuration = (audioDuration + (imageCount - 1) * transitionDuration) / imageCount
      const imageCount = assetPaths.length || 1;

      // Use rendering hints for pacing if available
      const pacing = options.rendering_hints?.pacing || 'moderate';
      let transitionDuration = 0.5;
      if (pacing === 'fast') transitionDuration = 0.3;
      if (pacing === 'slow') transitionDuration = 1.0;

      // Add a small buffer (0.5s) to ensure video is slightly longer than audio to prevent cutting off
      const audioDurationWithBuffer = audioDuration + 0.5;

      let slideDuration: number;
      if (imageCount > 1) {
        // Account for overlapping transitions
        slideDuration =
          (audioDurationWithBuffer + (imageCount - 1) * transitionDuration) / imageCount;
      } else {
        // Single image, just match audio duration
        slideDuration = audioDurationWithBuffer;
      }

      slideDuration = Math.max(3, slideDuration); // Ensure minimum 3s per slide

      return new Promise((resolve, reject) => {
        const command = ffmpeg();
        const complexFilters: string[] = [];
        const videoStreams: string[] = [];

        // --- SLIDESHOW MODE (Images -> Video) ---
        if (assetPaths.length > 0) {
          // Input all images
          assetPaths.forEach((img) => command.input(img));

          // Create ZoomPan + Scale filters for each image
          assetPaths.forEach((_, i) => {
            const effect = this.getRandomKenBurnsEffect();
            // ZoomPan needs frames logic. `d` is duration in frames. 25fps.
            // We extend duration by transitionDuration to overlap
            const frames = Math.ceil((slideDuration + transitionDuration) * 25);

            // [i:v] -> scale -2:1280 (height fit) -> crop 720:1280 -> zoompan -> [v{i}]
            // Optimized for 720p for memory stability on 512MB RAM
            complexFilters.push(
              `[${i}:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,` +
                `zoompan=${effect}d=${frames}:s=720x1280:fps=25[v${i}]`,
            );
            videoStreams.push(`v${i}`);
          });

          // Chain XFADE Transitions
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
            // Case for single image
            complexFilters.push(`[v0]copy[v_merged]`);
          }
        } else {
          // No Assets? Create Blank.
          command.input('color=c=black:s=720x1280:d=' + (audioDuration || 30)).inputFormat('lavfi');
          complexFilters.push(`[0:v]null[v_merged]`);
        }

        // --- FINAL COMPOSITION ---
        // Audio Inputs
        // 1. Voiceover (always present at audioIndex)
        const voiceoverIndex = assetPaths.length > 0 ? assetPaths.length : 1;
        command.input(audioPath);

        // 2. Background Music (optional)
        let audioOutput = `${voiceoverIndex}:a`; // Default to just voiceover

        if (options.musicPath) {
          const musicIndex = voiceoverIndex + 1;
          command.input(options.musicPath);

          // Configure Music Volume and Loop
          // volume=0.1 [music]; [music] aloop=loop=-1:size=2e+09 [looped_music]; [looped_music] apad [padded_music];
          // amix=inputs=2:duration=first:dropout_transition=2 [a_out]
          // note: 'duration=first' ensures we end when voiceover ends (plus buffer)

          const musicVolume = options.musicVolume || 0.1;

          complexFilters.push(
            `[${musicIndex}:a]volume=${musicVolume},aloop=loop=-1:size=2e+09[music_looped]`,
            `[${voiceoverIndex}:a][music_looped]amix=inputs=2:duration=first:dropout_transition=2[a_mixed]`,
          );

          audioOutput = 'a_mixed';
        }

        // Burn Captions on 'v_merged'
        // Using force_style for maximum reliability and visibility
        if (captionPath.endsWith('.ass')) {
          complexFilters.push(`[v_merged]subtitles='${captionPath}'[v_final]`);
        } else {
          const alignment =
            options.captions?.position === 'top'
              ? 8
              : options.captions?.position === 'center'
                ? 5
                : 2;
          const marginV =
            options.captions?.position === 'top'
              ? 100
              : options.captions?.position === 'center'
                ? 50
                : 100;

          complexFilters.push(
            `[v_merged]subtitles='${captionPath}':force_style='FontName=DejaVu Sans,FontSize=60,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,BorderStyle=1,Outline=2,Shadow=0,Bold=1,Alignment=${alignment},MarginV=${marginV}'[v_final]`,
          );
        }

        command
          .complexFilter(complexFilters)
          .outputOptions([
            '-map [v_final]',
            `-map [${audioOutput}]`, // Map mixed audio
            '-c:v libx264',
            '-preset fast',
            '-crf 23',
            '-c:a aac',
            '-b:a 192k',
            '-pix_fmt yuv420p',
            '-shortest', // Stop when shortest stream ends (usually video which matches voiceover duration)
            '-f mp4',
            '-movflags frag_keyframe+empty_moov+default_base_moof',
          ])
          .on('start', (commandLine) => {
            console.log('Spawned FFmpeg with command: ' + commandLine);
          })
          .on('error', (err) => {
            reject(err);
          });

        // Use streaming output instead of writing to file
        resolve(command.pipe() as any);
      });
    } catch (error) {
      throw error;
    }
  }

  // --- HELPER METHODS ---

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

  private cleanup(): void {
    // Deprecated in favor of session-based cleanup in GenerationService
  }
}
