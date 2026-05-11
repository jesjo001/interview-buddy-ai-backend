import OpenAI from 'openai';
import { ResourceType } from '../types';
import dotenv from 'dotenv';

dotenv.config();

const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
let openaiClient: OpenAI | null = null;
if (openaiApiKey) {
  openaiClient = new OpenAI({ apiKey: openaiApiKey });
}

const stripMarkdownFences = (value: string): string => {
  const trimmed = value.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  return trimmed.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
};

const extractBalancedJson = (value: string): string | null => {
  const start = value.search(/[\[{]/);
  if (start < 0) return null;

  const openChar = value[start];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < value.length; i++) {
    const ch = value[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === openChar) {
      depth++;
      continue;
    }

    if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        return value.slice(start, i + 1);
      }
    }
  }

  return null;
};

const sanitizeJsonCandidate = (value: string): string => {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < value.length; i++) {
    const ch = value[i];

    if (!inString) {
      if (ch === '"') {
        inString = true;
      }
      result += ch;
      continue;
    }

    if (escaped) {
      escaped = false;
      result += ch;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      result += ch;
      continue;
    }

    if (ch === '"') {
      inString = false;
      result += ch;
      continue;
    }

    // Guard against invalid raw control chars inside JSON string values.
    if (ch === '\n') {
      result += '\\n';
      continue;
    }
    if (ch === '\r') {
      result += '\\r';
      continue;
    }
    if (ch === '\t') {
      result += '\\t';
      continue;
    }
    if (ch.charCodeAt(0) < 0x20) {
      result += ' ';
      continue;
    }

    result += ch;
  }

  return result;
};

const parseModelJson = <T>(content: string): T => {
  const raw = content.replace(/^\uFEFF/, '').trim();
  const deFenced = stripMarkdownFences(raw);

  const candidates = [
    deFenced,
    extractBalancedJson(deFenced),
    extractBalancedJson(raw),
  ].filter((v): v is string => Boolean(v && v.trim().length));

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch (err) {
      lastError = err;
      try {
        return JSON.parse(sanitizeJsonCandidate(candidate)) as T;
      } catch (sanitizeErr) {
        lastError = sanitizeErr;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to parse model JSON output');
};

export interface JobParsedData {
  jobTitle?: string;
  company?: string;
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  qualifications: string[];
}

export interface TopicContent {
  summary: string;
  keyPoints: string[];
  deepDive: string;
  resources: Array<{ type: string; url: string; title: string }>;
  mindMap: { nodes: any[]; edges: any[] };
}

export interface Flashcard {
  front: string;
  back: string;
}

export const analyzeJobDescription = async (rawText: string): Promise<JobParsedData> => {
  if (!openaiClient) {
    console.warn('OPENAI_API_KEY is not set. Using mock AI response for job description analysis.');
    return {
      jobTitle: 'Software Engineer',
      company: 'Mock Company',
      requiredSkills: ['JavaScript', 'React', 'Node.js'],
      preferredSkills: ['TypeScript', 'AWS'],
      responsibilities: ['Develop features', 'Write tests'],
      qualifications: ['B.S. in Computer Science', '3+ years experience'],
    };
  }

  const prompt = `
  Analyze this job description and extract structured data:

  Job Description:
  ${rawText}

  Return JSON with:
  {
    "jobTitle": "...",
    "company": "...",
    "requiredSkills": ["skill1", "skill2", ...],
    "preferredSkills": [...],
    "responsibilities": [...],
    "qualifications": [...] 
  }
  `;

  try {
    const response = await openaiClient.chat.completions.create({
      model: openaiModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content received from OpenAI for job description analysis.');
    return parseModelJson<JobParsedData>(content);
  } catch (error) {
    console.error('Error analyzing job description with OpenAI:', error);
    // Fallback to mock data on error
    return {
      jobTitle: 'Software Engineer (Fallback)',
      company: 'Mock Company (Fallback)',
      requiredSkills: ['Programming', 'Problem Solving'],
      preferredSkills: ['Teamwork'],
      responsibilities: ['Build software'],
      qualifications: ['Experience'],
    };
  }
};

export const generateStudyPlanTopics = async (
  parsedData: JobParsedData,
  difficulty: string
): Promise<string[]> => {
  if (!openaiClient) {
    console.warn('OPENAI_API_KEY is not set. Using mock AI response for study plan topics.');
    return [...parsedData.requiredSkills, ...parsedData.preferredSkills];
  }

  const skills = [...parsedData.requiredSkills, ...parsedData.preferredSkills].join(', ');
  const prompt = `Based on these skills: ${skills}, and a difficulty level of ${difficulty}, suggest a list of 5-10 distinct topics suitable for interview preparation. Return a JSON array of strings.`;

  try {
    const response = await openaiClient.chat.completions.create({
      model: openaiModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
    });
    const content = response?.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content received from OpenAI for study plan topics.');
    const parsed = parseModelJson<unknown>(content);
    if (!Array.isArray(parsed)) {
      throw new Error('Unexpected topics format: expected an array of strings');
    }
    return parsed.map((topic) => String(topic)).filter((topic) => topic.trim().length > 0);
  } catch (error) {
    console.error('Error generating study plan topics with OpenAI:', error);
    return ['Fundamentals', 'Advanced Concepts'];
  }
};


export const generateTopicContent = async (
  skill: string,
  difficulty: string
): Promise<TopicContent> => {
  if (!openaiClient) {
    console.warn('OPENAI_API_KEY is not set. Using mock AI response for topic content.');
    return {
      summary: `This is a mock summary for ${skill} at ${difficulty} level.`,
      keyPoints: [`Key point 1 for ${skill}`, `Key point 2 for ${skill}`],
      deepDive: `This is a mock deep dive into ${skill}. It covers various aspects and examples relevant to the ${difficulty} level.`,
      resources: [{ type: 'article', url: 'https://example.com/mock', title: 'Mock Article' }],
      mindMap: {
        nodes: [{ id: '1', data: { label: skill }, position: { x: 0, y: 0 } }],
        edges: [],
      },
    };
  }

  const prompt = `Create interview prep content for the skill: "${skill}" at a "${difficulty}" level. Provide a TL;DR summary (50-100 words), 3-5 key points as bullet points, a detailed deep dive explanation (markdown format is okay), and 1-2 relevant resources (articles/videos). Also, generate a simple JSON structure for a mind map (nodes and edges) representing the sub-topics of this skill. Return JSON with keys: summary, keyPoints, deepDive, resources, mindMap.`;

  try {
    const response = await openaiClient.chat.completions.create({
      model: openaiModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
    });
    const content = response?.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content received from OpenAI for topic content generation.');
    const parsed = parseModelJson<any>(content);

    // Normalize resources types to ResourceType enum values
    if (Array.isArray(parsed.resources)) {
      parsed.resources = parsed.resources.map((r: any) => {
        const typeStr = (r.type || '').toString().toLowerCase();
        let mapped: ResourceType = ResourceType.ARTICLE;
        if (typeStr.includes('video')) mapped = ResourceType.VIDEO;
        else if (typeStr.includes('doc') || typeStr.includes('documentation') || typeStr.includes('docs')) mapped = ResourceType.DOCUMENTATION;
        else mapped = ResourceType.ARTICLE;
        return { type: mapped, url: r.url, title: r.title };
      });
    }

    // Ensure mindMap exists
    if (!parsed.mindMap) parsed.mindMap = { nodes: [], edges: [] };

    return parsed as TopicContent;
  } catch (error) {
    console.error('Error generating topic content with OpenAI:', error);
    return {
      summary: `Fallback summary for ${skill}`,
      keyPoints: [`Fallback key point for ${skill}`],
      deepDive: `Fallback deep dive for ${skill}`,
      resources: [],
      mindMap: { nodes: [], edges: [] },
    };
  }
};

export const generateFlashcards = async (
  topicContent: string,
  count: number = 5
): Promise<Flashcard[]> => {
  if (!openaiClient) {
    console.warn('OPENAI_API_KEY is not set. Using mock AI response for flashcards.');
    return [
      { front: `Mock Question 1 for ${topicContent.substring(0, 20)}`, back: 'Mock Answer 1' },
      { front: `Mock Question 2 for ${topicContent.substring(0, 20)}`, back: 'Mock Answer 2' },
    ];
  }

  const prompt = `Generate ${count} flashcards (question and answer pairs) based on the following text: ${topicContent}. Return a JSON array of objects with properties 'front' and 'back'.`;

  try {
    const response = await openaiClient.chat.completions.create({
      model: openaiModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
    });
    const content = response?.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content received from OpenAI for flashcard generation.');
    const parsed = parseModelJson<unknown>(content);
    if (!Array.isArray(parsed)) {
      throw new Error('Unexpected flashcards format: expected an array');
    }

    return parsed
      .map((item) => ({
        front: String((item as any)?.front || '').trim(),
        back: String((item as any)?.back || '').trim(),
      }))
      .filter((item) => item.front.length > 0 && item.back.length > 0);
  } catch (error) {
    console.error('Error generating flashcards with OpenAI:', error);
    return [{ front: 'Fallback Question', back: 'Fallback Answer' }];
  }
};
