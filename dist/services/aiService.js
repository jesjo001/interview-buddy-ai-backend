"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFlashcards = exports.generateTopicContent = exports.generateStudyPlanTopics = exports.analyzeJobDescription = void 0;
const openai_1 = __importDefault(require("openai"));
const types_1 = require("../types");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
let openaiClient = null;
if (openaiApiKey) {
    openaiClient = new openai_1.default({ apiKey: openaiApiKey });
}
const analyzeJobDescription = async (rawText) => {
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
        if (!content)
            throw new Error('No content received from OpenAI for job description analysis.');
        const jsonString = content.replace(/```json\n|\n```/g, '').trim();
        return JSON.parse(jsonString);
    }
    catch (error) {
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
exports.analyzeJobDescription = analyzeJobDescription;
const generateStudyPlanTopics = async (parsedData, difficulty) => {
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
        if (!content)
            throw new Error('No content received from OpenAI for study plan topics.');
        const jsonString = content.replace(/```json\n|\n```/g, '').trim();
        return JSON.parse(jsonString);
    }
    catch (error) {
        console.error('Error generating study plan topics with OpenAI:', error);
        return ['Fundamentals', 'Advanced Concepts'];
    }
};
exports.generateStudyPlanTopics = generateStudyPlanTopics;
const generateTopicContent = async (skill, difficulty) => {
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
        if (!content)
            throw new Error('No content received from OpenAI for topic content generation.');
        const jsonString = content.replace(/```json\n|\n```/g, '').trim();
        const parsed = JSON.parse(jsonString);
        // Normalize resources types to ResourceType enum values
        if (Array.isArray(parsed.resources)) {
            parsed.resources = parsed.resources.map((r) => {
                const typeStr = (r.type || '').toString().toLowerCase();
                let mapped = types_1.ResourceType.ARTICLE;
                if (typeStr.includes('video'))
                    mapped = types_1.ResourceType.VIDEO;
                else if (typeStr.includes('doc') || typeStr.includes('documentation') || typeStr.includes('docs'))
                    mapped = types_1.ResourceType.DOCUMENTATION;
                else
                    mapped = types_1.ResourceType.ARTICLE;
                return { type: mapped, url: r.url, title: r.title };
            });
        }
        // Ensure mindMap exists
        if (!parsed.mindMap)
            parsed.mindMap = { nodes: [], edges: [] };
        return parsed;
    }
    catch (error) {
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
exports.generateTopicContent = generateTopicContent;
const generateFlashcards = async (topicContent, count = 5) => {
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
        if (!content)
            throw new Error('No content received from OpenAI for flashcard generation.');
        const jsonString = content.replace(/```json\n|\n```/g, '').trim();
        return JSON.parse(jsonString);
    }
    catch (error) {
        console.error('Error generating flashcards with OpenAI:', error);
        return [{ front: 'Fallback Question', back: 'Fallback Answer' }];
    }
};
exports.generateFlashcards = generateFlashcards;
