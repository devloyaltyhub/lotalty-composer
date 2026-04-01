import type { GitHubConfig, BackupUploader } from './types';

export class GitHubUploader implements BackupUploader {
  private readonly config: GitHubConfig;
  private readonly apiBase = 'https://api.github.com';

  constructor(config: GitHubConfig) {
    this.config = {
      ...config,
      branch: config.branch || 'main',
      basePath: config.basePath || '',
    };
  }

  async uploadFile(
    path: string,
    content: string | Buffer,
    message: string
  ): Promise<{ success: boolean; sha?: string; error?: string }> {
    const fullPath = this.config.basePath
      ? `${this.config.basePath}/${path}`
      : path;

    const contentBase64 = Buffer.isBuffer(content)
      ? content.toString('base64')
      : Buffer.from(content).toString('base64');

    try {
      const existingSha = await this.getFileSha(fullPath);

      const response = await fetch(
        `${this.apiBase}/repos/${this.config.owner}/${this.config.repo}/contents/${fullPath}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${this.config.token}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({
            message,
            content: contentBase64,
            branch: this.config.branch,
            ...(existingSha ? { sha: existingSha } : {}),
          }),
        }
      );

      if (response.ok) {
        const data = (await response.json()) as {
          content?: { sha?: string };
        };
        return { success: true, sha: data.content?.sha };
      }

      const errorText = await response.text();
      return { success: false, error: errorText };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  async createOrUpdateFile(
    path: string,
    content: string,
    message: string
  ): Promise<{ success: boolean; sha?: string; error?: string }> {
    return this.uploadFile(path, content, message);
  }

  private async getFileSha(path: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.apiBase}/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      if (response.ok) {
        const data = (await response.json()) as { sha?: string };
        return data.sha || null;
      }

      return null;
    } catch {
      return null;
    }
  }
}
