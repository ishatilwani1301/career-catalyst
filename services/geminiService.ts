import { GoogleGenAI, Type, Chat } from "@google/genai";
import { UserProfile, SkillRoadmap, JamboardStep, JobChallenges, IndustryNews, InterviewConfig, TechnicalQuestion, TechnicalFeedback, ElevatorPitchFeedback } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

const getLanguageName = (langCode: string) => {
    const languageMap: { [key: string]: string } = {
        en: 'English',
        hi: 'Hindi',
        ta: 'Tamil',
        te: 'Telugu',
        kn: 'Kannada',
        bn: 'Bengali',
        ml: 'Malayalam',
    };
    return languageMap[langCode] || 'English';
};


/**
 * A utility function to wrap API calls with a retry mechanism for rate-limiting errors.
 * @param apiCall The async function to call.
 * @returns The result of the API call.
 */
async function withRetry<T>(apiCall: () => Promise<T>): Promise<T> {
    let lastError: any = null;
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            return await apiCall();
        } catch (error: any) {
            lastError = error;
            let isRateLimitError = false;

            // The Gemini API can throw errors in a few different formats.
            // We need to robustly check for rate limit conditions.

            // Case 1: The error object itself contains the details (common for structured errors).
            if (error?.error?.code === 429 || error?.error?.status === 'RESOURCE_EXHAUSTED') {
                isRateLimitError = true;
            }
            // Case 2: The error.message property is a JSON string.
            else if (typeof error?.message === 'string') {
                try {
                    const errorJson = JSON.parse(error.message);
                    if (errorJson?.error?.code === 429 || errorJson?.error?.status === 'RESOURCE_EXHAUSTED') {
                        isRateLimitError = true;
                    }
                } catch (e) {
                    // Not a JSON string, fall through to the next check.
                }
            }

            // Case 3: The error.message is a plain string containing rate limit text.
            if (!isRateLimitError && typeof error?.message === 'string' &&
               (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED') || error.message.toLowerCase().includes('rate limit'))) {
                isRateLimitError = true;
            }

            if (isRateLimitError && i < MAX_RETRIES - 1) {
                const delay = INITIAL_BACKOFF_MS * Math.pow(2, i);
                console.warn(`Rate limit exceeded. Retrying in ${delay}ms... (Attempt ${i + 1})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error; // Re-throw if it's not a rate limit error or max retries are reached
            }
        }
    }
    throw lastError; // Should be unreachable
}

/**
 * Parses a potential JSON error message from the API into a user-friendly string.
 * @param error The error object.
 * @param defaultMessage A default message to use if parsing fails.
 * @returns A user-friendly error message string.
 */
function parseErrorMessage(error: any, defaultMessage: string): string {
    // Case 1: The error object itself contains the details.
    if (error?.error?.message) {
        return `AI Service Error: ${error.error.message}`;
    }

    // Case 2: The error.message property is a JSON string.
    if (typeof error?.message === 'string') {
        try {
            const errorJson = JSON.parse(error.message);
            if (errorJson?.error?.message) {
                return `AI Service Error: ${errorJson.error.message}`;
            }
        } catch (e) {
            // Not a JSON string, fall through to return the message directly.
        }
    }

    // Case 3: The error.message is just a plain string.
    if (typeof error?.message === 'string') {
        return `AI Service Error: ${error.message}`;
    }
    
    // Fallback
    return defaultMessage;
}


export async function generateSkillRoadmap(userProfile: UserProfile, language: string): Promise<SkillRoadmap> {
  const targetLanguage = getLanguageName(language);
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an expert career coach for professionals in India. Given the following user profile, generate a personalized skill roadmap. Your response MUST be in ${targetLanguage}.
      The user is from India, so tailor resources and examples accordingly.
      Pay close attention to their career category: '${userProfile.careerCategory}'. This context is crucial.
      - If they are a 'career_changer', focus on foundational skills for their new field and bridging skills from their previous career.
      - If they are a 'career_returner', suggest refresher courses and skills that have become prominent during their gap of ${userProfile.careerGap || 'an unspecified time'}. Emphasize building confidence and updating their network.
      - If they are a 'new_entrant', focus on practical, entry-level skills and building a strong portfolio.

      Their target career is: "${userProfile.targetCareer}". The roadmap MUST be highly relevant to this goal.

      For each module, provide a 'title', 'description', a 'targetProficiency' level from ['Beginner', 'Intermediate', 'Advanced', 'Expert'], and an array of 'resources'.
      For each resource, provide a 'type' ('video', 'article', 'paper', 'course') and a 'title'.
      The 'title' should be descriptive and specific enough to be used as a search query. For courses, include the platform name in the title, for example: "Machine Learning by Andrew Ng on Coursera".
      DO NOT provide any URLs.
      The output must be a valid JSON object. All text content in the JSON should be in ${targetLanguage}.
      User Profile: ${JSON.stringify(userProfile)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            modules: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: `The title of the module in ${targetLanguage}` },
                  description: { type: Type.STRING, description: `A description of the module in ${targetLanguage}` },
                  targetProficiency: { type: Type.STRING, enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'], description: `The target proficiency level for this module. Must be in English.` },
                  resources: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        type: { type: Type.STRING, enum: ['video', 'article', 'paper', 'course'] },
                        title: { type: Type.STRING, description: `The title of the resource in ${targetLanguage}` },
                      },
                      required: ['type', 'title']
                    },
                  },
                },
                required: ['title', 'description', 'resources', 'targetProficiency']
              },
            },
          },
          required: ['modules']
        },
      },
    }));

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as SkillRoadmap;
  } catch (error) {
    console.error("Error generating skill roadmap:", error);
    const message = parseErrorMessage(error, "Failed to generate skill roadmap. Please check your profile and try again.");
    throw new Error(message);
  }
}

export async function generateJamboardExplanation(topic: string, language: string): Promise<JamboardStep[]> {
  const targetLanguage = getLanguageName(language);
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an expert educator. Explain the topic "${topic}" in 3-5 simple, sequential steps for a visual Jamboard presentation. Your response MUST be in ${targetLanguage}.
      For each step, provide:
      - 'step': The step number.
      - 'explanation': A clear, concise explanation of that part of the topic in ${targetLanguage}.
      - 'visual_prompt': A detailed prompt for an AI image generator to create a simple, clear, and illustrative visual for this step. The image should be minimalist and easy to understand. This prompt should be in English.
      - 'example' (optional): A brief, relatable example from daily life in India to illustrate the point, written in ${targetLanguage}.

      The output must be a valid JSON object.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  step: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                  visual_prompt: { type: Type.STRING },
                  example: { type: Type.STRING },
                },
                required: ['step', 'explanation', 'visual_prompt']
              }
            }
          },
          required: ['steps']
        },
      },
    }));

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    return result.steps as JamboardStep[];
  } catch (error) {
    console.error("Error generating Jamboard explanation:", error);
    const message = parseErrorMessage(error, "Failed to generate explanation. Please try a different topic.");
    throw new Error(message);
  }
}


export async function generateImageFromPrompt(prompt: string): Promise<string> {
  try {
    const response = await withRetry(() => ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/png',
        aspectRatio: '16:9',
      },
    }));

    if (response.generatedImages && response.generatedImages.length > 0) {
      const base64ImageBytes = response.generatedImages[0].image.imageBytes;
      return `data:image/png;base64,${base64ImageBytes}`;
    } else {
      throw new Error("No image was generated.");
    }
  } catch (error) {
    console.error("Error generating image:", error);
    const message = parseErrorMessage(error, "Failed to generate visual representation.");
    throw new Error(message);
  }
}


export async function generateJobChallenges(jobDescription: string, language: string): Promise<JobChallenges> {
  const targetLanguage = getLanguageName(language);
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a hiring manager and technical interviewer. Analyze the following job description and generate a set of practice challenges for an Indian candidate preparing for an interview for this role. Your response MUST be in ${targetLanguage}.
      Create 2-3 challenges for each of the following categories: 'technical', 'case_study', and 'behavioral'.
      - 'technical': Code snippets, bug fixing, or specific technical questions.
      - 'case_study': A hypothetical business problem to solve.
      - 'behavioral': Questions based on past experiences, tailored to the Indian work context.

      For each challenge, provide a 'title' and the 'challenge' description, both in ${targetLanguage}.

      Job Description:
      ---
      ${jobDescription}
      ---`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            technical: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  challenge: { type: Type.STRING },
                },
                required: ['title', 'challenge']
              }
            },
            case_study: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  challenge: { type: Type.STRING },
                },
                required: ['title', 'challenge']
              }
            },
            behavioral: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  challenge: { type: Type.STRING },
                },
                required: ['title', 'challenge']
              }
            }
          },
          required: ['technical', 'case_study', 'behavioral']
        },
      },
    }));

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as JobChallenges;
  } catch (error) {
    console.error("Error generating job challenges:", error);
    const message = parseErrorMessage(error, "Failed to generate challenges from the job description.");
    throw new Error(message);
  }
}

export async function generateProfileFromResumeText(resumeText: string, language: string): Promise<Partial<UserProfile>> {
  const targetLanguage = getLanguageName(language);
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an expert resume parser for an Indian career development platform. Analyze the following resume text and extract the user's profile information into a JSON object. All text values in the JSON should be in ${targetLanguage}, except for the 'level' in skills which must be in English.
      - academicBackground: Summarize their education.
      - professionalProfile: Summarize their work experience, skills, and roles.
      - aspirations: Infer their career goals or aspirations from the resume's objective or summary, if present.
      - targetCareer: Suggest a target career based on their most recent role and skills.
      - careerCategory: Infer the user's category from ['career_changer', 'career_returner', 'new_entrant']. If it's unclear, leave it as an empty string. A new entrant usually has little to no professional experience. A career returner might have a gap. A career changer might show a distinct shift in roles or skills.
      - careerGap: If you detect a significant gap in employment dates, briefly describe it.
      - skills: An array of up to 10 key skills extracted from the resume. For each skill, provide a 'name' (string) and a 'level' (string from ['Beginner', 'Intermediate', 'Advanced', 'Expert']) based on the experience described.

      The output must be a valid JSON object. If a field cannot be populated, return an empty string or an empty array for it.

      Resume Text:
      ---
      ${resumeText}
      ---`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            academicBackground: { type: Type.STRING },
            professionalProfile: { type: Type.STRING },
            aspirations: { type: Type.STRING },
            careerCategory: { type: Type.STRING },
            targetCareer: { type: Type.STRING },
            careerGap: { type: Type.STRING },
            skills: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        level: { type: Type.STRING, enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'] },
                    },
                    required: ['name', 'level']
                }
            }
          },
          required: ['academicBackground', 'professionalProfile', 'aspirations', 'careerCategory', 'targetCareer', 'careerGap', 'skills']
        },
      },
    }));

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as Partial<UserProfile>;
  } catch (error) {
    console.error("Error generating profile from resume:", error);
    const message = parseErrorMessage(error, "Failed to parse resume. Please fill out the form manually.");
    throw new Error(message);
  }
}

export async function generateIndustryNews(userProfile: UserProfile, language: string): Promise<IndustryNews> {
  const targetLanguage = getLanguageName(language);
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an expert industry analyst for professionals in India. Generate a list of 3-5 recent and significant industry developments or news relevant to the user's target career: "${userProfile.targetCareer}". Your response MUST be in ${targetLanguage}.
      For each item, provide:
      - 'title': A concise, descriptive title for the news item.
      - 'summary': A brief summary (2-3 sentences) of the development.
      - 'source_type': The type of source, from ['article', 'report', 'blog', 'video'].
      - 'relevance': A short explanation of why this is relevant to someone pursuing the user's target career.

      Focus on developments impactful within the Indian context where applicable.
      The output must be a valid JSON object, with all text values in ${targetLanguage}.
      User Profile: ${JSON.stringify(userProfile)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            news: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  source_type: { type: Type.STRING, enum: ['article', 'report', 'blog', 'video'] },
                  relevance: { type: Type.STRING },
                },
                required: ['title', 'summary', 'source_type', 'relevance']
              },
            },
          },
          required: ['news']
        },
      },
    }));

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as IndustryNews;
  } catch (error) {
    console.error("Error generating industry news:", error);
    const message = parseErrorMessage(error, "Failed to generate industry news. Please try again later.");
    throw new Error(message);
  }
}

export function getInterviewSystemInstruction(config: InterviewConfig, language: string, isAudio: boolean = false): string {
  const targetLanguage = getLanguageName(language);
  let instruction = `You are "Sakshatkar Abhyas," an expert AI interview coach for Indian professionals. Your goal is to conduct a realistic mock interview based on the user's request. You MUST conduct the entire interview in ${targetLanguage}.`;
  
  if (isAudio) {
      instruction += `
This is a real-time audio interview. Start the interview with your first question as soon as the session begins. After the user responds, provide verbal feedback and then ask the next question. Structure your feedback by first giving a score from 1 to 10, then explaining what they did well, and finally suggesting improvements. All your speech and feedback must be in ${targetLanguage}.`
  } else {
      instruction += `

Your process is as follows:
  1.  **Start the Interview:** Welcome the user warmly and start the interview with the first question, all in ${targetLanguage}. Do not wait for them to say 'begin'.
  2.  **Ask One Question at a Time:** Ask only one question per turn.
  3.  **Wait for the User's Answer:** After asking a question, wait for the user to respond.
  4.  **Provide Feedback:** Once the user answers, provide concise, constructive, and realistic feedback in ${targetLanguage}. If the answer is weak, evasive, or lacks structure (like the STAR method for behavioral questions), state it clearly. Structure your feedback using markdown with these exact headings (translated to ${targetLanguage}):
      - **Score:** [Provide a score from 1 to 10]
      - **What you did well:** [Positive reinforcement]
      - **How you can improve:** [Specific, actionable advice]
  5.  **Transition to the Next Question:** After giving feedback, smoothly transition and ask the next question.
  6.  **Conclude the Interview:** After the agreed number of questions, conclude the interview with encouraging closing remarks in ${targetLanguage}.`;
  }

  instruction += `

Maintain a professional, encouraging, and supportive tone. Remember to tailor the questions and context to the Indian job market.
`;
  
  const userContext = `The user's profile is: Professional: ${config.userProfile.professionalProfile}, Aspirations: ${config.userProfile.aspirations}, Target Career: ${config.userProfile.targetCareer}.`;

  switch (config.type) {
    case 'Behavioral':
      instruction += `
This is a BEHAVIORAL interview. Focus on past experiences and soft skills. Ask questions that can be answered using the STAR method.`;
      break;
    case 'Skill-Based':
       // This case is now handled by a different UI and service function, but we keep the instruction for reference or potential fallback.
      instruction += `
This is a SKILL-BASED interview. Ask technical or practical questions relevant to the user's target career: "${config.userProfile.targetCareer}". Use their professional profile for context. ${userContext}`;
      break;
    case 'Situational':
      instruction += `
This is a SITUATIONAL interview. Present hypothetical "what would you do if..." scenarios to gauge judgment and problem-solving skills.`;
      break;
    case 'Elevator Pitch':
      instruction += `
This session is for ELEVATOR PITCH PRACTICE. Your first and only question should be "Tell me about yourself." (in ${targetLanguage}). After the user responds, provide detailed feedback on their response, focusing on clarity, impact, and relevance. Give them a chance to refine it. Conclude the session after the feedback.`;
      break;
    case 'Specific Job':
      instruction += `
This interview is for a SPECIFIC JOB. Base all your questions (technical, behavioral, case-study) on the following job description:
---
${config.jobDescription}
---`;
      break;
  }

  if (config.company) {
    instruction += `
The user is potentially interviewing with ${config.company}. You can tailor questions to the company's likely culture and values if it is a well-known company.`;
  }

  if (config.numQuestions && config.type !== 'Elevator Pitch') {
    instruction += `
Conduct an interview with approximately ${config.numQuestions.split('-')[0]} questions.`;
  }

  if (config.sessionDuration && config.sessionDuration !== 'No time limit') {
    instruction += `
The total session duration should be approximately ${config.sessionDuration}. You must manage the time by keeping your questions and feedback concise to fit within this limit and inform the user when the time is up.`;
  }
  
  return instruction;
}


export function createTargetedInterviewChatSession(config: InterviewConfig, language: string): Chat {
  const instruction = getInterviewSystemInstruction(config, language, false);

  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: instruction,
    },
  });
}

export async function generateTechnicalInterviewQuestions(config: InterviewConfig, language: string): Promise<TechnicalQuestion[]> {
    const targetLanguage = getLanguageName(language);
    try {
        const response = await withRetry(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `You are a senior software engineer conducting a technical interview. The candidate's target role is '${config.userProfile.targetCareer}'. Their skills are: ${JSON.stringify(config.userProfile.skills)}.
            Generate ${config.numQuestions?.split('-')[0] || 3} technical interview questions suitable for this role and their skill level.
            The questions should cover common data structures, algorithms, and role-specific concepts.
            Return the questions as a JSON object, with the question text in ${targetLanguage}.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        questions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    question: { type: Type.STRING }
                                },
                                required: ['question']
                            }
                        }
                    },
                    required: ['questions']
                },
            },
        }));
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        return result.questions as TechnicalQuestion[];
    } catch (error) {
        console.error("Error generating technical questions:", error);
        const message = parseErrorMessage(error, "Failed to generate technical interview questions.");
        throw new Error(message);
    }
}

export async function generateTechnicalInterviewFeedback(questions: TechnicalQuestion[], answers: string[], language: string): Promise<TechnicalFeedback> {
    const targetLanguage = getLanguageName(language);
    try {
        const qaPairs = questions.map((q, i) => ({ question: q.question, answer: answers[i] || "No answer provided." }));
        const response = await withRetry(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `You are a senior software engineer providing feedback on a technical interview. Your entire response must be in ${targetLanguage}.
            Here are the questions that were asked and the candidate's answers:
            ${JSON.stringify(qaPairs)}

            Your task is to provide a JSON object with the following structure, with all text values in ${targetLanguage}:
            1.  'overallSummary': A concise summary of the candidate's performance, highlighting strengths and key areas for improvement.
            2.  'overallScore': A single integer score from 1 to 10 representing their overall performance.
            3.  'questionFeedback': An array of objects. For each question/answer pair, provide:
                - 'question': The original question.
                - 'answer': The candidate's answer.
                - 'feedback': Specific, constructive feedback. Evaluate for correctness, efficiency (mention Big O notation if applicable), and code clarity/style.
                - 'score': An integer score from 1 to 10 for that specific answer.

            The output must be a valid JSON object.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        overallSummary: { type: Type.STRING },
                        overallScore: { type: Type.NUMBER },
                        questionFeedback: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    question: { type: Type.STRING },
                                    answer: { type: Type.STRING },
                                    feedback: { type: Type.STRING },
                                    score: { type: Type.NUMBER },
                                },
                                required: ['question', 'answer', 'feedback', 'score']
                            }
                        }
                    },
                    required: ['overallSummary', 'overallScore', 'questionFeedback']
                },
            },
        }));
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as TechnicalFeedback;
    } catch (error) {
        console.error("Error generating technical feedback:", error);
        const message = parseErrorMessage(error, "Failed to generate interview feedback.");
        throw new Error(message);
    }
}

export async function getElevatorPitchFeedback(pitch: string, language: string): Promise<ElevatorPitchFeedback> {
  const targetLanguage = getLanguageName(language);
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an expert career coach for Indian professionals. Analyze the following elevator pitch. Your entire response MUST be in ${targetLanguage}.
      The pitch should ideally be concise (around 60-90 seconds when spoken), clear, and impactful. It should cover:
      1.  Who they are (e.g., their professional identity).
      2.  What they've done (key experiences, skills, accomplishments).
      3.  What they're looking for (their career goal or what they want next).

      Provide feedback in a JSON format. The feedback, including all text values, should be in ${targetLanguage}:
      - 'overallAssessment': A brief, constructive summary of the pitch.
      - 'clarityScore': A score from 1-10 on how clear and easy to understand the pitch is.
      - 'impactScore': A score from 1-10 on how memorable and impactful the pitch is.
      - 'completenessScore': A score from 1-10 on whether the pitch covers the three key areas (who, what, what next).
      - 'structureFeedback': Feedback on the structure and flow. Does it tell a coherent story?
      - 'suggestionForImprovement': Specific, actionable suggestions to make the pitch better. Use markdown for formatting.

      The output must be a valid JSON object.

      Pitch to analyze:
      ---
      ${pitch}
      ---`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallAssessment: { type: Type.STRING },
            clarityScore: { type: Type.NUMBER },
            impactScore: { type: Type.NUMBER },
            completenessScore: { type: Type.NUMBER },
            structureFeedback: { type: Type.STRING },
            suggestionForImprovement: { type: Type.STRING },
          },
          required: ['overallAssessment', 'clarityScore', 'impactScore', 'completenessScore', 'structureFeedback', 'suggestionForImprovement']
        },
      },
    }));

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as ElevatorPitchFeedback;
  } catch (error) {
    console.error("Error generating elevator pitch feedback:", error);
    const message = parseErrorMessage(error, "Failed to generate feedback for the pitch.");
    throw new Error(message);
  }
}