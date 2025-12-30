
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createHailuo23I2VProTask, pollHailuo23I2VProOperation, uploadFileToBase64, createHailuo23I2VStandardTask, pollHailuo23I2VStandardOperation } from '../services/kieaiService';
import LoadingSpinner from './LoadingSpinner';
import { DetailedVideoPrompt } from '../types'; // Import DetailedVideoPrompt type

interface Hailuo23GeneratorProps {
  kieAIApiKey: string;
}

// Sub-modes for Hailuo 2.3
type Hailuo23Mode = 'pro' | 'standard';

interface ImageFile {
  id: string;
  file: File;
  preview: string; // Data URL for local preview
}

const HAILUO23_LOADING_MESSAGES: string[] = [
  "Hailuo 2.3 모델에 비디오 생성을 요청 중...",
  "이미지와 프롬프트를 바탕으로 현실적인 모션을 생성 중...",
  "복잡한 움직임, 조명 변화, 미세한 표정을 처리하고 있습니다...",
  "이 작업은 몇 분 정도 소요될 수 있습니다. 잠시만 기다려 주세요!",
  "시네마틱한 비주얼과 높은 디테일의 패브릭 텍스처를 구현 중...",
  "거의 다 됐습니다! 비디오 렌더링이 완료되고 있습니다...",
];

const Hailuo23Generator: React.FC<Hailuo23GeneratorProps> = ({ kieAIApiKey }) => {
  const [currentHailuoMode, setCurrentHailuoMode] = useState<Hailuo23Mode>('pro');
  const [prompt, setPrompt] = useState<string>("A graceful geisha performs a traditional Japanese dance indoors. She wears a luxurious red kimono with golden floral embroidery, white obi belt, and white tabi socks. Soft and elegant hand movements, expressive pose, sleeves flowing naturally. Scene set in a Japanese tatami room with warm ambient lighting, shoji paper sliding doors, and cherry blossom branches hanging in the foreground. Cinematic, soft depth of field, high detail fabric texture, hyper-realistic, smooth motion.");
  const [inputImage, setInputImage] = useState<ImageFile | null>(null); // Only 1 image allowed
  const [duration, setDuration] = useState<string>('6'); // Default to '6' seconds
  const [resolution, setResolution] = useState<string>('768P'); // Default to '768P'

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

  // Reset inputs when switching modes
  useEffect(() => {
    setPrompt("A graceful geisha performs a traditional Japanese dance indoors. She wears a luxurious red kimono with golden floral embroidery, white obi belt, and white tabi socks. Soft and elegant hand movements, expressive pose, sleeves flowing naturally. Scene set in a Japanese tatami room with warm ambient lighting, shoji paper sliding doors, and cherry blossom branches hanging in the foreground. Cinematic, soft depth of field, high detail fabric texture, hyper-realistic, smooth motion.");
    handleRemoveImage(); // Cleans up object URL and nulls inputImage
    setDuration('6'); // Default duration for both modes
    setResolution('768P'); // Default resolution for both modes
    setVideoUrl(null);
    setError(null);
    setLoading(false);
    stopLoadingMessages();
    setPromptInputMode('text');
    setJsonPromptInput('');
  }, [currentHailuoMode]); // eslint-disable-line react-hooks/exhaustive-deps


  const startLoadingMessages = () => {
    setCurrentLoadingMessageIndex(0);
    messageIntervalRef.current = window.setInterval(() => {
      setCurrentLoadingMessageIndex(prevIndex => (prevIndex + 1) % HAILUO23_LOADING_MESSAGES.length);
    }, 5000);
  };

  const stopLoadingMessages = () => {
    if (messageIntervalRef.current) {
      clearInterval(messageIntervalRef.current);
      messageIntervalRef.current = null;
    }
  };

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

  const handleDurationChange = useCallback((newDuration: string) => {
    setDuration(newDuration);
    // If new duration is '10' and resolution is '1080P', force resolution to '768P'
    if (newDuration === '10' && resolution === '1080P') {
      setResolution('768P');
    }
  }, [resolution]);

  const handleResolutionChange = useCallback((newResolution: string) => {
    setResolution(newResolution);
    // If new resolution is '1080P' and duration is '10', force duration to '6'
    if (newResolution === '1080P' && duration === '10') {
      setDuration('6');
    }
  }, [duration]);

  const handleReset = useCallback(() => {
    setPrompt("A graceful geisha performs a traditional Japanese dance indoors. She wears a luxurious red kimono with golden floral embroidery, white obi belt, and white tabi socks. Soft and elegant hand movements, expressive pose, sleeves flowing naturally. Scene set in a Japanese tatami room with warm ambient lighting, shoji paper sliding doors, and cherry blossom branches hanging in the foreground. Cinematic, soft depth of field, high detail fabric texture, hyper-realistic, smooth motion.");
    handleRemoveImage();
    setDuration('6');
    setResolution('768P');
    setVideoUrl(null);
    setError(null);
    setLoading(false);
    stopLoadingMessages();
    setPromptInputMode('text'); // Reset prompt input mode
    setJsonPromptInput(''); // Clear JSON input
  }, [handleRemoveImage]);

  const calculateCreditCost = useCallback(() => {
    if (currentHailuoMode === 'pro') {
      if (duration === '6' && resolution === '1080P') return 80;
      if (duration === '10' && resolution === '768P') return 90;
      // Default/fallback for Pro mode if specific match not found or invalid combination
      return 80; // Assuming 6s 1080P as a common reference for Pro
    } else { // 'standard' mode
      if (duration === '6' && resolution === '768P') return 30;
      if (duration === '10' && resolution === '768P') return 50;
      if (duration === '6' && resolution === '1080P') return 50;
      // Default/fallback for Standard mode
      return 30; // Assuming 6s 768P as a common reference for Standard
    }
  }, [currentHailuoMode, duration, resolution]);

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
      if (prompt.length < 1 || prompt.length > 5000) {
        setError('프롬프트는 1자에서 5000자 사이여야 합니다.');
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
        if (parsedJson.full_text_prompt.length < 1 || parsedJson.full_text_prompt.length > 5000) {
          setError('JSON 내 "full_text_prompt"는 1자에서 5000자 사이여야 합니다.');
          return;
        }
        finalPromptText = parsedJson.full_text_prompt;
      } catch (e: any) {
        setError(`유효하지 않은 JSON 형식입니다: ${e.message}`);
        return;
      }
    }

    if (!inputImage) {
      setError('애니메이션을 위한 이미지를 업로드해주세요.');
      return;
    }

    // Specific validation for 10s and 1080P
    if (duration === '10' && resolution === '1080P') {
      setError('10초 비디오는 1080P 해상도를 지원하지 않습니다. 해상도 또는 길이를 조정해주세요.');
      return;
    }

    setLoading(true);
    startLoadingMessages();

    try {
      const imageUrl = await uploadFileToBase64(kieAIApiKey, inputImage.file, 'hailuo-input-image', inputImage.file.name);
      let taskId: string;
      
      if (currentHailuoMode === 'pro') {
        taskId = await createHailuo23I2VProTask(kieAIApiKey, {
          input: {
            prompt: finalPromptText, // Use the processed prompt text
            image_url: imageUrl,
            duration: duration,
            resolution: resolution,
          },
        });
        const finalVideoUrl = await pollHailuo23I2VProOperation(kieAIApiKey, taskId);
        setVideoUrl(finalVideoUrl);
      } else { // 'standard' mode
        taskId = await createHailuo23I2VStandardTask(kieAIApiKey, {
          input: {
            prompt: finalPromptText,
            image_url: imageUrl,
            duration: duration,
            resolution: resolution,
          },
        });
        const finalVideoUrl = await pollHailuo23I2VStandardOperation(kieAIApiKey, taskId);
        setVideoUrl(finalVideoUrl);
      }
    } catch (e: any) {
      setError(e.message || '비디오 생성에 실패했습니다.');
    } finally {
      setLoading(false);
      stopLoadingMessages();
    }
  };

  const currentCreditCost = calculateCreditCost();

  const isRunDisabled = loading || !kieAIApiKey || !inputImage || (duration === '10' && resolution === '1080P') ||
    (promptInputMode === 'text' && (!prompt.trim() || prompt.length < 1 || prompt.length > 5000)) ||
    (promptInputMode === 'json' && !jsonPromptInput.trim());

  return (
    <div className="flex flex-col lg:flex-row space-y-8 lg:space-y-0 lg:space-x-8 p-6 bg-slate-900 rounded-lg shadow-xl border border-slate-700">
      {/* Input Section */}
      <div className="lg:w-1/2 flex flex-col space-y-6">
        {/* Model Description and Pricing */}
        <div className="mb-4">
          <p className="text-md text-slate-300 mb-2">
            Hailuo 2.3은 MiniMax의 고품질 AI 비디오 생성 모델로, 사실적인 모션, 표현력이 풍부한 캐릭터,
            그리고 시네마틱 비주얼을 만듭니다. 텍스트-투-비디오 및 이미지-투-비디오를 모두 지원하며,
            복잡한 움직임, 조명 변화, 세밀한 표정을 안정적이고 일관되게 처리합니다.
          </p>
          <div className="flex flex-wrap justify-start gap-3 mb-4">
            <button
              onClick={() => setCurrentHailuoMode('pro')}
              className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                          ${currentHailuoMode === 'pro'
                            ? 'bg-primary text-white shadow-lg'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                          }
                          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
              disabled={loading}
            >
              프로 {currentHailuoMode === 'pro' && <i className="ri-check-line ml-1"></i>}
            </button>
            <button
              onClick={() => setCurrentHailuoMode('standard')}
              className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                          ${currentHailuoMode === 'standard'
                            ? 'bg-primary text-white shadow-lg'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                          }
                          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
              disabled={loading}
            >
              스탠다드 {currentHailuoMode === 'standard' && <i className="ri-check-line ml-1"></i>}
            </button>
          </div>
          <p className="text-sm text-slate-400 bg-slate-800 p-3 rounded-lg border border-slate-700">
            <i className="ri-money-dollar-circle-line mr-2"></i>
            가격: Hailuo 2.3 이미지-투-비디오 — 스탠다드 6초 768P는 30 크레딧(약 $0.15), 스탠다드 10초 768P는 50 크레딧(약 $0.26), 스탠다드 6초 1080P는 50 크레딧(약 $0.26), 프로 10초 768P는 90 크레딧(약 $0.45), 프로 6초 1080P는 80 크레딧(약 $0.39)이 소모됩니다. 이 모든 가격은 공식 요금보다 20% 저렴합니다.
          </p>
        </div>

        {/* --- Inputs common to both 'pro' and 'standard' modes --- */}
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
          <label htmlFor="hailuo-프롬프트-input" className="text-lg font-semibold text-slate-200 mb-2">
            프롬프트 <span className="text-red-500">*</span>
          </label>
          {promptInputMode === 'text' ? (
            <textarea
              id="hailuo-프롬프트-input"
              className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 resize-none text-slate-50"
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="비디오 애니메이션을 상세하게 설명해주세요 (1-5000자)"
              maxLength={5000}
              minLength={1}
              disabled={loading}
              aria-label="Hailuo 2.3 비디오 텍스트 프롬프트 입력"
            ></textarea>
          ) : (
            <textarea
              id="hailuo-프롬프트-input"
              className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 resize-none text-slate-50 font-mono"
              rows={10}
              value={jsonPromptInput}
              onChange={(e) => setJsonPromptInput(e.target.value)}
              placeholder="여기에 상세 프롬프트 JSON을 붙여넣으세요. 'full_text_prompt' 필드가 사용됩니다."
              disabled={loading}
              aria-label="Hailuo 2.3 비디오 JSON 프롬프트 입력"
            ></textarea>
          )}
          <p className="text-sm text-slate-400 mt-2">
            {promptInputMode === 'text' ? `입력된 글자 수: ${prompt.length} / 5000` : `JSON 프롬프트입니다. 'full_text_prompt' 필드가 사용됩니다.`}
          </p>
        </div>

        {/* Input - Image URL */}
        <div className="flex flex-col">
            <label className="text-lg font-semibold text-slate-200 mb-2">
                이미지 URL (image_url) <span className="text-red-500">*</span>
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
                            업로드 성공
                        </span>
                    </div>
                ) : (
                    <label
                        htmlFor="hailuo-image-upload"
                        className="flex flex-col items-center justify-center w-48 h-48 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 cursor-pointer
                                   hover:border-primary hover:text-primary transition-colors duration-200"
                        aria-label="Upload image"
                    >
                        <i className="ri-image-add-line text-4xl mb-2"></i>
                        <span className="text-sm">파일 추가 (1/1)</span>
                        <input
                            id="hailuo-image-upload"
                            type="file"
                            accept="image/jpeg, image/png, image/webp"
                            onChange={handleFileChange}
                            className="hidden"
                            disabled={loading}
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
            <p className="text-sm text-slate-400 mt-2">애니메이션할 입력 이미지</p>
        </div>

        {/* Input - Duration */}
        <div className="flex flex-col">
          <label className="text-lg font-semibold text-slate-200 mb-2">
            길이 (duration)
          </label>
          <div className="flex flex-wrap gap-3">
            {['6', '10'].map(sec => (
              <button
                key={sec}
                onClick={() => handleDurationChange(sec)}
                className={`px-5 py-2 rounded-lg font-medium transition-colors duration-200
                            ${duration === sec
                              ? 'bg-primary text-white shadow-md'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                            }
                            ${sec === '10' && resolution === '1080P' ? 'opacity-50 cursor-not-allowed' : ''}
                            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:opacity-50`}
                disabled={loading || (sec === '10' && resolution === '1080P')}
                aria-pressed={duration === sec}
              >
                {sec}
              </button>
            ))}
          </div>
        </div>

        {/* Input - Resolution */}
        <div className="flex flex-col">
          <label className="text-lg font-semibold text-slate-200 mb-2">
            해상도 (resolution)
          </label>
          <div className="flex flex-wrap gap-3">
            {['768P', '1080P'].map(res => (
              <button
                key={res}
                onClick={() => handleResolutionChange(res)}
                className={`px-5 py-2 rounded-lg font-medium transition-colors duration-200
                            ${resolution === res
                              ? 'bg-primary text-white shadow-md'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                            }
                            ${res === '1080P' && duration === '10' ? 'opacity-50 cursor-not-allowed' : ''}
                            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:opacity-50`}
                disabled={loading || (res === '1080P' && duration === '10')}
                aria-pressed={resolution === res}
              >
                {res}
              </button>
            ))}
          </div>
          {duration === '10' && resolution === '1080P' && (
            <p className="text-sm text-red-400 mt-2 bg-slate-800 p-2 rounded-md border border-red-700">
              <i className="ri-error-warning-line mr-2"></i>
              10초 비디오는 1080P 해상도를 지원하지 않습니다.
            </p>
          )}
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
            <LoadingSpinner message={HAILUO23_LOADING_MESSAGES[currentLoadingMessageIndex]} className="text-primary" />
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
                download={`hailuo23-video-${Date.now()}.mp4`}
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

export default Hailuo23Generator;
