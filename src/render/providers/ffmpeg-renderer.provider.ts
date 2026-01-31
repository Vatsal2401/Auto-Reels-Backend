import { Injectable } from '@nestjs/common';
import { IVideoRenderer, ComposeOptions } from '../interfaces/video-renderer.interface';
import ffmpeg from 'fluent-ffmpeg';
import { writeFileSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

@Injectable()
export class FFmpegRendererProvider implements IVideoRenderer {
  async compose(options: ComposeOptions): Promise<Buffer> {
    const tempDir = tmpdir();
    const sessionId = Date.now();
    const audioPath = join(tempDir, `audio-${sessionId}.mp3`);
    const captionPath = join(tempDir, `caption-${sessionId}.srt`);
    const outputPath = join(tempDir, `output-${sessionId}.mp4`);
    const imagePaths: string[] = [];

    try {
      // 1. Write Audio & Captions
      writeFileSync(audioPath, options.audio);
      writeFileSync(captionPath, options.caption);

      // 2. Prepare Video Assets (Images)
      if (options.assets && options.assets.length > 0) {
        for (let i = 0; i < options.assets.length; i++) {
          const imgPath = join(tempDir, `image-${sessionId}-${i}.png`);
          writeFileSync(imgPath, options.assets[i]);
          imagePaths.push(imgPath);
        }
      }

      // 3. Get Audio Duration to calculate pacing
      const audioDuration = await this.getMediaDuration(audioPath);
      
      // Calculate duration per slide accounting for overlapping transitions
      // With xfade: total_duration = slideDuration + (imageCount - 1) * (slideDuration - transitionDuration)
      // Solving for slideDuration: slideDuration = (audioDuration + (imageCount - 1) * transitionDuration) / imageCount
      const imageCount = imagePaths.length || 1;
      const transitionDuration = 0.5;
      
      // Add a small buffer (0.5s) to ensure video is slightly longer than audio to prevent cutting off
      const audioDurationWithBuffer = audioDuration + 0.5;
      
      let slideDuration: number;
      if (imageCount > 1) {
        // Account for overlapping transitions
        slideDuration = (audioDurationWithBuffer + (imageCount - 1) * transitionDuration) / imageCount;
      } else {
        // Single image, just match audio duration
        slideDuration = audioDurationWithBuffer;
      }
      
      slideDuration = Math.max(3, slideDuration); // Ensure minimum 3s per slide

      return new Promise((resolve, reject) => {
        let command = ffmpeg();
        const complexFilters: string[] = [];
        const videoStreams: string[] = [];

        // --- SLIDESHOW MODE (Images -> Video) ---
        if (imagePaths.length > 0) {
          // Input all images
          imagePaths.forEach(img => command.input(img));

          // Create ZoomPan + Scale filters for each image
          imagePaths.forEach((_, i) => {
            const effect = this.getRandomKenBurnsEffect();
            // ZoomPan needs frames logic. `d` is duration in frames. 25fps.
            // We extend duration by transitionDuration to overlap
            const frames = Math.ceil((slideDuration + transitionDuration) * 25);

            // [i:v] -> scale -2:1920 (height fit) -> crop 1080:1920 -> zoompan -> [v{i}]
            // We force aspect ratio preservation then crop to vertical.
            // "setsar=1" ensures pixel aspect ratio is square.
            complexFilters.push(
              `[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,` +
              `zoompan=${effect}d=${frames}:s=1080x1920:fps=25[v${i}]`
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

              // offset needs to be cumulative
              // Slide 0 ends at T = slideDuration
              // Slide 1 starts at T = slideDuration - transitionDuration

              complexFilters.push(
                `[${prevStream}][${nextStream}]xfade=transition=fade:duration=${transitionDuration}:offset=${currentOffset}[${outStream}]`
              );

              prevStream = outStream;
              currentOffset += (slideDuration - transitionDuration);
            }
          } else {
            // Case for single image
            complexFilters.push(`[v0]copy[v_merged]`);
          }

        } else if (options.video) {
          // Legacy/Video Mode (if we still pass a video buffer)
          const videoPath = join(tempDir, `video-${sessionId}.mp4`);
          writeFileSync(videoPath, options.video);
          command.input(videoPath).inputOptions(['-stream_loop', '-1']);
          complexFilters.push(`[0:v]copy[v_merged]`); // Just map it
          // Note: If reusing logic, we might need scaling here too.
          // But let's assume Video-Mode is disabled/deprecated or handles itself.
          // For now, simple passthrough to v_merged to support subtitles.
        } else {
          // No Assets? Create Blank.
          command.input('color=c=black:s=1080x1920:d=' + (audioDuration || 30)).inputFormat('lavfi');
          complexFilters.push(`[0:v]null[v_merged]`);
        }

        // --- FINAL COMPOSITION ---
        // Audio Input is next available index (after all images)
        const audioIndex = imagePaths.length > 0 ? imagePaths.length : (options.video ? 1 : 1);
        command.input(audioPath);

        // Burn Captions on 'v_merged'
        // Style locked: White (&Hffffff), Bold, Fixed margin (MarginV=50), Font Size 16
        complexFilters.push(
          `[v_merged]subtitles=${captionPath}:force_style='FontSize=16,PrimaryColour=&Hffffff,OutlineColour=&H000000,BorderStyle=1,Outline=1,Shadow=0,Bold=1,Alignment=2,MarginV=50'[v_final]`
        );

        command
          .complexFilter(complexFilters)
          .outputOptions([
            '-map [v_final]',
            `-map ${audioIndex}:a`, // Map audio correctly
            '-c:v libx264', '-preset fast', '-crf 23',
            '-c:a aac', '-b:a 192k',
            '-pix_fmt yuv420p',
            '-shortest',        // Stop when audio ends
            '-movflags +faststart'
          ])
          .output(outputPath)
          .on('end', () => {
            try {
              resolve(readFileSync(outputPath));
            } catch (err) { reject(err); }
            finally { this.cleanup([audioPath, captionPath, outputPath, ...imagePaths]); }
          })
          .on('error', (err) => {
            this.cleanup([audioPath, captionPath, outputPath, ...imagePaths]);
            reject(err);
          })
          .run();

      });

    } catch (error) {
      this.cleanup([audioPath, captionPath, outputPath, ...imagePaths]);
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
      "z=1.2:x='if(eq(on,1),iw-iw/zoom,max(x-1,0))':y='(ih-ih/zoom)/2':"
    ];
    return effects[Math.floor(Math.random() * effects.length)];
  }

  private cleanup(paths: string[]): void {
    paths.forEach(p => { try { if (p) unlinkSync(p); } catch (e) { } });
  }
}
