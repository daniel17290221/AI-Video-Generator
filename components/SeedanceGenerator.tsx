
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createSeedanceTask, pollSeedanceOperation, uploadFileToBase64 } from '../services/kieaiService';
import LoadingSpinner from './LoadingSpinner';
import { DetailedVideoPrompt } from '../types'; // Import DetailedVideoPrompt type

interface SeedanceGeneratorProps {
  kieAIApiKey: string;
}

interface ImageFile {
  id: string;
  file: File;
  preview: string; // Data URL for local preview
}

const SEEDANCE_LOADING_MESSAGES: string[] = [
  "Seedance 모델에 비디오 생성을 요청 중...",
  "당신의 창의력을 AI가 영상으로 구현 중...",
  "고품질 영상 생성을 위해 데이터를 처리하고 있습니다...",
  "이 작업은 몇 분 정도 소요될 수 있습니다. 잠시만 기다려 주세요!",
  "영상에 필요한 효과음과 렌즈 조정을 적용 중...",
  "거의 다 됐습니다! 비디오 렌더링이 완료되고 있습니다...",
];

const SeedanceGenerator: React.FC<SeedanceGeneratorProps> = ({ kieAIApiKey }) => {
  const [prompt, setPrompt] = useState<string>("In a Chinese-English communication scenario, a 70-year-old old man said kindly to the child: Good boy, study hard where you are in China ! The child happily replied in Chinese: Grandpa, I'll come to accompany you when I finish my studies in China . Then the old man stroked the child's head ");
  const [inputImages, setInputImages] = useState<ImageFile[]>([]);
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [resolution, setResolution] = useState<string>('720p');
  const [duration, setDuration] = useState<string>('8');
  const [fixedLens, setFixedLens] = useState<boolean>(true);
  const [generateAudio, setGenerateAudio] = useState<boolean>(true);

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

  const startLoadingMessages = () => {
    setCurrentLoadingMessageIndex(0);
    messageIntervalRef.current = window.setInterval(() => {
      setCurrentLoadingMessageIndex(prevIndex => (prevIndex + 1) % SEEDANCE_LOADING_MESSAGES.length);
    }, 5000);
  };

  const stopLoadingMessages = () => {
    if (messageIntervalRef.current) {
      clearInterval(messageIntervalRef.current);
      messageIntervalRef.current = null;
    }
  };

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (inputImages.length >= 2) {
      setError('최대 2개의 이미지만 업로드할 수 있습니다.');
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
  }, [inputImages]);


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
    setPrompt("In a Chinese-English communication scenario, a 70-year-old old man said kindly to the child: Good boy, study hard where you are in China ! The child happily replied in Chinese: Grandpa, I'll come to accompany you when I finish my studies in China . Then the old man stroked the child's head ");
    handleRemoveAllImages();
    setAspectRatio('1:1');
    setResolution('720p');
    setDuration('8');
    setFixedLens(true);
    setGenerateAudio(true);
    setVideoUrl(null);
    setError(null);
    setLoading(false);
    stopLoadingMessages();
    setPromptInputMode('text'); // Reset prompt input mode
    setJsonPromptInput(''); // Clear JSON input
  }, [handleRemoveAllImages]);

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
      if (prompt.length < 3 || prompt.length > 2500) {
        setError('프롬프트는 3자에서 2500자 사이여야 합니다.');
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
        if (parsedJson.full_text_prompt.length < 3 || parsedJson.full_text_prompt.length > 2500) {
          setError('JSON 내 "full_text_prompt"는 3자에서 2500자 사이여야 합니다.');
          return;
        }
        finalPromptText = parsedJson.full_text_prompt;
      } catch (e: any) {
        setError(`유효하지 않은 JSON 형식입니다: ${e.message}`);
        return;
      }
    }

    setLoading(true);
    startLoadingMessages();

    try {
      const uploadedImageUrls: string[] = [];
      if (inputImages.length > 0) {
        for (const imageFile of inputImages) {
          const uploadedUrl = await uploadFileToBase64(kieAIApiKey, imageFile.file, 'seedance-input-images', imageFile.file.name);
          uploadedImageUrls.push(uploadedUrl);
        }
      }

      const taskId = await createSeedanceTask(kieAIApiKey, {
        input: {
          prompt: finalPromptText, // Use the processed prompt text
          input_urls: uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined,
          aspect_ratio: aspectRatio,
          resolution: resolution,
          duration: duration,
          fixed_lens: fixedLens,
          generate_audio: generateAudio,
        },
      });

      const finalVideoUrl = await pollSeedanceOperation(kieAIApiKey, taskId);
      setVideoUrl(finalVideoUrl);
    } catch (e: any) {
      setError(e.message || '비디오 생성에 실패했습니다.');
    } finally {
      setLoading(false);
      stopLoadingMessages();
    }
  };


  const isRunDisabled = loading || !kieAIApiKey ||
    (promptInputMode === 'text' && (!prompt.trim() || prompt.length < 3 || prompt.length > 2500)) ||
    (promptInputMode === 'json' && !jsonPromptInput.trim());

  return (
    <div className="flex flex-col lg:flex-row space-y-8 lg:space-y-0 lg:space-x-8 p-6 bg-slate-900 rounded-lg shadow-xl border border-slate-700">
      {/* Input Section */}
      <div className="lg:w-1/2 flex flex-col space-y-6">
        <h2 className="text-3xl font-bold text-center text-primary mb-6">Seedance 1.5 Pro 비디오 생성</h2>

        {/* Pricing Info */}
        <p className="text-sm text-slate-400 mb-6 bg-slate-800 p-3 rounded-lg border border-slate-700">
          <i className="ri-money-dollar-circle-line mr-2"></i>
          가격: Seedance 1.5 Pro는 4초 비디오에 75 크레딧(약 $0.38), 8초 비디오에 150 크레딧(약 $0.75), 12초 비디오에 225 크레딧(약 $1.13)이 소모됩니다. 모든 가격은 공식 요금보다 25% 저렴합니다.
        </p>

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
          <label htmlFor="seedance-prompt-input" className="text-lg font-semibold text-slate-200 mb-2">
            프롬프트 <span className="text-red-500">*</span>
          </label>
          {promptInputMode === 'text' ? (
            <textarea
              id="seedance-prompt-input"
              className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 resize-none text-slate-50"
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="비디오 내용을 상세하게 설명해주세요 (3-2500자)"
              maxLength={2500}
              minLength={3}
              disabled={loading}
              aria-label="Seedance 비디오 텍스트 프롬프트 입력"
            ></textarea>
          ) : (
            <textarea
              id="seedance-prompt-input"
              className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 resize-none text-slate-50 font-mono"
              rows={10}
              value={jsonPromptInput}
              onChange={(e) => setJsonPromptInput(e.target.value)}
              placeholder="여기에 상세 프롬프트 JSON을 붙여넣으세요. 'full_text_prompt' 필드가 사용됩니다."
              disabled={loading}
              aria-label="Seedance 비디오 JSON 프롬프트 입력"
            ></textarea>
          )}
          <p className="text-sm text-slate-400 mt-2">
            {promptInputMode === 'text' ? `입력된 글자 수: ${prompt.length} / 2500` : `JSON 프롬프트입니다. 'full_text_prompt' 필드가 사용됩니다.`}
          </p>
        </div>

        {/* Input Images (input_urls) */}
        <div className="flex flex-col">
          <label className="text-lg font-semibold text-slate-200 mb-2">
            시작 이미지 (선택 사항, 0-2개):
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
                  File {inputImages.indexOf(img) + 1}
                </span>
              </div>
            ))}
            {inputImages.length < 2 && (
              <label
                htmlFor="seedance-image-upload"
                className="flex flex-col items-center justify-center w-48 h-48 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 cursor-pointer
                           hover:border-primary hover:text-primary transition-colors duration-200"
                aria-label="Add more files"
              >
                <i className="ri-image-add-line text-4xl mb-2"></i>
                <span className="text-sm">Add more files ({inputImages.length}/2)</span>
                <input
                  id="seedance-image-upload"
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
        </div>

        {/* Aspect Ratio */}
        <div className="flex flex-col">
          <label className="text-lg font-semibold text-slate-200 mb-2">
            화면 비율 <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-3">
            {['1:1', '21:9', '4:3', '3:4', '16:9', '9:16'].map(ratio => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                className={`px-5 py-2 rounded-lg font-medium transition-colors duration-200
                            ${aspectRatio === ratio
                              ? 'bg-primary text-white shadow-md'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                            }
                            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:opacity-50`}
                disabled={loading}
                aria-pressed={aspectRatio === ratio}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>

        {/* Resolution */}
        <div className="flex flex-col">
          <label className="text-lg font-semibold text-slate-200 mb-2">
            해상도
          </label>
          <div className="flex flex-wrap gap-3">
            {['480p', '720p'].map(res => (
              <button
                key={res}
                onClick={() => setResolution(res)}
                className={`px-5 py-2 rounded-lg font-medium transition-colors duration-200
                            ${resolution === res
                              ? 'bg-primary text-white shadow-md'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                            }
                            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:opacity-50`}
                disabled={loading}
                aria-pressed={resolution === res}
              >
                {res}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="flex flex-col">
          <label className="text-lg font-semibold text-slate-200 mb-2">
            길이 <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-3">
            {['4', '8', '12'].map(dur => (
              <button
                key={dur}
                onClick={() => setDuration(dur)}
                className={`px-5 py-2 rounded-lg font-medium transition-colors duration-200
                            ${duration === dur
                              ? 'bg-primary text-white shadow-md'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                            }
                            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:opacity-50`}
                disabled={loading}
                aria-pressed={duration === dur}
              >
                {dur}s
              </button>
            ))}
          </div>
        </div>

        {/* Fixed Lens Toggle */}
        <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg border border-slate-700">
          <label htmlFor="fixed-lens-toggle" className="text-lg font-semibold text-slate-200 cursor-pointer">
            고정 렌즈 (Fixed Lens)
            <p className="text-sm text-slate-400 mt-1">카메라 뷰를 고정하고 안정적으로 유지합니다. 동적 카메라 움직임을 비활성화합니다.</p>
          </label>
          <input
            type="checkbox"
            id="fixed-lens-toggle"
            checked={fixedLens}
            onChange={(e) => setFixedLens(e.target.checked)}
            className="relative h-6 w-11 cursor-pointer appearance-none rounded-full bg-slate-600 transition-colors duration-200 ease-in-out
                       checked:bg-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
            role="switch"
            aria-checked={fixedLens}
            disabled={loading}
          />
        </div>

        {/* Generate Audio Toggle */}
        <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg border border-slate-700">
          <label htmlFor="generate-audio-toggle" className="text-lg font-semibold text-slate-200 cursor-pointer">
            오디오 생성 (Generate Audio)
            <p className="text-sm text-slate-400 mt-1">비디오에 사운드 효과를 생성합니다 (추가 비용 발생).</p>
          </label>
          <input
            type="checkbox"
            id="generate-audio-toggle"
            checked={generateAudio}
            onChange={(e) => setGenerateAudio(e.target.checked)}
            className="relative h-6 w-11 cursor-pointer appearance-none rounded-full bg-slate-600 transition-colors duration-200 ease-in-out
                       checked:bg-secondary focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
            role="switch"
            aria-checked={generateAudio}
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
            <span>{loading ? '생성 중...' : '실행'}</span>
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="mt-8">
            <LoadingSpinner message={SEEDANCE_LOADING_MESSAGES[currentLoadingMessageIndex]} className="text-primary" />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-700 text-white rounded-md text-center border border-red-500 mt-6">
            <p className="font-semibold text-lg">오류 발생:</p>
            <p className="mt-1">{error}</p>
          </div>
        )}
      </div>

      {/* Output Section */}
      <div className="lg:w-1/2 flex flex-col space-y-4 p-6 bg-slate-800 rounded-lg shadow-md border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold text-slate-200">출력</h3>
          <div className="flex gap-2">
            <button className="px-4 py-1 text-sm bg-slate-700 text-white rounded-md hover:bg-slate-600 transition-colors duration-200" disabled>미리보기</button>
            <button className="px-4 py-1 text-sm bg-slate-700 text-slate-400 rounded-md cursor-not-allowed" disabled>JSON</button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-64 bg-slate-700 rounded-lg">
            <LoadingSpinner message={SEEDANCE_LOADING_MESSAGES[currentLoadingMessageIndex]} className="text-primary" />
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
                download={`seedance-video-${Date.now()}.mp4`}
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

export default SeedanceGenerator;