
import * as ffmpeg from 'fluent-ffmpeg';
import { writeFileSync, readFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Config
const ASSETS_DIR = join(__dirname, '../../test-assets'); // Root/backend/test-assets
const OUTPUT_FILE = join(ASSETS_DIR, 'output.mp4');

// Interfaces
interface ComposeOptions {
    audio: Buffer;
    caption: Buffer;
    assets: Buffer[]; // Image Buffers
    video?: Buffer;
}

// Ensure FFmpeg is available
// Sometimes fluent-ffmpeg needs explicit path
// ffmpeg.setFfmpegPath('/usr/bin/ffmpeg'); // Uncomment if needed

// --- REPLICATED LOGIC FROM `FFmpegRendererProvider` ---
class VideoComposer {
    async compose(options: ComposeOptions): Promise<Buffer> {
        const tempDir = tmpdir();
        const sessionId = Date.now();
        const audioPath = join(tempDir, `audio-${sessionId}.mp3`);
        const captionPath = join(tempDir, `caption-${sessionId}.srt`);
        const outputPath = join(tempDir, `output-${sessionId}.mp4`);
        const imagePaths: string[] = [];

        console.log(`[Composer] Processing in ${tempDir}`);

        try {
            // 1. Write Audio & Captions
            if (!options.audio) throw new Error('Audio buffer is missing');
            if (!options.caption) throw new Error('Caption buffer is missing');

            writeFileSync(audioPath, options.audio);
            writeFileSync(captionPath, options.caption);
            console.log(`[Composer] Audio written to ${audioPath}`);
            console.log(`[Composer] Captions written to ${captionPath}`);

            // 2. Prepare Video Assets (Images)
            if (options.assets && options.assets.length > 0) {
                for (let i = 0; i < options.assets.length; i++) {
                    const imgPath = join(tempDir, `image-${sessionId}-${i}.png`);
                    writeFileSync(imgPath, options.assets[i]);
                    imagePaths.push(imgPath);
                }
                console.log(`[Composer] Written ${imagePaths.length} images.`);
            } else {
                console.warn('[Composer] No images provided. Output likely blank.');
            }

            // 3. Get Audio Duration to calculate pacing
            const audioDuration = await this.getMediaDuration(audioPath);
            console.log(`[Composer] Audio Duration: ${audioDuration}s`);

            // Calculate duration per slide (ensure min 3s)
            const imageCount = imagePaths.length || 1;
            const slideDuration = audioDuration > 0
                ? Math.max(3, audioDuration / imageCount)
                : 5;

            console.log(`[Composer] Slide Duration calculated: ${slideDuration}s (for ${imageCount} slides)`);

            const transitionDuration = 0.5;

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

                            // Important: offsets are cumulative from start of timeline
                            // Slide 0 ends visibility around slideDuration
                            // We start fading at slideDuration - transitionDuration

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
                // Style: White (&Hffffff), Bold, Fixed margin (MarginV=50), Font Size 16
                console.log(`[Composer] Burning captions from: ${captionPath}`);

                complexFilters.push(
                    `[v_merged]subtitles='${captionPath}':force_style='FontSize=16,PrimaryColour=&Hffffff,OutlineColour=&H000000,BorderStyle=1,Outline=1,Shadow=0,Bold=1,Alignment=2,MarginV=50'[v_final]`
                );

                console.log('[Composer] Constructed Loop Filter graph:', complexFilters.join(';'));

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
                    .on('start', (cmdLine) => {
                        console.log('[Composer] Spawned FFmpeg with command: ' + cmdLine);
                    })
                    .on('end', () => {
                        try {
                            const buffer = readFileSync(outputPath);
                            this.cleanup([audioPath, captionPath, outputPath, ...imagePaths]);
                            resolve(buffer);
                        } catch (err) { reject(err); }
                    })
                    .on('error', (err, stdout, stderr) => {
                        console.error('[Composer] FFmpeg Error:', err.message);
                        console.error('[Composer] FFmpeg Stdout:', stdout);
                        console.error('[Composer] FFmpeg Stderr:', stderr);
                        this.cleanup([audioPath, captionPath, outputPath, ...imagePaths]);
                        reject(err);
                    })
                    .run();

            });

        } catch (error) {
            // this.cleanup([audioPath, captionPath, outputPath, ...imagePaths]);
            throw error;
        }
    }

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
        paths.forEach(p => { try { if (p && existsSync(p)) unlinkSync(p); } catch (e) { } });
    }
}


// --- MAIN EXECUTION ---
async function main() {
    console.log('--- TEST VIDEO RENDERER START ---');
    console.log(`Checking for assets in: ${ASSETS_DIR}`);

    // Checks
    if (!existsSync(ASSETS_DIR)) {
        console.error(`ERROR: Assets directory ${ASSETS_DIR} does not exist.`);
        process.exit(1);
    }

    // Find Audio (audio.mp3)
    let audioPath = join(ASSETS_DIR, 'audio.mp3');
    if (!existsSync(audioPath)) {
        // Try any mp3
        const files = readdirSync(ASSETS_DIR);
        const mp3 = files.find(f => f.endsWith('.mp3'));
        if (mp3) audioPath = join(ASSETS_DIR, mp3);
        else {
            console.error(`ERROR: No audio.mp3 found in ${ASSETS_DIR}`);
            process.exit(1);
        }
    }

    // Find Caption (caption.srt or captions.srt)
    let captionPath = join(ASSETS_DIR, 'caption.srt');
    if (!existsSync(captionPath)) captionPath = join(ASSETS_DIR, 'captions.srt');
    if (!existsSync(captionPath)) {
        // Try any srt
        const files = readdirSync(ASSETS_DIR);
        const srt = files.find(f => f.endsWith('.srt'));
        if (srt) captionPath = join(ASSETS_DIR, srt);
        else {
            console.error(`ERROR: No caption.srt found in ${ASSETS_DIR}`);
            process.exit(1);
        }
    }

    // Find Images (*.png, *.jpg) sorted by name
    const allFiles = readdirSync(ASSETS_DIR);
    const imageFiles = allFiles
        .filter(f => f.match(/\.(png|jpg|jpeg)$/i))
        .sort(); // Sort makes sure 1.png comes before 2.png (usually)

    if (imageFiles.length === 0) {
        console.error(`ERROR: No images found in ${ASSETS_DIR}`);
        process.exit(1);
    }

    console.log(`Found Assets:`);
    console.log(` - Audio: ${audioPath}`);
    console.log(` - Caption: ${captionPath}`);
    console.log(` - Images (${imageFiles.length}): ${imageFiles.join(', ')}`);

    // Read Buffers
    const audioBuffer = readFileSync(audioPath);
    const captionBuffer = readFileSync(captionPath);
    const imageBuffers = imageFiles.map(f => readFileSync(join(ASSETS_DIR, f)));

    // Run Composer
    const composer = new VideoComposer();
    console.log('\nStarting Composition...');
    const resultBuffer = await composer.compose({
        audio: audioBuffer,
        caption: captionBuffer,
        assets: imageBuffers
    });

    console.log(`\nComposition Success! Output size: ${(resultBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // Write Output
    writeFileSync(OUTPUT_FILE, resultBuffer);
    console.log(`Saved result to: ${OUTPUT_FILE}`);
}

main().catch(err => {
    console.error('FATAL ERROR:', err);
    process.exit(1);
});
