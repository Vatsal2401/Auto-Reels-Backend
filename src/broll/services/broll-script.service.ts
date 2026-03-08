import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BrollMatchResult } from '../entities/broll-match-result.entity';
import { BrollScript } from '../entities/broll-script.entity';
import { CreateScriptDto } from '../dto/create-script.dto';
import { UpdateScriptDto } from '../dto/update-script.dto';
import { OverrideResultDto } from '../dto/override-result.dto';
import { RunScriptDto } from '../dto/run-script.dto';
import { BrollLibraryService } from './broll-library.service';
import { BrollPythonService } from './broll-python.service';

@Injectable()
export class BrollScriptService {
  private readonly logger = new Logger(BrollScriptService.name);

  constructor(
    @InjectRepository(BrollScript)
    private readonly scriptRepo: Repository<BrollScript>,
    @InjectRepository(BrollMatchResult)
    private readonly resultRepo: Repository<BrollMatchResult>,
    private readonly libraryService: BrollLibraryService,
    private readonly brollPythonService: BrollPythonService,
  ) {}

  async createScript(libId: string, userId: string, dto: CreateScriptDto): Promise<BrollScript> {
    await this.libraryService.getLibrary(libId, userId);
    const script = this.scriptRepo.create({
      libraryId: libId,
      userId,
      name: dto.name ?? 'Untitled Script',
      scriptText: dto.scriptText ?? '',
      status: 'draft',
    });
    const saved = await this.scriptRepo.save(script);
    await this.bumpScriptCount(libId, 1);
    return saved;
  }

  async listScripts(libId: string, userId: string): Promise<BrollScript[]> {
    await this.libraryService.getLibrary(libId, userId);
    return this.scriptRepo.find({
      where: { libraryId: libId },
      order: { createdAt: 'DESC' },
    });
  }

  async getScript(libId: string, sid: string, userId: string): Promise<BrollScript> {
    await this.libraryService.getLibrary(libId, userId);
    const script = await this.scriptRepo.findOne({
      where: { id: sid, libraryId: libId },
      relations: ['results'],
    });
    if (!script) throw new NotFoundException('Script not found');
    if (script.userId !== userId) throw new ForbiddenException();
    // Sort results by line_index
    if (script.results) {
      script.results.sort((a, b) => a.lineIndex - b.lineIndex);
    }
    return script;
  }

  async updateScript(
    libId: string,
    sid: string,
    userId: string,
    dto: UpdateScriptDto,
  ): Promise<void> {
    await this.getScript(libId, sid, userId);
    const update: Partial<BrollScript> = {};
    if (dto.name !== undefined) update.name = dto.name;
    if (dto.scriptText !== undefined) update.scriptText = dto.scriptText;
    if (Object.keys(update).length > 0) {
      await this.scriptRepo.update({ id: sid }, update);
    }
  }

  async deleteScript(libId: string, sid: string, userId: string): Promise<void> {
    await this.getScript(libId, sid, userId);
    await this.scriptRepo.delete({ id: sid });
    await this.bumpScriptCount(libId, -1);
  }

  async runScript(
    libId: string,
    sid: string,
    userId: string,
    dto: RunScriptDto,
  ): Promise<BrollScript> {
    const lib = await this.libraryService.getLibrary(libId, userId);
    if (lib.indexedCount === 0) {
      throw new BadRequestException('Library has no indexed videos. Index videos first.');
    }

    const script = await this.getScript(libId, sid, userId);
    const lines = this.parseLines(script.scriptText);
    if (lines.length === 0) {
      throw new BadRequestException('Script has no lines to match');
    }

    await this.scriptRepo.update({ id: sid }, { status: 'running' });

    try {
      const response = await this.brollPythonService.match(lines, dto.topK ?? 2);

      // Delete non-locked existing results
      const lockedResults = await this.resultRepo.find({
        where: { scriptId: sid, isLocked: true },
      });
      const lockedIndexes = new Set(lockedResults.map((r) => r.lineIndex));
      await this.resultRepo
        .createQueryBuilder()
        .delete()
        .where('script_id = :sid AND is_locked = false', { sid })
        .execute();

      // Insert new results (skip locked)
      const toInsert: Partial<BrollMatchResult>[] = [];
      for (let i = 0; i < response.results.length; i++) {
        if (lockedIndexes.has(i)) continue;
        const r = response.results[i];
        const top = r.matches[0];
        const alt = r.matches[1];
        toInsert.push({
          scriptId: sid,
          lineIndex: i,
          scriptLine: r.script_line,
          primaryFilename: top?.filename ?? null,
          primaryS3Key: top?.file_path ?? null,
          primaryFrameTime: top?.frame_time ?? null,
          primaryScore: top?.similarity_score ?? null,
          altFilename: alt?.filename ?? null,
          altFrameTime: alt?.frame_time ?? null,
          altScore: alt?.similarity_score ?? null,
          isLocked: false,
        });
      }
      if (toInsert.length > 0) {
        await this.resultRepo.save(toInsert);
      }

      const matchedLines = response.results.filter((r) => r.matches.length > 0).length;
      await this.scriptRepo.update(
        { id: sid },
        {
          status: 'completed',
          version: script.version + 1,
          totalLines: lines.length,
          matchedLines,
        },
      );
    } catch (err) {
      await this.scriptRepo.update({ id: sid }, { status: 'failed' });
      throw err;
    }

    return this.getScript(libId, sid, userId);
  }

  async overrideResult(
    libId: string,
    sid: string,
    lineIndex: number,
    dto: OverrideResultDto,
    userId: string,
  ): Promise<void> {
    await this.getScript(libId, sid, userId);
    const result = await this.resultRepo.findOne({ where: { scriptId: sid, lineIndex } });
    if (!result) throw new NotFoundException(`Result at line ${lineIndex} not found`);
    await this.resultRepo.update(
      { id: result.id },
      {
        overrideVideoId: dto.overrideVideoId,
        overrideFilename: dto.overrideFilename,
        overrideS3Key: dto.overrideS3Key,
        overrideFrameTime: dto.overrideFrameTime,
        overrideNote: dto.overrideNote ?? null,
      },
    );
  }

  async lockResult(
    libId: string,
    sid: string,
    lineIndex: number,
    locked: boolean,
    userId: string,
  ): Promise<void> {
    await this.getScript(libId, sid, userId);
    const result = await this.resultRepo.findOne({ where: { scriptId: sid, lineIndex } });
    if (!result) throw new NotFoundException(`Result at line ${lineIndex} not found`);
    await this.resultRepo.update({ id: result.id }, { isLocked: locked });
  }

  async exportScript(
    libId: string,
    sid: string,
    format: string,
    userId: string,
  ): Promise<string> {
    const script = await this.getScript(libId, sid, userId);
    const results = (script.results ?? []).sort((a, b) => a.lineIndex - b.lineIndex);

    const getClip = (r: BrollMatchResult) => ({
      filename: r.overrideFilename ?? r.primaryFilename ?? '',
      s3Key: r.overrideS3Key ?? r.primaryS3Key ?? '',
      frameTime: r.overrideFrameTime ?? r.primaryFrameTime ?? 0,
      score: r.primaryScore ?? 0,
      overridden: r.overrideVideoId != null,
    });

    if (format === 'json') {
      const payload = {
        script_id: script.id,
        version: script.version,
        created_at: script.createdAt,
        clips: results.map((r, i) => {
          const clip = getClip(r);
          return {
            line_index: i,
            script_line: r.scriptLine,
            clip: clip.filename,
            start_time: clip.frameTime,
            duration: 5.0,
            score: clip.score,
            overridden: clip.overridden,
          };
        }),
      };
      return JSON.stringify(payload, null, 2);
    }

    if (format === 'edl') {
      const title = `TITLE: ${script.name} v${script.version}`;
      const lines = [title, 'FCM: NON-DROP FRAME', ''];
      let outStart = 0;
      results.forEach((r, i) => {
        const clip = getClip(r);
        const inSec = clip.frameTime;
        const outSec = inSec + 5.0;
        const toTc = (s: number) => {
          const h = Math.floor(s / 3600);
          const m = Math.floor((s % 3600) / 60);
          const sec = Math.floor(s % 60);
          const fr = Math.round((s % 1) * 30);
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
        };
        const num = String(i + 1).padStart(3, '0');
        const name = (clip.filename || 'clip').replace(/\s/g, '_');
        lines.push(
          `${num}  ${name}  V  C  ${toTc(inSec)} ${toTc(outSec)}  ${toTc(outStart)} ${toTc(outStart + 5.0)}`,
        );
        outStart += 5.0;
      });
      return lines.join('\n');
    }

    // Default: CSV
    const header = 'Line,Script Line,Clip,Frame Time (s),Score,Overridden';
    const rows = results.map((r, i) => {
      const clip = getClip(r);
      const line = `${i + 1},"${r.scriptLine.replace(/"/g, '""')}","${clip.filename}",${clip.frameTime},${clip.score.toFixed(3)},${clip.overridden}`;
      return line;
    });
    return [header, ...rows].join('\n');
  }

  private parseLines(text: string): string[] {
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }

  private async bumpScriptCount(libId: string, delta: number): Promise<void> {
    await this.scriptRepo.manager.query(
      `UPDATE broll_libraries SET script_count = GREATEST(0, script_count + $1), updated_at = now() WHERE id = $2`,
      [delta, libId],
    );
  }
}
