import { Injectable, Logger } from '@nestjs/common';

export interface AssTiming {
  text: string;
  start: number; // seconds
  end: number; // seconds
  words?: Array<{
    word: string;
    durationMs: number;
  }>;
}

export interface AssConfig {
  preset: string;
  position: 'top' | 'bottom' | 'center';
  timing: 'sentence' | 'word';
}

@Injectable()
export class AssSubtitleProvider {
  private readonly logger = new Logger(AssSubtitleProvider.name);

  generateAssContent(timings: AssTiming[], config: AssConfig): string {
    const sections = [
      this.getScriptInfo(),
      this.getStyles(config),
      this.getEvents(timings, config),
    ];
    return sections.join('\n\n');
  }

  private getScriptInfo(): string {
    return `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
ScaledBorderAndShadow: yes`;
  }

  private getStyles(config: AssConfig): string {
    let alignment = 2; // Bottom Center
    let marginV = 150;

    if (config.position === 'top') {
      alignment = 8;
      marginV = 100;
    } else if (config.position === 'center') {
      alignment = 5;
      marginV = 50;
    }

    // Standard ASS v4+ Style Format (23 fields)
    const format =
      'Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding';

    // Default values for common fields
    const common = `-1,0,0,0,100,100,0,0,1`; // Bold, Italic, Underline, Strikeout, ScaleX, ScaleY, Spacing, Angle, BorderStyle
    const margins = `10,10,${marginV},1`; // MarginL, MarginR, MarginV, Encoding

    const styles: Record<string, string> = {
      // Name, Font, Size, Color1, Color2, Color3, Color4, ...common, Outline, Shadow, Align, ...margins
      BoldStroke: `BoldStroke,DejaVu Sans,70,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,${common},4,0,${alignment},${margins}`,
      RedHighlight: `RedHighlight,DejaVu Sans,70,&H00FFFFFF,&H000000FF,&H000000FF,&H000000FF,${common},4,1,${alignment},${margins}`,
      Sleek: `Sleek,DejaVu Sans,70,&H00FFFFFF,&H000000FF,&H00000000,&H00FFFFFF,${common},0,3,${alignment},${margins}`,
      KaraokeCard: `KaraokeCard,DejaVu Sans,60,&H0000FFFF,&H00FFFFFF,&H00000000,&H00800080,-1,0,0,0,100,100,0,0,3,0,0,${alignment},${margins}`,
      Majestic: `Majestic,DejaVu Sans,80,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,${common},1,4,${alignment},${margins}`,
      Beast: `Beast,DejaVu Sans,85,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,1,1,0,100,100,0,0,1,5,0,${alignment},${margins}`,
      Elegant: `Elegant,DejaVu Serif,55,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,1,${alignment},${margins}`,
    };

    const selectedStyleLine = styles[this.capitalizePreset(config.preset)] || styles['BoldStroke'];

    return `[V4+ Styles]
Format: ${format}
Style: ${selectedStyleLine}`;
  }

  private capitalizePreset(preset: string): string {
    return preset
      .split('-')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('');
  }

  private getEvents(timings: AssTiming[], config: AssConfig): string {
    const styleName = this.capitalizePreset(config.preset);
    const lines = timings.map((t) => {
      const start = this.formatTime(t.start);
      const end = this.formatTime(t.end);
      let text = t.text;

      if (config.timing === 'word' && t.words && t.words.length > 0) {
        text = t.words.map((w) => `{\\k${Math.round(w.durationMs / 10)}}${w.word}`).join(' ');
      }

      return `Dialogue: 0,${start},${end},${styleName},,0,0,0,,${text}`;
    });

    return `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${lines.join('\n')}`;
  }

  private formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const ms = Math.floor((s % 1) * 100);
    return `${h}:${m.toString().padStart(2, '0')}:${Math.floor(s).toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
}
