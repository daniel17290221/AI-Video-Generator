
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createVeo31Task, pollVeo31Operation, uploadFileToBase64, VEO31_FAST_MODEL_NAME, VEO31_QUALITY_MODEL_NAME } from '../services/kieaiService';
import LoadingSpinner from './LoadingSpinner';
import DemoModelPlaceholder from './DemoModelPlaceholder';
import { DetailedVideoPrompt } from '../types'; // Import DetailedVideoPrompt type

interface Veo31GeneratorProps {
  kieAIApiKey: string;
}

type Veo31GenerationType = 'TEXT_2_VIDEO' | 'FIRST_AND_LAST_FRAMES_2_VIDEO' | 'REFERENCE_2_VIDEO';
type Veo31Model = 'veo3_fast' | 'veo3'; // veo3_fast is "Fast", veo3 is "Quality"
type Veo31AspectRatio = '16:9' | '9:16' | 'Auto';

interface ImageFile {
  id: string;
  file: File;
  preview: string; // Data URL for local preview
}

const VEO31_LOADING_MESSAGES: string[] = [
  "Veo 3.1 모델에 비디오 생성을 요청 중...",
  "당신의 아이디어를 AI가 현실적인 모션으로 변환 중...",
  "확장된 클립 길이와 다중 이미지 참조를 처리하고 있습니다...",
  "이 작업은 몇 분 정도 소요될 수 있습니다. 잠시만 기다려 주세요!",
  "네이티브 1080p 해상도로 동기화된 오디오 출력을 생성 중...",
  "거의 다 됐습니다! 비디오 렌더링이 완료되고 있습니다...",
];

const VEO31_CREDITS = {
  fast: 60,
  quality: 250,
};

const Veo31Generator: React.FC<Veo31GeneratorProps> = ({ kieAIApiKey }) => {
  const [currentGenerationType, setCurrentGenerationType] = useState<Veo31GenerationType>('TEXT_2_VIDEO');
  const [selectedModel, setSelectedModel] = useState<Veo31Model>('veo3_fast'); // Default to Fast
  const [prompt, setPrompt] = useState<string>("A keyboard whose keys are made of different types of candy. Typing makes sweet, crunchy sounds. Audio: Crunchy, sugary typing sounds, delighted giggles.");
  const [inputImages, setInputImages] = useState<ImageFile[]>([]);
  const [aspectRatio, setAspectRatio] = useState<Veo31AspectRatio>('16:9'); // Default to 16:9
  const [seed, setSeed] = useState<string>(''); // Number string, 10000-99999
  const [watermark, setWatermark] = useState<string>('');
  const [enableTranslation, setEnableTranslation] = useState<boolean>(true);

  const [loading, setLoading] = useState<boolean>(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
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

  // Handle generation type changes and related state resets/adjustments
  useEffect(() => {
    // If Reference to Video is selected, force Fast model and 16:9 aspect ratio
    if (currentGenerationType === 'REFERENCE_2_VIDEO') {
      setSelectedModel('veo3_fast');
      setAspectRatio('16:9');
    }

    // Clear images if switching to Text to Video, or if image count is incompatible
    if (currentGenerationType === 'TEXT_2_VIDEO') {
      handleRemoveAllImages();
    } else if (currentGenerationType === 'FIRST_AND_LAST_FRAMES_2_VIDEO' && inputImages.length > 2) {
      handleRemoveAllImages();
    } else if (currentGenerationType === 'REFERENCE_2_VIDEO' && inputImages.length > 3) {
      handleRemoveAllImages();
    }
  }, [currentGenerationType]); // eslint-disable-line react-hooks/exhaustive-deps

  const startLoadingMessages = () => {
    setCurrentLoadingMessageIndex(0);
    messageIntervalRef.current = window.setInterval(() => {
      setCurrentLoadingMessageIndex(prevIndex => (prevIndex + 1) % VEO31_LOADING_MESSAGES.length);
    }, 5000);
  };

  const stopLoadingMessages = () => {
    if (messageIntervalRef.current) {
      clearInterval(messageIntervalRef.current);
      messageIntervalRef.current = null;
    }
  };

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const maxImages = currentGenerationType === 'FIRST_AND_LAST_FRAMES_2_VIDEO' ? 2 : 3;
    if (inputImages.length >= maxImages) {
      setError(`최대 ${maxImages}개의 이미지만 업로드할 수 있습니다.`);
      return;
    }
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
          setInputImages(prev => [...prev, { id: URL.createObjectURL(file), file, preview: previewUrl }]);
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
  }, [inputImages, currentGenerationType]);


  const handleRemoveImage = useCallback((id: string) => {
    setInputImages(prev => prev.filter(img => img.id !== id));
    URL.revokeObjectURL(id); // Clean up the object URL
    setError(null);
  }, []);

  const handleRemoveAllImages = useCallback(() => {
    inputImages.forEach(img => URL.revokeObjectURL(img.id));
    setInputImages([]);
    setError(null);
  }, [inputImages]);

  const handleReset = useCallback(() => {
    setPrompt("A keyboard whose keys are made of different types of candy. Typing makes sweet, crunchy sounds. Audio: Crunchy, sugary typing sounds, delighted giggles.");
    handleRemoveAllImages();
    setCurrentGenerationType('TEXT_2_VIDEO');
    setSelectedModel('veo3_fast');
    setAspectRatio('16:9');
    setSeed('');
    setWatermark('');
    setEnableTranslation(true);
    setVideoUrl(null);
    setError(null);
    setLoading(false);
    stopLoadingMessages();
    setPromptInputMode('text'); // Reset prompt input mode
    setJsonPromptInput(''); // Clear JSON input
  }, [handleRemoveAllImages]);

  const calculateCreditCost = () => {
    if (currentGenerationType === 'REFERENCE_2_VIDEO') {
      return VEO31_CREDITS.fast; // Reference to Video always uses Fast mode
    }
    return selectedModel === 'veo3_fast' ? VEO31_CREDITS.fast : VEO31_CREDITS.quality;
  };

  const handleRun = async () => {
    setError(null);
    setVideoUrl(null);

    if (!kieAIApiKey) {
      setError('Kie.ai API 키가 필요합니다.');
      return;
    }

    let finalPromptText: string = '';

    if (promptInputMode === 'text') {
      if (!prompt.trim()) {
        setError('프롬프트를 입력해주세요.');
        return;
      }
      finalPromptText = prompt;
    } else { // JSON mode
      if (!jsonPromptInput.trim()) {
        setError('JSON 프롬프트를 입력해주세요.');
        return;
      }
      try {
        const parsedJson: DetailedVideoPrompt = JSON.parse(jsonPromptInput);
        if (!parsedJson.full_text_prompt) {
          setError('JSON 입력에 "full_text_prompt" 필드가 누락되었습니다.');
          return;
        }
        finalPromptText = parsedJson.full_text_prompt;
      } catch (e: any) {
        setError(`유효하지 않은 JSON 형식입니다: ${e.message}`);
        return;
      }
    }

    let imageUrlsForApi: string[] | undefined = undefined;
    if (currentGenerationType !== 'TEXT_2_VIDEO') {
      if (inputImages.length === 0) {
        setError('이미지 참조가 필요한 생성 타입입니다. 이미지를 업로드해주세요.');
        return;
      }
      // Upload images to Kie.ai and get their public URLs
      const uploadedUrls: string[] = [];
      for (const imageFile of inputImages) {
        const uploadedUrl = await uploadFileToBase64(kieAIApiKey, imageFile.file, 'veo31-input-images', imageFile.file.name);
        uploadedUrls.push(uploadedUrl);
      }
      imageUrlsForApi = uploadedUrls;
    }

    // Specific validation for Reference to Video
    if (currentGenerationType === 'REFERENCE_2_VIDEO') {
        if (selectedModel !== 'veo3_fast' || aspectRatio !== '16:9') {
            setError('Reference to Video 모드는 Fast 모델과 16:9 화면 비율만 지원합니다. 설정을 확인해주세요.');
            return;
        }
        if (inputImages.length < 1 || inputImages.length > 3) {
            setError('Reference to Video 모드는 1개에서 3개까지의 이미지를 필요로 합니다.');
            return;
        }
    } else if (currentGenerationType === 'FIRST_AND_LAST_FRAMES_2_VIDEO') {
        if (inputImages.length < 1 || inputImages.length > 2) {
            setError('Image to Video (First & Last Frames) 모드는 1개 또는 2개의 이미지를 필요로 합니다.');
            return;
        }
    }

    setLoading(true);
    startLoadingMessages();

    try {
      const taskId = await createVeo31Task(kieAIApiKey, {
        prompt: finalPromptText, // Use the processed prompt text
        imageUrls: imageUrlsForApi,
        model: selectedModel,
        generationType: currentGenerationType,
        aspectRatio: aspectRatio,
        seeds: seed ? parseInt(seed, 10) : undefined,
        enableTranslation: enableTranslation,
        watermark: watermark.trim() !== '' ? watermark : undefined,
        enableFallback: false, // Deprecated, always send false or omit.
      });

      const finalVideoUrl = await pollVeo31Operation(kieAIApiKey, taskId);
      setVideoUrl(finalVideoUrl);
    } catch (e: any) {
      setError(e.message || '비디오 생성에 실패했습니다.');
    } finally {
      setLoading(false);
      stopLoadingMessages();
    }
  };

  const currentCost = calculateCreditCost();
  const isRunDisabled = loading || !kieAIApiKey ||
    (promptInputMode === 'text' && !prompt.trim()) ||
    (promptInputMode === 'json' && !jsonPromptInput.trim()) ||
    (currentGenerationType !== 'TEXT_2_VIDEO' && inputImages.length === 0) ||
    (currentGenerationType === 'FIRST_AND_LAST_FRAMES_2_VIDEO' && (inputImages.length < 1 || inputImages.length > 2)) ||
    (currentGenerationType === 'REFERENCE_2_VIDEO' && (inputImages.length < 1 || inputImages.length > 3));

  return (
    <div className="flex flex-col lg:flex-row space-y-8 lg:space-y-0 lg:space-x-8 p-6 bg-slate-900 rounded-lg shadow-xl border border-slate-700">
      {/* Input Section */}
      <div className="lg:w-1/2 flex flex-col space-y-6">
        {/* Model Description and Pricing */}
        <div className="mb-4">
          <p className="text-md text-slate-300 mb-2">
            Google DeepMind의 업그레이드된 AI 비디오 모델로 현실적인 모션 생성, 확장된 클립 길이, 다중 이미지
            참조 제어, 네이티브 1080p 동기화된 오디오 출력을 제공합니다.
          </p>
          <div className="text-sm text-slate-400 bg-slate-800 p-3 rounded-lg border border-slate-700">
            <i className="ri-money-dollar-circle-line mr-2"></i>
            가격: 빠른 모드 (텍스트-투-비디오 / 이미지-투-비디오 / 참조-투-비디오)는 60 크레딧(약 $0.30), 고품질 모드 (텍스트-투-비디오 / 이미지-투-비디오)는 250 크레딧(약 $1.25)이 소모됩니다.
          </div>
          <div className="flex justify-end mt-4">
              <span className="bg-orange-500 text-white text-sm font-bold px-3 py-1 rounded-full">크레딧: 4,979.6</span>
          </div>
        </div>

        {/* Generation Type Tabs */}
        <div className="flex flex-wrap justify-start gap-3 mb-4">
          <label className="text-lg font-semibold text-slate-200 w-full mb-2">생성 유형 (Generation Type)</label>
          {['TEXT_2_VIDEO', 'FIRST_AND_LAST_FRAMES_2_VIDEO', 'REFERENCE_2_VIDEO'].map(type => (
            <button
              key={type}
              onClick={() => setCurrentGenerationType(type as Veo31GenerationType)}
              className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                          ${currentGenerationType === type
                            ? 'bg-primary text-white shadow-lg'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                          }
                          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
              disabled={loading}
            >
              {type === 'TEXT_2_VIDEO' ? '텍스트 투 비디오' : type === 'FIRST_AND_LAST_FRAMES_2_VIDEO' ? '이미지 투 비디오' : '참조 투 비디오'}
            </button>
          ))}
        </div>

        {/* Model Selection Tabs */}
        <div className="flex flex-wrap justify-start gap-3 mb-4">
          <label className="text-lg font-semibold text-slate-200 w-full mb-2">모델 (Model)</label>
          <button
            onClick={() => setSelectedModel('veo3_fast')}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                        ${selectedModel === 'veo3_fast'
                          ? 'bg-primary text-white shadow-lg'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                        }
                        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
            disabled={loading}
          >
            Veo 3.1 빠른 모드
          </button>
          <button
            onClick={() => setSelectedModel('veo3')}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                        ${selectedModel === 'veo3'
                          ? 'bg-primary text-white shadow-lg'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                        }
                        ${currentGenerationType === 'REFERENCE_2_VIDEO' ? 'opacity-50 cursor-not-allowed' : ''}
                        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
            disabled={loading || currentGenerationType === 'REFERENCE_2_VIDEO'}
          >
            Veo 3.1 고품질 모드
          </button>
        </div>

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

        {/* Generation Prompt */}
        <div className="flex flex-col">
          <label htmlFor="veo31-prompt-input" className="text-lg font-semibold text-slate-200 mb-2">
            생성 프롬프트 <span className="text-red-500">*</span>
          </label>
          {promptInputMode === 'text' ? (
            <textarea
              id="veo31-prompt-input"
              className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 resize-none text-slate-50"
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="비디오 내용을 상세하게 설명해주세요."
              maxLength={10000} // Assuming a generous max length
              minLength={1}
              disabled={loading}
              aria-label="Veo 3.1 비디오 텍스트 프롬프트 입력"
            ></textarea>
          ) : (
            <textarea
              id="veo31-prompt-input"
              className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 resize-none text-slate-50 font-mono"
              rows={10}
              value={jsonPromptInput}
              onChange={(e) => setJsonPromptInput(e.target.value)}
              placeholder="여기에 상세 프롬프트 JSON을 붙여넣으세요. 'full_text_prompt' 필드가 사용됩니다."
              disabled={loading}
              aria-label="Veo 3.1 비디오 JSON 프롬프트 입력"
            ></textarea>
          )}
          <p className="text-sm text-slate-400 mt-2">
            {promptInputMode === 'text' ? `입력된 글자 수: ${prompt.length}` : `JSON 프롬프트입니다. 'full_text_prompt' 필드가 사용됩니다.`}
          </p>
        </div>

        {/* Image Input Section (Conditional) */}
        {currentGenerationType !== 'TEXT_2_VIDEO' && (
          <div className="flex flex-col">
            <label className="text-lg font-semibold text-slate-200 mb-2">
              이미지 참조 (선택 사항)
            </label>
            <p className="text-sm text-slate-400 mb-4 bg-slate-800 p-3 rounded-md border border-slate-700">
                <i className="ri-information-line mr-2"></i>
                Kie.ai 서버에 이미지가 업로드되며, 생성된 URL이 비디오 생성에 사용됩니다.
                업로드된 파일은 3일 후 자동으로 삭제됩니다.
            </p>
            <div className="flex flex-wrap gap-4 mb-4">
              {inputImages.map((img) => (
                <div key={img.id} className="relative w-48 h-48 rounded-lg overflow-hidden border border-slate-600">
                  <img src={img.preview} alt="Input preview" className="w-full h-full object-cover" />
                  <button
                    onClick={() => handleRemoveImage(img.id)}
                    className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 text-sm
                               hover:bg-red-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label={`Remove image ${img.file.name}`}
                    disabled={loading}
                  >
                    <i className="ri-close-line"></i>
                  </button>
                  <span className="absolute bottom-1 left-2 text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
                    파일 {inputImages.indexOf(img) + 1}
                  </span>
                </div>
              ))}
              {inputImages.length < (currentGenerationType === 'FIRST_AND_LAST_FRAMES_2_VIDEO' ? 2 : 3) && (
                <label
                  htmlFor="veo31-image-upload"
                  className="flex flex-col items-center justify-center w-48 h-48 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 cursor-pointer
                             hover:border-primary hover:text-primary transition-colors duration-200"
                  aria-label="Add more files"
                >
                  <i className="ri-image-add-line text-4xl mb-2"></i>
                  <span className="text-sm">파일 추가 ({inputImages.length}/{currentGenerationType === 'FIRST_AND_LAST_FRAMES_2_VIDEO' ? '2' : '3'})</span>
                  <input
                    id="veo31-image-upload"
                    type="file"
                    accept="image/jpeg, image/png, image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={loading}
                  />
                </label>
              )}
            </div>
            {inputImages.length > 0 && (
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleRemoveAllImages}
                  className="bg-red-700 hover:bg-red-800 text-white font-semibold py-2 px-4 rounded-lg text-sm
                             transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                  disabled={loading}
                >
                  모두 제거
                </button>
              </div>
            )}
            <p className="text-sm text-slate-400 mt-2">
                {currentGenerationType === 'FIRST_AND_LAST_FRAMES_2_VIDEO' ? '1개 이미지: 해당 이미지 주변에서 비디오가 전개됩니다. 2개 이미지: 첫 번째 이미지가 비디오의 시작 프레임, 두 번째 이미지가 마지막 프레임이 되어 전환 비디오를 생성합니다.' : '1-3개의 참조 이미지를 기반으로 비디오를 생성합니다.'}
            </p>
          </div>
        )}

        {/* Aspect Ratio */}
        <div className="flex flex-col">
          <label className="text-lg font-semibold text-slate-200 mb-2">
            화면 비율 (Ratio)
            <span className="ml-2 text-slate-400 text-sm">(이 매개변수는 이미지의 종횡비를 정의합니다.)</span>
          </label>
          <div className="flex flex-wrap gap-3">
            {['Auto', '16:9', '9:16'].map(ratio => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio as Veo31AspectRatio)}
                className={`px-5 py-2 rounded-lg font-medium transition-colors duration-200
                            ${aspectRatio === ratio
                              ? 'bg-primary text-white shadow-md'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                            }
                            ${currentGenerationType === 'REFERENCE_2_VIDEO' && ratio !== '16:9' ? 'opacity-50 cursor-not-allowed' : ''}
                            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:opacity-50`}
                disabled={loading || (currentGenerationType === 'REFERENCE_2_VIDEO' && ratio !== '16:9')}
                aria-pressed={aspectRatio === ratio}
              >
                {ratio === 'Auto' ? <i className="ri-pencil-ruler-2-line mr-1"></i> : null}
                {ratio === '16:9' ? <i className="ri-hd-line mr-1"></i> : null}
                {ratio === '9:16' ? <i className="ri-smartphone-line mr-1"></i> : null}
                {ratio === 'Auto' ? '자동' : ratio}
              </button>
            ))}
          </div>
          {currentGenerationType === 'REFERENCE_2_VIDEO' && aspectRatio !== '16:9' && (
            <p className="text-sm text-red-400 mt-2 bg-slate-800 p-2 rounded-md border border-red-700">
              <i className="ri-error-warning-line mr-2"></i>
              참조 투 비디오 모드는 16:9 화면 비율만 지원합니다.
            </p>
          )}
        </div>

        {/* Seed (Optional) */}
        <div className="flex flex-col">
          <label htmlFor="veo31-seed" className="text-lg font-semibold text-slate-200 mb-2">
            시드 (Seed) (선택 사항)
            <span className="ml-2 text-slate-400 text-sm">(10000-99999)</span>
          </label>
          <input
            id="veo31-seed"
            type="number"
            value={seed}
            onChange={(e) => {
                const val = e.target.value;
                if (val === '' || (parseInt(val) >= 10000 && parseInt(val) <= 99999)) {
                    setSeed(val);
                }
            }}
            placeholder="시드 값을 입력하세요"
            min={10000}
            max={99999}
            className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 text-slate-50"
            disabled={loading}
          />
        </div>

        {/* Watermark (Optional) */}
        <div className="flex flex-col">
          <label htmlFor="veo31-watermark" className="text-lg font-semibold text-slate-200 mb-2">
            워터마크 (Watermark) (선택 사항)
          </label>
          <input
            id="veo31-watermark"
            type="text"
            value={watermark}
            onChange={(e) => setWatermark(e.target.value)}
            placeholder="내 브랜드"
            maxLength={100}
            className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 text-slate-50"
            disabled={loading}
          />
        </div>

        {/* Enable Translation Toggle */}
        <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg border border-slate-700">
          <label htmlFor="veo31-translation-toggle" className="text-lg font-semibold text-slate-200 cursor-pointer">
            번역 활성화 (Enable Translation)
            <p className="text-sm text-slate-400 mt-1">프롬프트를 비디오 생성 전에 자동으로 영어로 번역하여 더 나은 결과를 얻습니다.</p>
          </label>
          <input
            type="checkbox"
            id="veo31-translation-toggle"
            checked={enableTranslation}
            onChange={(e) => setEnableTranslation(e.target.checked)}
            className="relative h-6 w-11 cursor-pointer appearance-none rounded-full bg-slate-600 transition-colors duration-200 ease-in-out
                       checked:bg-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
            role="switch"
            aria-checked={enableTranslation}
            disabled={loading}
          />
        </div>


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
            <span>{loading ? '생성 중...' : `${currentCost} 생성`}</span>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-700 text-white rounded-md text-center border border-red-500 mt-6">
            <p className="font-semibold text-lg">오류 발생:</p>
            <p className="mt-1">{error}</p>
          </div>
        )}
        <p className="text-sm text-slate-400 mt-2">
            Google에 따르면 오디오는 실험적인 기능이며 일부 비디오에서는 사용하지 못할 수도 있습니다.
        </p>
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
            <LoadingSpinner message={VEO31_LOADING_MESSAGES[currentLoadingMessageIndex]} className="text-primary" />
          </div>
        )}

        {videoUrl && !loading && (
          <>
            <p className="text-slate-300">출력 유형: 비디오</p>
            <video
              src={videoUrl}
              controls
              className="w-full rounded-lg shadow-lg border border-slate-600"
              style={{ maxHeight: '400px' }}
            >
              귀하의 브라우저는 비디오 태그를 지원하지 않습니다.
            </video>
            <div className="flex justify-center gap-4 mt-4">
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={`veo31-video-${Date.now()}.mp4`}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                <i className="ri-download-line"></i>
                다운로드
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

        {!videoUrl && !loading && !error && (
          <div className="flex items-center justify-center h-64 bg-slate-700 rounded-lg text-slate-400 text-xl">
            비디오를 생성해주세요.
          </div>
        )}
      </div>
    </div>
  );
};

export default Veo31Generator;