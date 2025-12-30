
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createGrokImagineI2VTask, pollGrokImagineI2VOperation, uploadFileToBase64, createGrokImagineT2VTask, pollGrokImagineT2VOperation } from '../services/kieaiService'; // Removed upscale related imports
import LoadingSpinner from './LoadingSpinner';
import DemoModelPlaceholder from './DemoModelPlaceholder';
import { DetailedVideoPrompt, GrokImagineMode } from '../types'; // Import DetailedVideoPrompt and GrokImagineMode type

interface GrokImagineGeneratorProps {
  kieAIApiKey: string;
}

// Default prompts for different modes
const DEFAULT_PROMPT_I2V = "POV hand comes into frame handing the girl a cup of take away coffee, the girl steps out of the screen looking tired, then takes it and she says happily: “thanks! Back to work” she exits the frame and walks right to a different part of the office.";
const DEFAULT_PROMPT_T2V = "A futuristic city with flying cars and towering skyscrapers, seen from a bird's eye view. Cinematic, high-detail.";

interface ImageFile {
  id: string;
  file: File;
  preview: string; // Data URL for local preview
}

const GROK_IMAGINE_LOADING_MESSAGES: Record<GrokImagineMode, string[]> = {
  't2v': [
    "Grok Imagine T2V 모델에 비디오 생성을 요청 중...",
    "당신의 텍스트를 AI가 비디오로 변환 중...",
    "일관된 모션과 동기화된 오디오를 생성하고 있습니다...",
    "이 작업은 몇 분 정도 소요될 수 있습니다. 잠시만 기다려 주세요!",
    "비디오 클립을 다듬고 최종 렌더링을 진행 중...",
    "거의 다 됐습니다! 비디오 렌더링이 완료되고 있습니다...",
  ],
  'i2v': [
    "Grok Imagine I2V 모델에 비디오 생성을 요청 중...",
    "이미지를 AI가 이해하고 움직임을 부여하는 중...",
    "일관된 모션과 동기화된 오디오를 생성하고 있습니다...",
    "이 작업은 몇 분 정도 소요될 수 있습니다. 잠시만 기다려 주세요!",
    "비디오 클립을 다듬고 최종 렌더링을 진행 중...",
    "거의 다 됐습니다! 비디오 렌더링이 완료되고 있습니다...",
  ],
  // 'upscale' loading messages removed
};

const GrokImagineGenerator: React.FC<GrokImagineGeneratorProps> = ({ kieAIApiKey }) => {
  const [currentGrokImagineMode, setCurrentGrokImagineMode] = useState<GrokImagineMode>('i2v');
  const [inputImage, setInputImage] = useState<ImageFile | null>(null); // For I2V mode (external image)
  const [taskId, setTaskId] = useState<string>(''); // For I2V mode (internal task_id)
  const [index, setIndex] = useState<number>(0); // For I2V mode (internal index)
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT_I2V); // For T2V/I2V mode
  const [mode, setMode] = useState<'fun' | 'normal' | 'spicy'>('normal'); // For T2V/I2V mode

  // Upscale specific states removed
  // const [upscaleTaskId, setUpscaleTaskId] = useState<string>(''); 

  const [loading, setLoading] = useState<boolean>(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null); // For T2V/I2V output
  // Upscale output state removed
  // const [upscaledImageUrl, setUpscaledImageUrl] = useState<string | null>(null); 
  const [error, setError] = useState<string | null>(null);
  const [currentLoadingMessageIndex, setCurrentLoadingMessageIndex] = useState<number>(0);
  const messageIntervalRef = useRef<number | null>(null);

  // New states for JSON prompt input
  const [promptInputMode, setPromptInputMode] = useState<'text' | 'json'>('text');
  const [jsonPromptInput, setJsonPromptInput] = useState<string>('');

  useEffect(() => {
    return () => {
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
      }
    };
  }, []);

  // Reset inputs when switching modes
  useEffect(() => {
    // Clear video/image generation specific states
    handleRemoveImage(); // Clear I2V input image
    setTaskId('');
    setIndex(0);
    setPrompt(currentGrokImagineMode === 't2v' ? DEFAULT_PROMPT_T2V : DEFAULT_PROMPT_I2V);
    setMode('normal');

    // Clear upscale specific states (now removed)
    // setUpscaleTaskId('');

    // Clear outputs and error
    setVideoUrl(null);
    // setUpscaledImageUrl(null); // Removed
    setError(null);
    setLoading(false);
    stopLoadingMessages();

    // Reset prompt input mode
    setJsonPromptInput('');
    setPromptInputMode('text');
  }, [currentGrokImagineMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const startLoadingMessages = () => {
    setCurrentLoadingMessageIndex(0);
    messageIntervalRef.current = window.setInterval(() => {
      setCurrentLoadingMessageIndex(prevIndex => (prevIndex + 1) % GROK_IMAGINE_LOADING_MESSAGES[currentGrokImagineMode].length);
    }, 5000);
  };

  const stopLoadingMessages = () => {
    if (messageIntervalRef.current) {
      clearInterval(messageIntervalRef.current);
      messageIntervalRef.current = null;
    }
  };

  // --- Image Handling for I2V Input ---
  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (!file.type.startsWith('image/')) {
        setError('이미지 파일만 선택해주세요.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('파일 크기는 10MB를 초과할 수 없습니다.');
        return;
      }
      setError(null);
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          const previewUrl = reader.result as string;
          if (inputImage?.id) {
            URL.revokeObjectURL(inputImage.id);
          }
          setInputImage({ id: URL.createObjectURL(file), file, preview: previewUrl });
          // Clear task_id and index if an image is uploaded for I2V
          setTaskId('');
          setIndex(0);
        };
        reader.onerror = (e) => {
          setError(`파일 읽기 오류: ${e.target?.error?.message || '알 수 없는 오류'}`);
        };
        reader.readAsDataURL(file); // Use FileReader to get data URL for preview
      } catch (e: any) {
        setError(e.message || '이미지 미리보기를 생성할 수 없습니다.');
      }
      event.target.value = ''; // Clear input to allow re-uploading the same file
    }
  }, [inputImage]);

  const handleRemoveImage = useCallback(() => {
    if (inputImage?.id) {
        URL.revokeObjectURL(inputImage.id);
    }
    setInputImage(null);
    setError(null);
  }, [inputImage]);

  const handleTaskIdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTaskId(e.target.value);
    // Clear image_urls if task_id is being used for I2V
    if (e.target.value.trim()) {
        handleRemoveImage();
    }
  }, [handleRemoveImage]);

  const handleIndexChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setIndex(isNaN(val) ? 0 : Math.max(0, Math.min(5, val))); // Clamp between 0-5
  }, []);

  // --- Upscale Input Handlers (removed as per new API doc) ---
  // const handleUpscaleTaskIdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  //   setUpscaleTaskId(e.target.value);
  // }, []);

  const handleReset = useCallback(() => {
    // Reset video/image generation specific states
    handleRemoveImage();
    setTaskId('');
    setIndex(0);
    setPrompt(currentGrokImagineMode === 't2v' ? DEFAULT_PROMPT_T2V : DEFAULT_PROMPT_I2V);
    setMode('normal');

    // Reset upscale specific states (now removed)
    // setUpscaleTaskId('');

    // Clear outputs and error
    setVideoUrl(null);
    // setUpscaledImageUrl(null); // Removed
    setError(null);
    setLoading(false);
    stopLoadingMessages();

    setPromptInputMode('text');
    setJsonPromptInput('');
  }, [handleRemoveImage, currentGrokImagineMode]);

  const handleRun = async () => {
    setError(null);
    setVideoUrl(null);
    // setUpscaledImageUrl(null); // Removed

    if (!kieAIApiKey) {
      setError('Kie.ai API 키가 필요합니다.');
      return;
    }

    setLoading(true);
    startLoadingMessages();

    try {
      let finalResultUrl: string;

      if (currentGrokImagineMode === 't2v' || currentGrokImagineMode === 'i2v') {
        let finalPromptText: string | undefined = undefined;

        if (promptInputMode === 'text') {
          if (prompt.trim()) {
            if (prompt.length < 1 || prompt.length > 5000) {
              setError('프롬프트는 1자에서 5000자 사이여야 합니다.');
              setLoading(false);
              stopLoadingMessages();
              return;
            }
            finalPromptText = prompt;
          }
        } else { // JSON mode
          if (!jsonPromptInput.trim()) {
            setError('JSON 프롬프트를 입력해주세요.');
            setLoading(false);
            stopLoadingMessages();
            return;
          }
          try {
            const parsedJson: DetailedVideoPrompt = JSON.parse(jsonPromptInput);
            if (parsedJson.full_text_prompt) {
              if (parsedJson.full_text_prompt.length < 1 || parsedJson.full_text_prompt.length > 5000) {
                setError('JSON 내 "full_text_prompt"는 1자에서 5000자 사이여야 합니다.');
                setLoading(false);
                stopLoadingMessages();
                return;
              }
              finalPromptText = parsedJson.full_text_prompt;
            }
          } catch (e: any) {
            setError(`유효하지 않은 JSON 형식입니다: ${e.message}`);
            setLoading(false);
            stopLoadingMessages();
            return;
          }
        }

        let newVideoTaskId: string;
        if (currentGrokImagineMode === 't2v') {
          if (!finalPromptText) {
            setError('텍스트 투 비디오 모드에는 프롬프트가 필요합니다.');
            setLoading(false);
            stopLoadingMessages();
            return;
          }
          const t2vMode = (mode === 'spicy' ? 'normal' : mode);
          if (mode === 'spicy') {
            console.warn("Grok Imagine의 T2V 모드는 'Spicy' 모드를 지원하지 않으며, 'Normal' 모드로 자동 전환됩니다.");
          }

          newVideoTaskId = await createGrokImagineT2VTask(kieAIApiKey, {
            input: {
              prompt: finalPromptText,
              mode: t2vMode,
            },
          });
          finalResultUrl = await pollGrokImagineT2VOperation(kieAIApiKey, newVideoTaskId);

        } else { // i2v
          const hasImageUrls = inputImage !== null;
          const hasTaskId = taskId.trim() !== '';

          if (!hasImageUrls && !hasTaskId) {
            setError('이미지 투 비디오 모드에는 이미지 URL을 업로드하거나 Grok 모델에서 생성된 이미지의 Task ID를 입력해야 합니다.');
            setLoading(false);
            stopLoadingMessages();
            return;
          }
          if (hasImageUrls && hasTaskId) {
            setError('이미지 URL과 Task ID를 동시에 제공할 수 없습니다. 하나만 선택해주세요.');
            setLoading(false);
            stopLoadingMessages();
            return;
            }

          let uploadedImageUrls: string[] | undefined;
          let finalTaskId: string | undefined;
          let finalIndex: number | undefined;
          let finalMode: 'fun' | 'normal' | 'spicy' = mode;

          if (hasImageUrls) {
            uploadedImageUrls = [await uploadFileToBase64(kieAIApiKey, inputImage!.file, 'grok-input-image', inputImage!.file.name)];
            if (mode === 'spicy') {
                console.warn("외부 이미지 입력 시 'Spicy' 모드는 지원되지 않습니다. 'Normal' 모드로 자동 전환됩니다.");
                finalMode = 'normal';
            }
          } else { // hasTaskId
            finalTaskId = taskId;
            finalIndex = index;
          }

          newVideoTaskId = await createGrokImagineI2VTask(kieAIApiKey, {
            input: {
              image_urls: uploadedImageUrls,
              task_id: finalTaskId,
              index: finalIndex,
              prompt: finalPromptText,
              mode: finalMode,
            },
          });
          finalResultUrl = await pollGrokImagineI2VOperation(kieAIApiKey, newVideoTaskId);
        }
        setVideoUrl(finalResultUrl);

      } else {
        // This case should ideally not be reached if modes are correctly handled
        throw new Error('알 수 없는 Grok Imagine 모델 모드입니다.');
      }

    } catch (e: any) {
      setError(e.message || '작업 생성에 실패했습니다.');
    } finally {
      setLoading(false);
      stopLoadingMessages();
    }
  };

  // Credit cost is now fixed to 20 for T2V/I2V
  const currentCreditCost = 20;

  const isRunDisabled = loading || !kieAIApiKey ||
    // T2V mode validation
    (currentGrokImagineMode === 't2v' && (!prompt.trim() && !jsonPromptInput.trim())) ||
    // I2V mode validation
    (currentGrokImagineMode === 'i2v' && (inputImage === null && taskId.trim() === ''));
    // Upscale mode validation removed


  return (
    <div className="flex flex-col lg:flex-row space-y-8 lg:space-y-0 lg:space-x-8 p-6 bg-slate-900 rounded-lg shadow-xl border border-slate-700">
      {/* Input Section */}
      <div className="lg:w-1/2 flex flex-col space-y-6">
        {/* Model Description and Pricing */}
        <div className="mb-4">
          <p className="text-md text-slate-300 mb-2">
            Grok Imagine은 xAI의 멀티모달 이미지 및 비디오 생성 모델로, 일관된 모션과 동기화된 오디오를 통해 텍스트 또는 이미지를 짧은 시각적 출력으로 변환합니다.
          </p>
          <div className="flex flex-wrap justify-start gap-3 mb-4">
            <button
              onClick={() => setCurrentGrokImagineMode('t2v')}
              className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                          ${currentGrokImagineMode === 't2v'
                            ? 'bg-primary text-white shadow-lg'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                          }
                          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
              disabled={loading}
            >
              텍스트 투 비디오
            </button>
            <button
              onClick={() => setCurrentGrokImagineMode('i2v')}
              className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                          ${currentGrokImagineMode === 'i2v'
                            ? 'bg-primary text-white shadow-lg'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                          }
                          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
              disabled={loading}
            >
              이미지 투 비디오
            </button>
            {/* Upscale button removed */}
          </div>
          <p className="text-sm text-slate-400 bg-slate-800 p-3 rounded-lg border border-slate-700">
            <i className="ri-money-dollar-circle-line mr-2"></i>
            가격: 텍스트/이미지 투 비디오는 6초 비디오당 20 크레딧(약 $0.10)이 소모됩니다.
          </p>
        </div>

        {/* T2V & I2V Specific Inputs */}
        {(currentGrokImagineMode === 't2v' || currentGrokImagineMode === 'i2v') && (
          <>
            {/* Prompt Input Mode Selector */}
            <div className="flex justify-start gap-3 mb-4">
              <button
                onClick={() => setPromptInputMode('text')}
                className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                            ${promptInputMode === 'text'
                              ? 'bg-primary text-white shadow-lg'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                            }
                            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
                disabled={loading}
              >
                텍스트 프롬프트
              </button>
              <button
                onClick={() => setPromptInputMode('json')}
                className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                            ${promptInputMode === 'json'
                              ? 'bg-primary text-white shadow-lg'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                            }
                            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
                disabled={loading}
              >
                JSON 프롬프트
              </button>
            </div>

            {/* Prompt Input */}
            <div className="flex flex-col">
              <label htmlFor="grok-prompt-input" className="text-lg font-semibold text-slate-200 mb-2">
                프롬프트 ({currentGrokImagineMode === 'i2v' ? '비디오 모션 설명' : '비디오 내용'}) <span className="text-red-500">*</span>
              </label>
              {promptInputMode === 'text' ? (
                <textarea
                  id="grok-prompt-input"
                  className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 resize-none text-slate-50"
                  rows={currentGrokImagineMode === 'i2v' ? 3 : 5}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={currentGrokImagineMode === 'i2v'
                    ? "원하는 비디오 모션을 설명해주세요 (예: POV 손이 컵을 건네주고 여자는 고맙다고 말하며 나간다)"
                    : "생성할 비디오의 상세한 내용을 설명해주세요 (예: 미래 도시의 고층 빌딩 사이를 날아다니는 자동차)"
                  }
                  maxLength={5000}
                  minLength={1}
                  disabled={loading}
                  aria-label={`Grok Imagine 비디오 ${currentGrokImagineMode === 'i2v' ? '모션' : '텍스트'} 프롬프트 입력`}
                ></textarea>
              ) : (
                <textarea
                  id="grok-prompt-input"
                  className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 resize-none text-slate-50 font-mono"
                  rows={10}
                  value={jsonPromptInput}
                  onChange={(e) => setJsonPromptInput(e.target.value)}
                  placeholder="여기에 상세 프롬프트 JSON을 붙여넣으세요. 'full_text_prompt' 필드가 사용됩니다."
                  disabled={loading}
                  aria-label={`Grok Imagine 비디오 ${currentGrokImagineMode === 'i2v' ? '모션' : '텍스트'} JSON 프롬프트 입력`}
                ></textarea>
              )}
              <p className="text-sm text-slate-400 mt-2">
                {promptInputMode === 'text' ? `입력된 글자 수: ${prompt.length} / 5000` : `JSON 프롬프트입니다. 'full_text_prompt' 필드가 사용됩니다.`}
              </p>
            </div>

            {/* Input - Image URLs (for I2V only) */}
            {currentGrokImagineMode === 'i2v' && (
              <div className="flex flex-col">
                  <label className="text-lg font-semibold text-slate-200 mb-2">
                      이미지 URL (image_urls)
                  </label>
                  <p className="text-sm text-slate-400 mb-4 bg-slate-800 p-3 rounded-md border border-slate-700">
                    <i className="ri-information-line mr-2"></i>
                    Kie.ai 서버에 이미지가 업로드되며, 생성된 URL이 비디오 생성에 사용됩니다.
                    업로드된 파일은 3일 후 자동으로 삭제됩니다.
                  </p>
                  <div className="flex flex-wrap gap-4 mb-4">
                      {inputImage ? (
                          <div key={inputImage.id} className="relative w-48 h-48 rounded-lg overflow-hidden border border-slate-600">
                              <img src={inputImage.preview} alt="Input preview" className="w-full h-full object-cover" />
                              <button
                                  onClick={handleRemoveImage}
                                  className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 text-sm
                                             hover:bg-red-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                                  aria-label={`Remove image ${inputImage.file.name}`}
                                  disabled={loading}
                              >
                                  <i className="ri-close-line"></i>
                              </button>
                              <span className="absolute bottom-1 left-2 text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
                                  파일 1
                              </span>
                          </div>
                      ) : (
                          <label
                              htmlFor="grok-image-upload"
                              className="flex flex-col items-center justify-center w-48 h-48 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 cursor-pointer
                                         hover:border-primary hover:text-primary transition-colors duration-200"
                              aria-label="Upload image"
                          >
                              <i className="ri-image-add-line text-4xl mb-2"></i>
                              <span className="text-sm">파일 추가 (1/1)</span>
                              <input
                                  id="grok-image-upload"
                                  type="file"
                                  accept="image/jpeg, image/png, image/webp"
                                  onChange={handleFileChange}
                                  className="hidden"
                                  disabled={loading || taskId.trim() !== ''} // Disable if task_id is used
                              />
                          </label>
                      )}
                  </div>
                  {inputImage && (
                      <div className="flex justify-end mt-2">
                          <button
                              onClick={handleRemoveImage}
                              className="bg-red-700 hover:bg-red-800 text-white font-semibold py-2 px-4 rounded-lg text-sm
                                         transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                              disabled={loading}
                          >
                              제거
                          </button>
                      </div>
                  )}
                  <p className="text-sm text-slate-400 mt-2">비디오 생성에 참조할 외부 이미지 URL을 하나 제공하세요 (하나의 이미지 파일만 지원). 이는 두 가지 이미지 입력 옵션 중 하나입니다. 외부 이미지를 업로드하거나 아래에서 Grok으로 생성된 이미지의 task_id + index를 지정할 수 있습니다. image_urls와 task_id를 동시에 제공하지 마세요.</p>
              </div>
            )}

            {/* Input - task_id (for I2V only) */}
            {currentGrokImagineMode === 'i2v' && (
              <div className="flex flex-col">
                <label htmlFor="grok-task-id" className="text-lg font-semibold text-slate-200 mb-2">
                  태스크 ID (task_id)
                </label>
                <input
                  id="grok-task-id"
                  type="text"
                  value={taskId}
                  onChange={handleTaskIdChange}
                  placeholder="태스크 ID를 입력하세요"
                  maxLength={100}
                  className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 text-slate-50"
                  disabled={loading || inputImage !== null} // Disable if image_urls is used
                />
                <p className="text-sm text-slate-400 mt-2">이전 Grok 모델로 생성된 이미지의 태스크 ID를 입력하세요. 아래의 인덱스와 함께 사용하여 해당 생성에서 특정 이미지를 선택합니다. 이 방법을 사용할 때는 image_urls를 제공하지 마세요. 외부 이미지와 달리 이 방법은 Spicy 모드를 지원합니다.</p>
              </div>
            )}

            {/* Input - index (for I2V only) */}
            {currentGrokImagineMode === 'i2v' && (
              <div className="flex flex-col">
                <label htmlFor="grok-index" className="text-lg font-semibold text-slate-200 mb-2">
                  인덱스 (index)
                </label>
                <input
                  id="grok-index"
                  type="number"
                  value={index}
                  onChange={handleIndexChange}
                  min={0}
                  max={5}
                  className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 text-slate-50"
                  disabled={loading || inputImage !== null} // Disable if image_urls is used
                />
                <p className="text-sm text-slate-400 mt-2">task_id를 사용할 때, 사용할 이미지를 지정하세요 (Grok은 태스크당 6개의 이미지를 생성합니다). 이 매개변수는 task_id와 함께 작동하며, image_urls가 사용되는 경우에는 무시됩니다 (0부터 시작).</p>
              </div>
            )}

            {/* Input - Mode */}
            <div className="flex flex-col">
              <label className="text-lg font-semibold text-slate-200 mb-2">
                모드 (mode)
              </label>
              <p className="text-sm text-slate-400 mb-2">생성 모드를 선택하세요.</p>
              <div className="flex flex-wrap gap-3">
                {['fun', 'normal', 'spicy'].map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m as 'fun' | 'normal' | 'spicy')}
                    className={`px-5 py-2 rounded-lg font-medium transition-colors duration-200
                                ${mode === m
                                  ? 'bg-primary text-white shadow-md'
                                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                                }
                                focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:opacity-50`}
                    disabled={loading}
                    aria-pressed={mode === m}
                  >
                    {m === 'fun' ? '재미있는' : m === 'normal' ? '일반' : '자극적인'}
                  </button>
                ))}
              </div>
              {currentGrokImagineMode === 'i2v' && (
                <p className="text-sm text-yellow-400 mt-2 bg-slate-800 p-2 rounded-md border border-yellow-700">
                  <i className="ri-alert-line mr-2"></i>
                  **참고:** 외부 이미지 입력 시 'Spicy' 모드는 지원되지 않으며 자동으로 'Normal'로 전환됩니다.
                </p>
              )}
              {currentGrokImagineMode === 't2v' && (
                <p className="text-sm text-yellow-400 mt-2 bg-slate-800 p-2 rounded-md border border-yellow-700">
                  <i className="ri-alert-line mr-2"></i>
                  **참고:** Grok Imagine의 T2V 모드는 'Spicy' 모드를 지원하지 않으며, 'Normal' 모드로 자동 전환됩니다.
                </p>
              )}
            </div>
          </>
        )}

        {/* Upscale Specific Inputs removed */}


        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-6">
          <button
            onClick={handleReset}
            className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
            disabled={loading}
          >
            초기화
          </button>
          <button
            onClick={handleRun}
            className="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-lg text-xl transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={isRunDisabled}
          >
            <i className="ri-flashlight-fill"></i>
            <span>{loading ? '생성 중...' : `${currentCreditCost} 실행`}</span>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-700 text-white rounded-md text-center border border-red-500 mt-6">
            <p className="font-semibold text-lg">오류 발생:</p>
            <p className="mt-1">{error}</p>
          </div>
        )}
      </div>

      {/* Output Section */}
      <div className="lg:w-1/2 flex flex-col space-y-4 p-6 bg-slate-800 rounded-lg border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold text-slate-200">출력</h3>
          <div className="flex gap-2">
            <button className="px-4 py-1 text-sm bg-slate-700 text-white rounded-md hover:bg-slate-600 transition-colors duration-200" disabled>미리보기</button>
            <button className="px-4 py-1 text-sm bg-slate-700 text-slate-400 rounded-md cursor-not-allowed" disabled>JSON</button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-64 bg-slate-700 rounded-lg">
            <LoadingSpinner message={GROK_IMAGINE_LOADING_MESSAGES[currentGrokImagineMode][currentLoadingMessageIndex]} className="text-primary" />
          </div>
        )}

        {videoUrl && !loading && ( // Check only videoUrl, as upscaledImageUrl is removed
          <>
            <p className="text-slate-300">출력 유형: 비디오</p>
            <video
              src={videoUrl || undefined} // Ensure videoUrl is defined for the video tag
              controls
              className="w-full rounded-lg shadow-lg border border-slate-600"
              style={{ maxHeight: '400px' }}
            >
              귀하의 브라우저는 비디오 태그를 지원하지 않습니다.
            </video>
            <div className="flex justify-center gap-4 mt-4">
              <a
                href={videoUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                download={`grok-imagine-video-${Date.now()}.mp4`}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                <i className="ri-download-line"></i>
                비디오 다운로드
              </a>
              <button
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                disabled
              >
                <i className="ri-history-line"></i>
                전체 기록 보기
              </button>
            </div>
          </>
        )}

        {!videoUrl && !loading && !error && ( // Check only videoUrl, as upscaledImageUrl is removed
          <div className="flex items-center justify-center h-64 bg-slate-700 rounded-lg text-slate-400 text-xl">
            비디오를 생성해주세요.
          </div>
        )}
      </div>
    </div>
  );
};

export default GrokImagineGenerator;