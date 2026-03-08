import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface PythonMatchResult {
  script_line: string;
  matches: {
    filename: string;
    file_path: string;
    frame_time: number;
    similarity_score: number;
    duration_seconds: number | null;
  }[];
}

export interface PythonMatchResponse {
  results: PythonMatchResult[];
  csv: string;
}

@Injectable()
export class BrollPythonService {
  private readonly logger = new Logger(BrollPythonService.name);
  private readonly serverUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.serverUrl = this.configService.get<string>('BROLL_PYTHON_URL', 'http://localhost:8001');
  }

  async ingestFromUrl(url: string, filename: string, videoId?: string): Promise<void> {
    axios
      .post(`${this.serverUrl}/ingest/from-url`, { url, filename, video_id: videoId }, { timeout: 10_000 })
      .catch((err) => {
        this.logger.error(
          `BrollPythonService.ingestFromUrl: failed for ${filename}: ${(err as Error)?.message}`,
        );
      });
  }

  async match(scriptLines: string[], topK = 2): Promise<PythonMatchResponse> {
    try {
      const res = await axios.post<PythonMatchResponse>(
        `${this.serverUrl}/match`,
        { script_lines: scriptLines, top_k: topK, dedup_consecutive: true },
        { timeout: 60_000 },
      );
      return res.data;
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: unknown } }; message?: string };
      const detail = axiosErr?.response?.data?.detail;
      const message =
        typeof detail === 'string'
          ? detail
          : detail
            ? JSON.stringify(detail)
            : axiosErr?.message ?? 'B-roll matcher error';
      throw new BadGatewayException(`B-roll match failed: ${message}`);
    }
  }

  async getIngestionStatus(): Promise<unknown> {
    try {
      const res = await axios.get(`${this.serverUrl}/ingest/status`, { timeout: 5_000 });
      return res.data;
    } catch {
      throw new BadGatewayException('Failed to reach B-roll matcher service');
    }
  }

  async startIngestion(videoDir: string, forceReingest: boolean): Promise<unknown> {
    try {
      const res = await axios.post(
        `${this.serverUrl}/ingest`,
        { video_dir: videoDir, force_reingest: forceReingest },
        { timeout: 10_000 },
      );
      return res.data;
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: unknown } }; message?: string };
      const detail = axiosErr?.response?.data?.detail;
      const message =
        typeof detail === 'string'
          ? detail
          : detail
            ? JSON.stringify(detail)
            : axiosErr?.message ?? 'B-roll matcher error';
      throw new BadGatewayException(`Ingestion failed: ${message}`);
    }
  }

  async rebuildIndex(): Promise<unknown> {
    try {
      const res = await axios.post(`${this.serverUrl}/ingest/rebuild-index`, {}, { timeout: 120_000 });
      return res.data;
    } catch {
      throw new BadGatewayException('Failed to rebuild B-roll index');
    }
  }

  async listVideos(): Promise<unknown> {
    try {
      const res = await axios.get(`${this.serverUrl}/videos`, { timeout: 10_000 });
      return res.data;
    } catch {
      throw new BadGatewayException('Failed to reach B-roll matcher service');
    }
  }
}
