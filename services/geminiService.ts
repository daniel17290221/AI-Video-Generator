
import { GoogleGenAI, Type } from '@google/genai';
import { VideoGenerationOperation, DetailedVideoPrompt } from '../types';

// Utility function to convert Blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Remove the data:image/jpeg;base64, prefix
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      } else {
        reject(new Error("Failed to convert blob to base64 string."));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const pollOperation = async (ai: GoogleGenAI, operation: VideoGenerationOperation): Promise<VideoGenerationOperation> => {
  let currentOperation = operation;
  while (!currentOperation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
    currentOperation = await ai.operations.getVideosOperation({ operation: currentOperation }) as VideoGenerationOperation;
  }
  return currentOperation;
};

// Removed generateVideoFromText and generateVideoFromImage as they are no longer used by PromptGenerator.

export const generateDetailedVideoPrompt = async (
  idea: string,
  options: {
    characters?: string[];
    scenarios?: string[];
    cameraAngles?: string[];
    styles?: string[];
  },
  geminiApiKey: string,
): Promise<DetailedVideoPrompt> => {
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  // Construct the prompt with user's idea and selected options
  let fullPrompt = `사용자의 간단한 비디오 아이디어를 바탕으로, 다음 JSON 스키마에 맞춰 상세하고 창의적인 비디오 프롬프트를 생성해 주세요. 비디오 생성 AI 모델(예: Veo, Sora)이 고품질 비디오를 만들 수 있도록 충분히 구체적이고 상상력을 자극하는 내용을 포함해야 합니다. 특히 "full_text_prompt" 필드는 모든 요소를 종합한 하나의 완성된 텍스트 프롬프트여야 합니다.

사용자의 아이디어: "${idea}"\n`;

  if (options.characters && options.characters.length > 0) {
    fullPrompt += `포함하고 싶은 인물 특징: ${options.characters.join(', ')}\n`;
  }
  if (options.scenarios && options.scenarios.length > 0) {
    fullPrompt += `포함하고 싶은 상황/줄거리: ${options.scenarios.join(', ')}\n`;
  }
  if (options.cameraAngles && options.cameraAngles.length > 0) {
    fullPrompt += `선호하는 카메라 각도: ${options.cameraAngles.join(', ')}\n`;
  }
  if (options.styles && options.styles.length > 0) {
    fullPrompt += `선호하는 비디오 스타일/필터: ${options.styles.join(', ')}\n`;
  }

  fullPrompt += `
`; // Add a newline for separation before schema instruction

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "비디오의 제목" },
      genre: { type: Type.STRING, description: "비디오의 장르 (예: 판타지, 코미디, SF 등)" },
      characters: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "인물 이름" },
            description: { type: Type.STRING, description: "인물 특징 및 외형" },
            costume: { type: Type.STRING, description: "의상" }
          },
          required: ["name", "description"]
        },
        description: "등장인물 목록"
      },
      scenario: { type: Type.STRING, description: "비디오의 주요 상황 및 줄거리" },
      background: { type: Type.STRING, description: "비디오의 배경 및 설정" },
      camera_angle: { type: Type.STRING, description: "비디오의 주요 카메라 각도 또는 샷" }, // New
      style: { type: Type.STRING, description: "비디오의 시각적 스타일 또는 필터" }, // New
      dialogue_snippets: {
        type: Type.ARRAY,
        items: { type: Type.STRING, description: "핵심 대사 스니펫" },
        description: "비디오에 포함될 수 있는 대사 스니펫"
      },
      music_mood: { type: Type.STRING, description: "음악의 분위기 (예: 웅장한, 신비로운, 경쾌한 등)" },
      sound_effects: {
        type: Type.ARRAY,
        items: { type: Type.STRING, description: "효과음 설명" },
        description: "비디오에 필요한 주요 효과음"
      },
      full_text_prompt: { type: Type.STRING, description: "위 요소들을 종합한 상세 텍스트 프롬프트" }
    },
    required: ["title", "scenario", "background", "full_text_prompt"]
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Model for complex text generation
      contents: [{ parts: [{ text: fullPrompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.9,
        topP: 0.95,
        topK: 64,
      },
    });

    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr) as DetailedVideoPrompt;

  } catch (error: any) {
    console.error("Error generating detailed video prompt:", error);
    throw new Error(`상세 비디오 프롬프트 생성에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
  }
};

/**
 * Tests the validity of a Gemini API key by making a simple generateContent call.
 * @param geminiApiKey The Gemini API key to test.
 * @returns Promise that resolves if the key is valid, rejects with an error otherwise.
 */
export const testGeminiApiKey = async (geminiApiKey: string): Promise<void> => {
  if (!geminiApiKey) {
    throw new Error('API 키가 비어있습니다.');
  }
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
  try {
    // Make a minimal call to check API key validity
    await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'hello',
      config: {
        maxOutputTokens: 1, // Minimize token usage for the test
        thinkingConfig: { thinkingBudget: 0 } // Disable thinking for speed
      }
    });
    // If no error is thrown, the key is considered valid for basic access
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      throw new Error('잘못되었거나 권한이 없는 Gemini API 키입니다.');
    } else if (error.status === 429) {
      throw new Error('Gemini API 요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.');
    }
    // For other errors, rethrow the original message
    throw new Error(`API 테스트 중 오류 발생: ${error.message || '알 수 없는 오류'}`);
  }
};
