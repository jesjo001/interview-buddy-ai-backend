import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Fallback to OpenAI if needed, but not implemented for now to keep it concise

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
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY is not set. Using mock AI response for job description analysis.');
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
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const firstContent = response.content[0];
    if (firstContent && firstContent.type === 'text') {
      const content = firstContent.text;
      // Clean content before parsing, sometimes AI adds markdown code blocks
      const jsonString = content.replace(/```json\n|\n```/g, '').trim();
      return JSON.parse(jsonString);
    }
    throw new Error('No content received from AI for job description analysis.');
  } catch (error) {
    console.error('Error analyzing job description with Anthropic:', error);
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
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY is not set. Using mock AI response for study plan topics.');
    return [...parsedData.requiredSkills, ...parsedData.preferredSkills];
  }

  const skills = [...parsedData.requiredSkills, ...parsedData.preferredSkills].join(', ');
  const prompt = `
  Based on these skills: ${skills}, and a difficulty level of ${difficulty}, suggest a list of 5-10 distinct topics suitable for interview preparation.
  Return a JSON array of strings, e.g., ["Topic 1", "Topic 2"].
  `;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });
    const firstContent = response.content[0];
    if (firstContent && firstContent.type === 'text') {
      const content = firstContent.text;
      const jsonString = content.replace(/```json\n|\n```/g, '').trim();
      return JSON.parse(jsonString);
    }
    throw new Error('No content received from AI for study plan topics.');
  } catch (error) {
    console.error('Error generating study plan topics with Anthropic:', error);
    return ['Fundamentals', 'Advanced Concepts'];
  }
};


export const generateTopicContent = async (
  skill: string,
  difficulty: string
): Promise<TopicContent> => {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY is not set. Using mock AI response for topic content.');
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

  const prompt = `
  Create interview prep content for the skill: "${skill}" at a "${difficulty}" level.
  Provide a TL;DR summary (50-100 words), 3-5 key points as bullet points, a detailed deep dive explanation (markdown format is okay), and 1-2 relevant resources (articles/videos).
  Also, generate a simple JSON structure for a mind map (nodes and edges) representing the sub-topics of this skill.

  Return JSON with the following structure:
  {
    "summary": "50-100 word TL;DR",
    "keyPoints": ["point1", "point2", ...],
    "deepDive": "Detailed explanation with examples",
    "resources": [{ "type": "article", "url": "...", "title": "..." }],
    "mindMap": { "nodes": [{ id: "1", data: { label: "Main Topic" }, position: { x: 0, y: 0 } }], "edges": [] }
  }
  `;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });
    const firstContent = response.content[0];
    if (firstContent && firstContent.type === 'text') {
      const content = firstContent.text;
      const jsonString = content.replace(/```json\n|\n```/g, '').trim();
      return JSON.parse(jsonString);
    }
    throw new Error('No content received from AI for topic content generation.');
  } catch (error) {
    console.error('Error generating topic content with Anthropic:', error);
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
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY is not set. Using mock AI response for flashcards.');
    return [
      { front: `Mock Question 1 for ${topicContent.substring(0, 20)}`, back: 'Mock Answer 1' },
      { front: `Mock Question 2 for ${topicContent.substring(0, 20)}`, back: 'Mock Answer 2' },
    ];
  }

  const prompt = `
  Generate ${count} flashcards (question and answer pairs) based on the following text:
  ${topicContent}

  Return a JSON array of objects, where each object has "front" (question) and "back" (answer) properties.
  Example:
  [
    { "front": "What is X?", "back": "Y" },
    { "front": "How does A work?", "back": "B" }
  ]
  `;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });
    const firstContent = response.content[0];
    if (firstContent && firstContent.type === 'text') {
      const content = firstContent.text;
      const jsonString = content.replace(/```json\n|\n```/g, '').trim();
      return JSON.parse(jsonString);
    }
    throw new Error('No content received from AI for flashcard generation.');
  } catch (error) {
    console.error('Error generating flashcards with Anthropic:', error);
    return [{ front: 'Fallback Question', back: 'Fallback Answer' }];
  }
};
