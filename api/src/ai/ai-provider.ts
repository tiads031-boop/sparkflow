export type InsightType = 'theme' | 'evolution' | 'action';

export interface InsightCandidate {
  id: string;
  title: string | null;
  description: string | null;
  contentText: string | null;
  tags: string[];
  createdAt: string;
  reflections: Array<{
    body: string;
    createdAt: string;
  }>;
}

export interface GeneratedInsight {
  title: string;
  body: string;
  type: InsightType;
  sourceIds: string[];
}

export interface InsightGenerationInput {
  records: InsightCandidate[];
}

export interface AIProvider {
  readonly modelName: string;
  generateInsights(input: InsightGenerationInput): Promise<GeneratedInsight[]>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
