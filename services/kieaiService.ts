
import { VideoGenerationOperation } from '../types';

const KIE_AI_BASE_URL = 'https://api.kie.ai/api/v1'; // Base URL changed for Veo 3.1
const KIE_AI_FILE_UPLOAD_BASE_URL = 'https://kieai.redpandaai.co'; // Base URL for file upload API
const SEEDANCE_MODEL_NAME = 'bytedance/seedance-1.5-pro';
const WAN26_T2V_MODEL_NAME = 'wan/2-6-text-to-video';
// Added new model names for Wan 2.6 Image-to-Video and Video-to-Video
const WAN26_I2V_MODEL_NAME = 'wan/2-6-image-to-video';
const WAN26_V2V_MODEL_NAME = 'wan/2-6-video-to-video';
const KLING26_T2V_MODEL_NAME = 'kling/2-6-text-to-video';
// New: Kling 2.6 Image To Video Model Name
const KLING26_I2V_MODEL_NAME = 'kling-2.6/image-to-video';
const GROK_IMAGINE_I2V_MODEL_NAME = 'grok-imagine/image-to-video';
// New: Grok Imagine Text To Video Model Name
export const GROK_IMAGINE_T2V_MODEL_NAME = 'grok-imagine/text-to-video'; // Exported for use in GrokImagineGenerator
// Grok Imagine Upscale Model Name removed as per user request
const HAILUO23_I2V_PRO_MODEL_NAME = 'hailuo/2-3-image-to-video-pro';
// Added model name for Hailuo 2.3 Image-to-Video Standard
const HAILUO23_I2V_STANDARD_MODEL_NAME = 'hailuo/2-3-image-to-video-standard';

// Updated Sora 2 model names to distinguish Pro/Non-Pro and T2V/I2V
export const SORA2_PRO_T2V_MODEL_NAME = 'sora-2-pro-text-to-video';
export const SORA2_PRO_I2V_MODEL_NAME = 'sora-2-pro-image-to-video'; // New model name
export const SORA2_T2V_MODEL_NAME = 'sora-2-text-to-video'; // New model name (non-Pro alternative)
export const SORA2_I2V_MODEL_NAME = 'sora-2-image-to-video'; // New model name (non-Pro alternative)
export const SORA2_WATERMARK_REMOVER_MODEL_NAME = 'sora-watermark-remover'; // New model name for Watermark Remover
export const SORA2_CHARACTERS_MODEL_NAME = 'sora-2-characters'; // New model name for Characters
export const SORA2_PRO_STORYBOARD_MODEL_NAME = 'sora-2-pro-storyboard'; // New model name for Storyboard

// Export VEO31_FAST_MODEL_NAME to fix the import error in Veo31Generator.tsx
export const VEO31_FAST_MODEL_NAME = 'veo3_fast'; // New model name for Veo 3.1 Fast
// Export VEO31_QUALITY_MODEL_NAME to fix the import error in Veo31Generator.tsx
export const VEO31_QUALITY_MODEL_NAME = 'veo3'; // New model name for Veo 3.1 Quality

interface Shot {
  Scene: string;
  duration: number;
}

// General interfaces for Kie.ai task creation and query (for models using /api/v1/jobs/createTask)
interface KieAiCreateTaskPayload {
  model: string;
  input: {
    prompt?: string; // Made optional as some models might not require it or have it conditional
    // Common optional fields for various models
    input_urls?: string[]; // Used by Seedance
    image_urls?: string[]; // Used by Kling, Grok Imagine, Wan 2.6 I2V, Sora 2 I2V (plural if multiple images supported)
    image_url?: string; // Used by Hailuo 2.3 (singular)
    video_urls?: string[]; // Added for Wan 2.6 V2V, also for Sora 2 Characters
    aspect_ratio?: string; // Used by Wan 2.6, Hailuo 2.3, Sora 2
    resolution?: string; // Used by Wan 2.6, Hailuo 2.3
    duration?: string; // Used by Wan 2.6, Hailuo 2.3
    fixed_lens?: boolean;
    generate_audio?: boolean; // Used by Seedance
    multi_shots?: boolean; // Specific to Wan 2.6
    sound?: boolean; // Specific to Kling 2.6
    // Grok Imagine specific fields
    task_id?: string; // Used for I2V
    index?: number; // Used for I2V
    mode?: 'fun' | 'normal' | 'spicy';
    // Sora 2 specific fields (general video generation)
    n_frames?: string; // '10', '15', '25' - also used for storyboard
    size?: 'standard' | 'high';
    remove_watermark?: boolean; // For Sora 2 video generation
    video_url?: string; // For Sora watermark remover
    character_prompt?: string; // For Sora 2 Characters
    safety_instruction?: string; // For Sora 2 Characters
    character_file_url?: string[]; // For Sora 2 Characters (array but currently 1 element)
    shots?: Shot[]; // For Sora 2 Storyboard
    // Add other model-specific input parameters here as needed
  };
  callBackUrl?: string;
}

// Veo 3.1 Specific Payload (uses a different endpoint and body structure)
interface Veo31CreateTaskPayload {
  prompt: string;
  imageUrls?: string[]; // Note: 's' for plural
  model?: 'veo3' | 'veo3_fast'; // Veo 3.1 specific model type
  generationType?: 'TEXT_2_VIDEO' | 'FIRST_AND_LAST_FRAMES_2_VIDEO' | 'REFERENCE_2_VIDEO';
  aspectRatio?: '16:9' | '9:16' | 'Auto';
  seeds?: number; // Integer between 10000-99999
  callBackUrl?: string;
  enableFallback?: boolean; // Deprecated but included for full spec matching
  enableTranslation?: boolean;
  watermark?: string;
}

interface KieAiCreateTaskResponse {
  code: number;
  msg: string;
  data?: {
    taskId: string;
  };
}

// Updated KieAiQueryTaskResponse to handle resultObject for character_id
interface KieAiQueryTaskResponse {
  code: number;
  msg: string;
  data?: {
    taskId: string;
    model: string;
    state: 'waiting' | 'success' | 'fail';
    param: string;
    resultJson?: string; // JSON string containing resultUrls OR resultObject
    failCode?: string;
    failMsg?: string;
    costTime?: number;
    completeTime?: number;
    createTime: number;
  };
}

// Kie.ai File Upload API Response
interface KieAiFileUploadResponse {
  success: boolean;
  code: number;
  msg: string;
  data: {
    fileId: string;
    fileName: string;
    originalName: string;
    fileSize: number;
    mimeType: string;
    uploadPath: string;
    fileUrl: string;
    downloadUrl: string;
    uploadTime: string;
    expiresAt: string;
  };
}

/**
 * Creates a video generation task using a specified Kie.ai model.
 * This is for models using the general /api/v1/jobs/createTask endpoint.
 * @param kieAIApiKey The API key for Kie.ai.
 * @param modelName The specific model name (e.g., 'bytedance/seedance-1.5-pro').
 * @param payload The request payload for video generation, excluding the model name.
 * @returns The taskId if the task was created successfully.
 */
const createKieAiTask = async (kieAIApiKey: string, modelName: string, payload: Omit<KieAiCreateTaskPayload, 'model'>): Promise<string> => {
  if (!kieAIApiKey) {
    throw new Error('Kie.ai API 키가 제공되지 않았습니다.');
  }

  const fullPayload: KieAiCreateTaskPayload = {
    model: modelName,
    ...payload,
  };

  try {
    const response = await fetch(`${KIE_AI_BASE_URL}/jobs/createTask`, { // Uses /jobs/createTask
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${kieAIApiKey}`,
      },
      body: JSON.stringify(fullPayload),
    });

    const data: KieAiCreateTaskResponse = await response.json();

    if (data.code !== 200 || !data.data?.taskId) {
      throw new Error(`Failed to create Kie.ai task for ${modelName}: ${data.msg || 'Unknown error'}`);
    }
    return data.data.taskId;
  } catch (error: any) {
    console.error(`Error creating Kie.ai task for ${modelName}:`, error);
    throw new Error(`${modelName} 작업 생성에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
  }
};

/**
 * Creates a video generation task using the Veo 3.1 specific API endpoint.
 * @param kieAIApiKey The API key for Kie.ai.
 * @param payload The request payload for Veo 3.1 video generation.
 * @returns The taskId if the task was created successfully.
 */
export const createVeo31Task = async (kieAIApiKey: string, payload: Veo31CreateTaskPayload): Promise<string> => {
  if (!kieAIApiKey) {
    throw new Error('Kie.ai API 키가 제공되지 않았습니다.');
  }

  try {
    // Veo 3.1 uses a different endpoint and direct payload structure
    const response = await fetch(`${KIE_AI_BASE_URL}/veo/generate`, { // Uses /veo/generate
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${kieAIApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data: KieAiCreateTaskResponse = await response.json();

    if (data.code !== 200 || !data.data?.taskId) {
      throw new Error(`Failed to create Veo 3.1 task: ${data.msg || 'Unknown error'}`);
    }
    return data.data.taskId;
  } catch (error: any) {
    console.error('Error creating Veo 3.1 task:', error);
    throw new Error(`Veo 3.1 작업 생성에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
  }
};


/**
 * Queries the status of a Kie.ai video generation task.
 * @param kieAIApiKey The API key for Kie.ai.
 * @param taskId The ID of the task to query.
 * @returns The task status and results if available.
 */
const getKieAiTaskStatus = async (kieAIApiKey: string, taskId: string): Promise<KieAiQueryTaskResponse['data']> => {
  if (!kieAIApiKey) {
    throw new Error('Kie.ai API 키가 제공되지 않았습니다.');
  }

  try {
    const response = await fetch(`${KIE_AI_BASE_URL}/jobs/recordInfo?taskId=${taskId}`, { // Uses /jobs/recordInfo
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${kieAIApiKey}`,
      },
    });

    const data: KieAiQueryTaskResponse = await response.json();

    if (data.code !== 200 || !data.data) {
      throw new Error(`Failed to query Kie.ai task status: ${data.msg || 'Unknown error'}`);
    }
    return data.data;
  } catch (error: any) {
    console.error('Error querying Kie.ai task status:', error);
    throw new Error(`Kie.ai 작업 상태 조회에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
  }
};

/**
 * Polls the status of a Kie.ai task until it succeeds or fails.
 * @param kieAIApiKey The API key for Kie.ai.
 * @param taskId The ID of the task to poll.
 * @returns The first video URL on success.
*/
export const pollKieAiOperation = async (kieAIApiKey: string, taskId: string): Promise<string> => {
  let attempts = 0;
  const maxAttempts = 120; // Max 10 minutes (120 * 5s)
  while (attempts < maxAttempts) {
    const status = await getKieAiTaskStatus(kieAIApiKey, taskId);
    if (status?.state === 'success') {
      if (status.resultJson) {
        const result = JSON.parse(status.resultJson);
        // Handle both resultUrls (for video/image generation) and resultObject (for character_id)
        if (result.resultUrls && result.resultUrls.length > 0) {
          return result.resultUrls[0]; // Return the first URL (can be image or video)
        } else if (result.resultObject && result.resultObject.character_id) {
          // For sora-2-characters, the result is a character_id, not a video URL.
          // This specific polling function still returns string, so we'll return the ID string.
          // The component should handle parsing the resultJson if needed for more details.
          return result.resultObject.character_id;
        }
      }
      throw new Error('Kie.ai 작업은 성공했지만 결과 URL이나 캐릭터 ID를 찾을 수 없습니다.');
    } else if (status?.state === 'fail') {
      throw new Error(`Kie.ai 작업 실패: ${status.failMsg || '알 수 없는 오류'}`);
    }
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
  }
  throw new Error('Kie.ai 작업이 시간 초과되었습니다.');
};

// --- Kie.ai File Upload Functions ---
/**
 * Helper to convert File to Data URL for Base64 upload.
 * @param file The File object to convert.
 * @returns A Promise that resolves with the Data URL string.
 */
export const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Uploads a file to Kie.ai using the Base64 File Upload API.
 * @param kieAIApiKey The Kie.ai API key.
 * @param file The File object to upload.
 * @param uploadPath The desired upload path (e.g., 'images/user-uploads').
 * @param fileName Optional custom file name (e.g., 'my-image.jpg').
 * @returns A Promise that resolves with the `fileUrl` from Kie.ai.
 */
export const uploadFileToBase64 = async (
  kieAIApiKey: string,
  file: File,
  uploadPath: string,
  fileName: string = file.name,
): Promise<string> => {
  if (!kieAIApiKey) {
    throw new Error('Kie.ai API 키가 제공되지 않아 파일을 업로드할 수 없습니다.');
  }

  const base64Data = await fileToDataURL(file); // Get the data URL format

  try {
    const response = await fetch(`${KIE_AI_FILE_UPLOAD_BASE_URL}/api/file-base64-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kieAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Data: base64Data,
        uploadPath: uploadPath,
        fileName: fileName,
      }),
    });

    const data: KieAiFileUploadResponse = await response.json();

    if (!response.ok || !data.success || !data.data?.fileUrl) {
      throw new Error(`Kie.ai 파일 업로드 실패: ${data.msg || response.statusText}`);
    }
    return data.data.fileUrl;
  } catch (error: any) {
    console.error('Kie.ai 파일 업로드 중 오류 발생:', error);
    throw new Error(`파일 업로드에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
  }
};


// --- Seedance 1.5 Pro Specific Functions ---
export const createSeedanceTask = async (kieAIApiKey: string, payload: Omit<KieAiCreateTaskPayload, 'model'>): Promise<string> => {
  return createKieAiTask(kieAIApiKey, SEEDANCE_MODEL_NAME, payload);
};

export const getSeedanceTaskStatus = async (kieAIApiKey: string, taskId: string): Promise<KieAiQueryTaskResponse['data']> => {
  return getKieAiTaskStatus(kieAIApiKey, taskId);
};

export const pollSeedanceOperation = async (kieAIApiKey: string, taskId: string): Promise<string> => {
  return pollKieAiOperation(kieAIApiKey, taskId);
};

// --- Wan 2.6 Text To Video Specific Functions ---
export const createWan26T2VTask = async (kieAIApiKey: string, payload: Omit<KieAiCreateTaskPayload, 'model'>): Promise<string> => {
  return createKieAiTask(kieAIApiKey, WAN26_T2V_MODEL_NAME, payload);
};

export const getWan26T2VTaskStatus = async (kieAIApiKey: string, taskId: string): Promise<KieAiQueryTaskResponse['data']> => {
  return getKieAiTaskStatus(kieAIApiKey, taskId);
};

export const pollWan26T2VOperation = async (kieAIApiKey: string, taskId: string): Promise<string> => {
  return pollKieAiOperation(kieAIApiKey, taskId);
};

// --- Wan 2.6 Image To Video Specific Functions ---
export const createWan26I2VTask = async (kieAIApiKey: string, payload: Omit<KieAiCreateTaskPayload, 'model'>): Promise<string> => {
  return createKieAiTask(kieAIApiKey, WAN26_I2V_MODEL_NAME, payload);
};

export const getWan26I2VTaskStatus = async (kieAIApiKey: string, taskId: string): Promise<KieAiQueryTaskResponse['data']> => {
  return getKieAiTaskStatus(kieAIApiKey, taskId);
};

export const pollWan26I2VOperation = async (kieAIApiKey: string, taskId: string): Promise<string> => {
  return pollKieAiOperation(kieAIApiKey, taskId);
};

// --- Wan 2.6 Video To Video Specific Functions ---
export const createWan26V2VTask = async (kieAIApiKey: string, payload: Omit<KieAiCreateTaskPayload, 'model'>): Promise<string> => {
  return createKieAiTask(kieAIApiKey, WAN26_V2V_MODEL_NAME, payload);
};

export const getWan26V2VTaskStatus = async (kieAIApiKey: string, taskId: string): Promise<KieAiQueryTaskResponse['data']> => {
  return getKieAiTaskStatus(kieAIApiKey, taskId);
};

export const pollWan26V2VOperation = async (kieAIApiKey: string, taskId: string): Promise<string> => {
  return pollKieAiOperation(kieAIApiKey, taskId);
};

// --- Kling 2.6 Text To Video Specific Functions ---
export const createKling26T2VTask = async (kieAIApiKey: string, payload: Omit<KieAiCreateTaskPayload, 'model'>): Promise<string> => {
  return createKieAiTask(kieAIApiKey, KLING26_T2V_MODEL_NAME, payload);
};

export const getKling26T2VTaskStatus = async (kieAIApiKey: string, taskId: string): Promise<KieAiQueryTaskResponse['data']> => {
  return getKieAiTaskStatus(kieAIApiKey, taskId);
};

export const pollKling26T2VOperation = async (kieAIApiKey: string, taskId: string): Promise<string> => {
  return pollKieAiOperation(kieAIApiKey, taskId);
};

// New: Kling 2.6 Image To Video Specific Functions
export const createKling26I2VTask = async (kieAIApiKey: string, payload: Omit<KieAiCreateTaskPayload, 'model'>): Promise<string> => {
  return createKieAiTask(kieAIApiKey, KLING26_I2V_MODEL_NAME, payload);
};

export const getKling26I2VTaskStatus = async (kieAIApiKey: string, taskId: string): Promise<KieAiQueryTaskResponse['data']> => {
  return getKieAiTaskStatus(kieAIApiKey, taskId);
};

export const pollKling26I2VOperation = async (kieAIApiKey: string, taskId: string): Promise<string> => {
  return pollKieAiOperation(kieAIApiKey, taskId);
};

// --- Grok Imagine Image To Video Specific Functions ---
export const createGrokImagineI2VTask = async (kieAIApiKey: string, payload: Omit<KieAiCreateTaskPayload, 'model'>): Promise<string> => {
  return createKieAiTask(kieAIApiKey, GROK_IMAGINE_I2V_MODEL_NAME, payload);
};

export const getGrokImagineI2VTaskStatus = async (kieAIApiKey: string, taskId: string): Promise<KieAiQueryTaskResponse['data']> => {
  return getKieAiTaskStatus(kieAIApiKey, taskId);
};

export const pollGrokImagineI2VOperation = async (kieAIApiKey: string, taskId: string): Promise<string> => {
  return pollKieAiOperation(kieAIApiKey, taskId);
};

// New: Grok Imagine Text To Video Specific Functions
export const createGrokImagineT2VTask = async (kieAIApiKey: string, payload: Omit<KieAiCreateTaskPayload, 'model'>): Promise<string> => {
  return createKieAiTask(kieAIApiKey, GROK_IMAGINE_T2V_MODEL_NAME, payload);
};

export const getGrokImagineT2VTaskStatus = async (kieAIApiKey: string, taskId: string): Promise<KieAiQueryTaskResponse['data']> => {
  return getKieAiTaskStatus(kieAIApiKey, taskId);
};

export const pollGrokImagineT2VOperation = async (kieAIApiKey: string, taskId: string): Promise<string> => {
  return pollKieAiOperation(kieAIApiKey, taskId);
};

// Grok Imagine Upscale Specific Functions removed as per user request


// --- Hailuo 2.3 Image To Video Pro Specific Functions ---
export const createHailuo23I2VProTask = async (kieAIApiKey: string, payload: Omit<KieAiCreateTaskPayload, 'model'>): Promise<string> => {
  return createKieAiTask(kieAIApiKey, HAILUO23_I2V_PRO_MODEL_NAME, payload);
};

export const getHailuo23I2VProTaskStatus = async (kieAIApiKey: string, taskId: string): Promise<KieAiQueryTaskResponse['data']> => {
  return getKieAiTaskStatus(kieAIApiKey, taskId);
};

export const pollHailuo23I2VProOperation = async (kieAIApiKey: string, taskId: string): Promise<string> => {
  return pollKieAiOperation(kieAIApiKey, taskId);
};

// --- Hailuo 2.3 Image To Video Standard Specific Functions ---
export const createHailuo23I2VStandardTask = async (kieAIApiKey: string, payload: Omit<KieAiCreateTaskPayload, 'model'>): Promise<string> => {
  return createKieAiTask(kieAIApiKey, HAILUO23_I2V_STANDARD_MODEL_NAME, payload);
};

export const getHailuo23I2VStandardTaskStatus = async (kieAIApiKey: string, taskId: string): Promise<KieAiQueryTaskResponse['data']> => {
  return getKieAiTaskStatus(kieAIApiKey, taskId);
};

export const pollHailuo23I2VStandardOperation = async (kieAIApiKey: string, taskId: string): Promise<string> => {
  return pollKieAiOperation(kieAIApiKey, taskId);
};

// --- Sora 2 Pro Text To Video Specific Functions ---
export const createSora2ProT2VTask = async (kieAIApiKey: string, payload: Omit<KieAiCreateTaskPayload, 'model'>): Promise<string> => {
  return createKieAiTask(kieAIApiKey, SORA2_PRO_T2V_MODEL_NAME, payload);
};

export const getSora2ProT2VTaskStatus = async (kieAIApiKey: string, taskId: string): Promise<KieAiQueryTaskResponse['data']> => {
  return getKieAiTaskStatus(kieAIApiKey, taskId);
};

export const pollSora2ProT2VOperation = async (kieAIApiKey: string, taskId: string): Promise<string> => {
  return pollKieAiOperation(kieAIApiKey, taskId);
};

// --- Sora 2 Pro Image To Video Specific Functions (New) ---
export const createSora2ProI2VTask = async (kieAIApiKey: string, payload: Omit<KieAiCreateTaskPayload, 'model'>): Promise<string> => {
  return createKieAiTask(kieAIApiKey, SORA2_PRO_I2V_MODEL_NAME, payload);
};

export const getSora2ProI2VTaskStatus = async (kieAIApiKey: string, taskId: string): Promise<KieAiQueryTaskResponse['data']> => {
  return getKieAiTaskStatus(kieAIApiKey, taskId);
};

export const pollSora2ProI2VOperation = async (kieAIApiKey: string, taskId: string): Promise<string> => {
  return pollKieAiOperation(kieAIApiKey, taskId);
};

// --- Sora 2 Text To Video Specific Functions (New) ---
export const createSora2T2VTask = async (kieAIApiKey: string, payload: Omit<KieAiCreateTaskPayload, 'model'>): Promise<string> => {
  return createKieAiTask(kieAIApiKey, SORA2_T2V_MODEL_NAME, payload);
};

export const getSora2T2VTaskStatus = async (kieAIApiKey: string, taskId: string): Promise<KieAiQueryTaskResponse['data']> => {
  return getKieAiTaskStatus(kieAIApiKey, taskId);
};

export const pollSora2T2VOperation = async (kieAIApiKey: string, taskId: string): Promise<string> => {
  return pollKieAiOperation(kieAIApiKey, taskId);
};

// --- Sora 2 Image To Video Specific Functions (New) ---
export const createSora2I2VTask = async (kieAIApiKey: string, payload: Omit<KieAiCreateTaskPayload, 'model'>): Promise<string> => {
  return createKieAiTask(kieAIApiKey, SORA2_I2V_MODEL_NAME, payload);
};

export const getSora2I2VTaskStatus = async (kieAIApiKey: string, taskId: string): Promise<KieAiQueryTaskResponse['data']> => {
  return getKieAiTaskStatus(kieAIApiKey, taskId);
};

export const pollSora2I2VOperation = async (kieAIApiKey: string, taskId: string): Promise<string> => {
  return pollKieAiOperation(kieAIApiKey, taskId);
};

// --- Sora 2 Watermark Remover Specific Functions (New) ---
export const createSora2WatermarkRemoverTask = async (kieAIApiKey: string, payload: Omit<KieAiCreateTaskPayload, 'model'>): Promise<string> => {
  return createKieAiTask(kieAIApiKey, SORA2_WATERMARK_REMOVER_MODEL_NAME, payload);
};

export const getSora2WatermarkRemoverTaskStatus = async (kieAIApiKey: string, taskId: string): Promise<KieAiQueryTaskResponse['data']> => {
  return getKieAiTaskStatus(kieAIApiKey, taskId);
};

export const pollSora2WatermarkRemoverOperation = async (kieAIApiKey: string, taskId: string): Promise<string> => {
  return pollKieAiOperation(kieAIApiKey, taskId);
};

// --- Sora 2 Characters Specific Functions (New) ---
export const createSora2CharactersTask = async (kieAIApiKey: string, payload: Omit<KieAiCreateTaskPayload, 'model'>): Promise<string> => {
  return createKieAiTask(kieAIApiKey, SORA2_CHARACTERS_MODEL_NAME, payload);
};

export const getSora2CharactersTaskStatus = async (kieAIApiKey: string, taskId: string): Promise<KieAiQueryTaskResponse['data']> => {
  return getKieAiTaskStatus(kieAIApiKey, taskId);
};

// This poll function specifically returns the character_id string
export const pollSora2CharactersOperation = async (kieAIApiKey: string, taskId: string): Promise<{character_id: string, rawJson: string}> => {
  let attempts = 0;
  const maxAttempts = 120; // Max 10 minutes (120 * 5s)
  while (attempts < maxAttempts) {
    const status = await getKieAiTaskStatus(kieAIApiKey, taskId);
    if (status?.state === 'success') {
      if (status.resultJson) {
        const result = JSON.parse(status.resultJson);
        if (result.resultObject && result.resultObject.character_id) {
          return {
            character_id: result.resultObject.character_id,
            rawJson: status.resultJson, // Return raw JSON for display
          };
        }
      }
      throw new Error('Kie.ai 작업은 성공했지만 캐릭터 ID를 찾을 수 없습니다.');
    } else if (status?.state === 'fail') {
      throw new Error(`Kie.ai 작업 실패: ${status.failMsg || '알 수 없는 오류'}`);
    }
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
  }
  throw new Error('Kie.ai 작업이 시간 초과되었습니다.');
};

// --- Sora 2 Pro Storyboard Specific Functions (New) ---
export const createSora2ProStoryboardTask = async (kieAIApiKey: string, payload: Omit<KieAiCreateTaskPayload, 'model'>): Promise<string> => {
  return createKieAiTask(kieAIApiKey, SORA2_PRO_STORYBOARD_MODEL_NAME, payload);
};

export const getSora2ProStoryboardTaskStatus = async (kieAIApiKey: string, taskId: string): Promise<KieAiQueryTaskResponse['data']> => {
  return getKieAiTaskStatus(kieAIApiKey, taskId);
};

export const pollSora2ProStoryboardOperation = async (kieAIApiKey: string, taskId: string): Promise<string> => {
  return pollKieAiOperation(kieAIApiKey, taskId);
};


// --- Veo 3.1 Specific Functions ---
// createVeo31Task is defined above
export const getVeo31TaskStatus = async (kieAIApiKey: string, taskId: string): Promise<KieAiQueryTaskResponse['data']> => {
  return getKieAiTaskStatus(kieAIApiKey, taskId);
};

export const pollVeo31Operation = async (kieAIApiKey: string, taskId: string): Promise<string> => {
  return pollKieAiOperation(kieAIApiKey, taskId);
};
