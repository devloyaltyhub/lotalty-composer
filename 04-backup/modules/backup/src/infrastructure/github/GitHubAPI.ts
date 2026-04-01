import type {
  GitHubBatchConfig,
  TreeEntry,
  FileToUpload,
  GitHubRefResponse,
  GitHubCommitResponse,
  GitHubShaResponse,
} from './types';

export class GitHubAPI {
  private readonly baseUrl = 'https://api.github.com';
  private readonly config: GitHubBatchConfig;

  constructor(config: GitHubBatchConfig) {
    this.config = config;
  }

  async fetch<T = Record<string, unknown>>(
    endpoint: string,
    options: { method?: string; body?: string } = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      ...(options.body ? { body: options.body } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error ${response.status}: ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  async fetchRaw(url: string): Promise<Response> {
    return fetch(url, {
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async createBlob(content: Buffer): Promise<string> {
    const { owner, repo } = this.config;

    const response = await this.fetch<GitHubShaResponse>(
      `/repos/${owner}/${repo}/git/blobs`,
      {
        method: 'POST',
        body: JSON.stringify({
          content: content.toString('base64'),
          encoding: 'base64',
        }),
      }
    );

    return response.sha;
  }

  private async createBlobsInParallel(
    files: FileToUpload[],
    batchSize = 10
  ): Promise<TreeEntry[]> {
    const treeEntries: TreeEntry[] = [];

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (file) => {
          const blobSha = await this.createBlob(file.content);
          return {
            path: file.path,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blobSha,
          };
        })
      );
      treeEntries.push(...results);
    }

    return treeEntries;
  }

  private async fetchWithRetry<T>(
    endpoint: string,
    options: { method?: string; body?: string },
    maxRetries: number,
    delayMs: number
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.fetch<T>(endpoint, options);
      } catch (error) {
        const isRetryable =
          error instanceof Error &&
          (error.message.includes('Tree SHA does not exist') ||
            error.message.includes('422'));

        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }

        console.log(
          `[GitHubAPI] Tentativa ${attempt}/${maxRetries} falhou, aguardando ${delayMs / 1000}s...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw new Error('Unreachable');
  }

  async createSingleCommit(
    files: FileToUpload[],
    commitMessage: string
  ): Promise<string> {
    const { owner, repo } = this.config;

    console.log('[GitHubAPI] Obtendo referencia da branch main...');
    const refResponse = await this.fetch<GitHubRefResponse>(
      `/repos/${owner}/${repo}/git/ref/heads/main`
    );
    const baseCommitSha = refResponse.object.sha;

    const baseCommitResponse = await this.fetch<GitHubCommitResponse>(
      `/repos/${owner}/${repo}/git/commits/${baseCommitSha}`
    );
    const baseTreeSha = baseCommitResponse.tree.sha;

    console.log(`[GitHubAPI] Criando ${files.length} blobs em paralelo...`);
    const treeEntries = await this.createBlobsInParallel(files);

    console.log('[GitHubAPI] Criando tree...');
    const treeResponse = await this.fetch<GitHubShaResponse>(
      `/repos/${owner}/${repo}/git/trees`,
      {
        method: 'POST',
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: treeEntries,
        }),
      }
    );
    const newTreeSha = treeResponse.sha;

    console.log('[GitHubAPI] Criando commit...');
    const commitResponse = await this.fetchWithRetry<GitHubShaResponse>(
      `/repos/${owner}/${repo}/git/commits`,
      {
        method: 'POST',
        body: JSON.stringify({
          message: commitMessage,
          tree: newTreeSha,
          parents: [baseCommitSha],
        }),
      },
      3,
      2000
    );
    const newCommitSha = commitResponse.sha;

    console.log('[GitHubAPI] Atualizando referencia...');
    await this.fetch(`/repos/${owner}/${repo}/git/refs/heads/main`, {
      method: 'PATCH',
      body: JSON.stringify({
        sha: newCommitSha,
      }),
    });

    console.log(`[GitHubAPI] Commit criado: ${newCommitSha}`);
    return newCommitSha;
  }

  getContentsUrl(path: string): string {
    return `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;
  }
}
