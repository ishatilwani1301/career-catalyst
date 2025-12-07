// FIX: Added definitions for all types used across the application to resolve module errors.
export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

export interface Skill {
  name: string;
  level: SkillLevel;
}
export interface UserProfile {
  academicBackground: string;
  professionalProfile: string;
  aspirations: string;
  careerCategory: 'career_changer' | 'career_returner' | 'new_entrant' | '';
  targetCareer: string;
  careerGap: string;
  skills: Skill[];
}

export interface User {
  name: string;
  email: string;
}

export interface RoadmapResource {
  type: 'video' | 'article' | 'paper' | 'course';
  title: string;
}

export interface RoadmapModule {
  title:string;
  description: string;
  resources: RoadmapResource[];
  targetProficiency: string;
}

export interface SkillRoadmap {
  modules: RoadmapModule[];
}

export interface JamboardStep {
  step: number;
  explanation: string;
  visual_prompt: string;
  example?: string;
  imageUrl?: string;
}

export interface JobChallenge {
  title: string;
  challenge: string;
}

export interface JobChallenges {
  technical: JobChallenge[];
  case_study: JobChallenge[];
  behavioral: JobChallenge[];
}

export interface IndustryNewsItem {
  title: string;
  summary: string;
  source_type: 'article' | 'report' | 'blog' | 'video';
  relevance: string;
}

export interface IndustryNews {
  news: IndustryNewsItem[];
}

export enum DashboardTab {
  DAILY_BYTES = 'Daily Bytes',
  ROADMAP = 'Roadmap',
  JAMBOARD = 'Jamboard',
  INTERVIEW_PREP = 'Interview Prep',
  PROFILE = 'Profile',
}

export interface ChatMessage {
    role: 'user' | 'model' | 'system';
    content: string;
}

export enum AppView {
  LOGIN = 'LOGIN',
  ONBOARDING = 'ONBOARDING',
  DASHBOARD = 'DASHBOARD',
}

export type InterviewType = 'Behavioral' | 'Skill-Based' | 'Situational' | 'Elevator Pitch' | 'Specific Job';

export interface InterviewConfig {
  type: InterviewType;
  company?: string;
  numQuestions?: string;
  jobDescription?: string;
  userProfile: UserProfile;
  sessionDuration?: string;
}

export interface TechnicalQuestion {
  question: string;
}

export interface TechnicalFeedback {
  overallSummary: string;
  overallScore: number;
  questionFeedback: {
    question: string;
    answer: string;
    feedback: string;
    score: number;
  }[];
}

export interface ElevatorPitchFeedback {
  overallAssessment: string;
  clarityScore: number;
  impactScore: number;
  completenessScore: number;
  structureFeedback: string;
  suggestionForImprovement: string;
}

export interface SavedTranscript {
  id: number; // Using timestamp for unique ID
  date: string;
  type: InterviewType;
  isAudio: boolean;
  messages: ChatMessage[];
}