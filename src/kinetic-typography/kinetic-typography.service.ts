import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScriptProcessorService } from './script-processor.service';
import { DurationAllocatorService } from './duration-allocator.service';
import {
  RemotionKineticQueueService,
  KineticJobPayload,
} from '../render/remotion-kinetic-queue.service';
import { MusicService } from '../media/music.service';
import { User } from '../auth/entities/user.entity';
import { getWatermarkConfig } from '../render/watermark.util';
import { TimelineBlock, AnimationIntensity } from './interfaces/timeline.interface';
import { ScenePlannerService } from './ai/scene-planner.service';
import { SceneIntelligenceService } from './services/scene-intelligence.service';
import { MotionEngineService } from './services/motion-engine.service';
import { LayoutEngineService } from './services/layout-engine.service';
import { SceneRhythmEngineService } from './services/scene-rhythm-engine.service';
import { TransitionManagerService } from './services/transition-manager.service';
import type {
  GraphicMotionTimeline,
  GraphicMotionScene,
  TemplateStyle,
} from './interfaces/graphic-motion.interface';
import { TemplateEngineService } from './services/template-engine.service';
import { getTemplateStyleConfig } from './config/template-style.config';

export interface KineticCreateDto {
  script: string;
  stylePreset?: string;
  animationIntensity?: AnimationIntensity;
  fontFamily?: string;
  highlightWords?: string[];
  credit_cost?: number;
  useGraphicMotionEngine?: boolean;
  format?: 'reels' | 'tiktok' | 'horizontal' | 'square';
  videoStyle?: string;
  globalTone?: string;
  templateStyle?: TemplateStyle;
  /** Optional. Target seconds per scene (framework SCENE_CHANGE_TIME). Rhythm engine uses when provided. */
  targetSecondsPerScene?: number;
  /** Optional. Minimum hold seconds per scene. Rhythm engine uses when provided. */
  minHoldSeconds?: number;
  /** Optional. Background music: id from music library, volume 0–1. */
  music?: { id: string; volume?: number };
}

const FORMAT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  reels: { width: 1080, height: 1920 },
  tiktok: { width: 1080, height: 1920 },
  horizontal: { width: 1920, height: 1080 },
  square: { width: 1080, height: 1080 },
};

const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1920;
const FPS = 30;

@Injectable()
export class KineticTypographyService {
  private readonly logger = new Logger(KineticTypographyService.name);

  constructor(
    private readonly scriptProcessor: ScriptProcessorService,
    private readonly durationAllocator: DurationAllocatorService,
    private readonly kineticQueue: RemotionKineticQueueService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly scenePlanner: ScenePlannerService,
    private readonly sceneIntelligence: SceneIntelligenceService,
    private readonly motionEngine: MotionEngineService,
    private readonly layoutEngine: LayoutEngineService,
    private readonly templateEngine: TemplateEngineService,
    private readonly rhythmEngine: SceneRhythmEngineService,
    private readonly transitionManager: TransitionManagerService,
    private readonly musicService: MusicService,
  ) {}

  /**
   * Build timeline from dto and enqueue render job. Call after project is created.
   * When useGraphicMotionEngine is true, uses AI + engines and graphicMotionTimeline.
   */
  async enqueueRender(projectId: string, userId: string, dto: KineticCreateDto): Promise<string> {
    if (dto.useGraphicMotionEngine) {
      return this.enqueueGraphicMotionRender(projectId, userId, dto);
    }
    return this.enqueueLegacyKineticRender(projectId, userId, dto);
  }

  private async enqueueGraphicMotionRender(
    projectId: string,
    userId: string,
    dto: KineticCreateDto,
  ): Promise<string> {
    const scenePlan = await this.scenePlanner.plan(dto.script, projectId);
    const enhancedScenes = this.sceneIntelligence.enhance(scenePlan.scenes, scenePlan.globalTone);
    const motionConfigs = this.motionEngine.buildMotionConfigs(enhancedScenes);
    const layoutTypes = this.layoutEngine.assignLayouts(enhancedScenes, motionConfigs);
    const templateTypes = this.templateEngine.assignTemplates(enhancedScenes, motionConfigs);
    const targetSecondsPerScene =
      dto.targetSecondsPerScene ?? this.mapPreferredSceneLength(scenePlan.preferredSceneLength);
    const rhythms = this.rhythmEngine.allocate(enhancedScenes, {
      fps: FPS,
      projectId,
      targetSecondsPerScene,
      minHoldSeconds: dto.minHoldSeconds,
    });
    const transitions = this.transitionManager.assignTransitions(
      enhancedScenes.length,
      layoutTypes,
      { projectId, fps: FPS },
    );

    const templateStyle: TemplateStyle = dto.templateStyle ?? 'minimal';
    const styleConfig = getTemplateStyleConfig(templateStyle);

    const { width, height } = dto.format
      ? (FORMAT_DIMENSIONS[dto.format] ?? { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT })
      : { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };

    const scenes: GraphicMotionScene[] = enhancedScenes.map((scene, i) => {
      const words =
        Array.isArray(scene.words) && scene.words.length > 0
          ? scene.words
          : String(scene?.text ?? '')
              .split(/\s+/)
              .filter(Boolean);
      const highlightIndices = this.getHighlightIndices(words, dto.highlightWords ?? []);
      const label = scene.label ?? this.deriveLabel(scene.sceneType, i, enhancedScenes.length);
      return {
        text: scene.text,
        words,
        layoutType: layoutTypes[i]!,
        templateType: templateTypes[i]!,
        motionConfig: motionConfigs[i]!,
        rhythm: rhythms[i]!,
        transitionIn: transitions[i]!,
        highlightWordIndices: highlightIndices.length > 0 ? highlightIndices : undefined,
        label: this.capForRemotion(label, 25),
        subHeadline: this.capForRemotion(scene.subHeadline, 80),
        supportingText: this.capForRemotion(scene.supportingText, 120),
        authorLine: this.capForRemotion(scene.authorLine, 40),
        accentColor: styleConfig.accent.color,
        headlineEmphasis: scene.headlineEmphasis,
      };
    });

    const timeline: GraphicMotionTimeline = {
      width,
      height,
      fps: FPS,
      fontFamily: dto.fontFamily,
      videoStyle: scenePlan.videoStyle,
      globalTone: scenePlan.globalTone,
      templateStyle,
      styleConfig,
      format: dto.format,
      targetSecondsPerScene:
        dto.targetSecondsPerScene ?? this.mapPreferredSceneLength(scenePlan.preferredSceneLength),
      minHoldSeconds: dto.minHoldSeconds,
      scenes,
    };

    let musicBlobId: string | undefined;
    let musicVolume: number | undefined;
    if (dto.music?.id) {
      try {
        const musicEntity = await this.musicService.findById(dto.music.id);
        if (musicEntity?.blob_storage_id) {
          musicBlobId = musicEntity.blob_storage_id;
          musicVolume = typeof dto.music.volume === 'number' ? dto.music.volume : 0.5;
        } else {
          this.logger.warn(
            `Music id ${dto.music.id} has no blob_storage_id, skipping background music`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Failed to resolve music id ${dto.music.id}, skipping background music`,
          err,
        );
      }
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });

    const payload: KineticJobPayload = {
      projectId,
      userId,
      compositionId: 'GraphicMotionComposition',
      monetization: getWatermarkConfig(user?.is_premium ?? false),
      inputProps: {
        graphicMotionTimeline: timeline,
        width,
        height,
        fps: FPS,
        fontFamily: dto.fontFamily,
      },
      ...(musicBlobId && { musicBlobId, musicVolume }),
    };
    return this.kineticQueue.queueKineticJob(payload);
  }

  private async enqueueLegacyKineticRender(
    projectId: string,
    userId: string,
    dto: KineticCreateDto,
  ): Promise<string> {
    const blocksWithoutDuration = this.scriptProcessor.process(dto.script, {
      splitMode: 'sentence',
      defaultPreset: dto.stylePreset ?? 'word-reveal',
    });

    const timeline = this.durationAllocator.allocate(blocksWithoutDuration, {
      fps: FPS,
      intensity: dto.animationIntensity ?? 'medium',
    });

    const withHighlights = this.applyHighlightIndices(timeline, dto.highlightWords ?? []);

    let musicBlobId: string | undefined;
    let musicVolume: number | undefined;
    if (dto.music?.id) {
      try {
        const musicEntity = await this.musicService.findById(dto.music.id);
        if (musicEntity?.blob_storage_id) {
          musicBlobId = musicEntity.blob_storage_id;
          musicVolume = typeof dto.music.volume === 'number' ? dto.music.volume : 0.5;
        }
      } catch {
        // skip music on legacy path
      }
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });

    const payload: KineticJobPayload = {
      projectId,
      userId,
      monetization: getWatermarkConfig(user?.is_premium ?? false),
      inputProps: {
        timeline: withHighlights,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        fps: FPS,
        fontFamily: dto.fontFamily,
      },
      ...(musicBlobId && { musicBlobId, musicVolume }),
    };

    return this.kineticQueue.queueKineticJob(payload);
  }

  /** Trim and cap length so Remotion templates never overflow. Premium pipeline. */
  private capForRemotion(value: string | null | undefined, maxChars: number): string | undefined {
    if (value == null) return undefined;
    const s = String(value).trim();
    if (s.length === 0) return undefined;
    return s.length <= maxChars ? s : s.slice(0, maxChars).trim();
  }

  private mapPreferredSceneLength(v: string | number | undefined): number | undefined {
    if (v == null) return undefined;
    if (typeof v === 'number' && v >= 2 && v <= 10) return v;
    const s = String(v).toLowerCase();
    if (s === 'short') return 2.5;
    if (s === 'medium') return 4.5;
    if (s === 'long') return 6;
    return undefined;
  }

  private deriveLabel(sceneType: string, sceneIndex: number, totalScenes: number): string {
    if (sceneIndex === 0) return 'INTRODUCTION';
    if (sceneIndex === totalScenes - 1) return 'CALL TO ACTION';
    if (sceneType === 'problem') return 'THE PROBLEM';
    if (sceneType === 'feature') return 'FEATURE';
    return '';
  }

  private getHighlightIndices(words: string[], highlightWords: string[]): number[] {
    if (!Array.isArray(words) || highlightWords.length === 0) return [];
    const set = new Set(highlightWords.map((w) => w.trim().toLowerCase()));
    return words.map((w, i) => (set.has(w.toLowerCase()) ? i : -1)).filter((i) => i >= 0);
  }

  private applyHighlightIndices(
    blocks: TimelineBlock[],
    highlightWords: string[],
  ): TimelineBlock[] {
    if (highlightWords.length === 0) return blocks;
    const set = new Set(highlightWords.map((w) => w.trim().toLowerCase()));

    return blocks.map((block) => {
      const indices = block.words
        .map((w, i) => (set.has(w.toLowerCase()) ? i : -1))
        .filter((i) => i >= 0);
      return { ...block, highlightWordIndices: indices.length > 0 ? indices : undefined };
    });
  }
}
