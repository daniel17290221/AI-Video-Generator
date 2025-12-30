
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createKling26T2VTask, pollKling26T2VOperation, createKling26I2VTask, pollKling26I2VOperation, uploadFileToBase64 } from '../services/kieaiService';
import LoadingSpinner from './LoadingSpinner';
import DemoModelPlaceholder from './DemoModelPlaceholder';
import { DetailedVideoPrompt } from '../types'; // Import DetailedVideoPrompt type

interface Kling26GeneratorProps {
  kieAIApiKey: string;
}

// Sub-modes for Kling 2.6
type Kling26Mode = 't2v' | 'i2v'; // Removed 'v2v'

interface ImageFile {
  id: string;
  file: File;
  preview: string; // Data URL for local preview
}

const KLING26_LOADING_MESSAGES: string[] = [
  "Kling 2.6 모델에 비디오 생성을 요청 중...",
  "당신의 아이디어를 AI가 영상으로 변환 중...",
  "고품질 영상 생성을 위해 데이터를 처리하고 있습니다...",
  "이 작업은 몇 분 정도 소요될 수 있습니다. 잠시만 기다려 주세요!",
  "사운드와 카메라 움직임을 조율 중...",
  "거의 다 됐습니다! 비디오 렌더링이 완료되고 있습니다...",
];

const Kling26Generator: React.FC<Kling26GeneratorProps> = ({ kieAIApiKey }) => {
  const [currentKling26Mode, setCurrentKling26Mode] = useState<Kling26Mode>('t2v');
  const [prompt, setPrompt] = useState<string>("In a bright rehearsal room, sunlight streams through the window, and a standing microphone is placed in the center of the room. [Campus band female lead singer] stands in front of the microphone with her eyes closed, while the other members stand around her. [Campus band female lead singer, full voice] leads: \"I will try to fix you, with all my heart and soul...\" The background is an a cappella harmony, and the camera slowly circles around the band members.");
  const [inputImage, setInputImage] = useState<ImageFile | null>(null); // Only 1 image allowed
  const [sound, setSound] = useState<boolean>(false); // Default to false
  const [duration, setDuration] = useState<string>('5'); // Default to '5' seconds

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

  // Reset image input when switching between T2V and I2V (as requirements differ)
  useEffect(() => {
    handleRemoveImage(); // Clear image on mode switch to prevent confusion
    setPrompt(currentKling26Mode === 't2v'
      ? "In a bright rehearsal room, sunlight streams through the window, and a standing microphone is placed in the center of the room. [Campus band female lead singer] stands in front of the microphone with her eyes closed, while the other members stand around her. [Campus band female lead singer, full voice] leads: \"I will try to fix you, with all my heart and soul...\" The background is an a cappella harmony, and the camera slowly circles around the band members."
      : "A sleek black sports car drifts around a sharp corner on a wet city street at night, with neon lights reflecting off the asphalt."
    );
    setJsonPromptInput('');
    setPromptInputMode('text');
  }, [currentKling26Mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const startLoadingMessages = () => {
    setCurrentLoadingMessageIndex(0);
    messageIntervalRef.current = window.setInterval(() => {
      setCurrentLoadingMessageIndex(prevIndex => (prevIndex + 1) % KLING26_LOADING_MESSAGES.length);
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
          // Clear previous object URL if any
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

  const handleReset = useCallback(() => {
    setPrompt(currentKling26Mode === 't2v'
      ? "In a bright rehearsal room, sunlight streams through the window, and a standing microphone is placed in the center of the room. [Campus band female lead singer] stands in front of the microphone with her eyes closed, while the other members stand around her. [Campus band female lead singer, full voice] leads: \"I will try to fix you, with all my heart and soul...\" The background is an a cappella harmony, and the camera slowly circles around the band members."
      : "A sleek black sports car drifts around a sharp corner on a wet city street at night, with neon lights reflecting off the asphalt."
    );
    handleRemoveImage(); // Clears input image
    setSound(false);
    setDuration('5');
    setVideoUrl(null);
    setError(null);
    setLoading(false);
    stopLoadingMessages();
    setPromptInputMode('text'); // Reset prompt input mode
    setJsonPromptInput(''); // Clear JSON input
  }, [handleRemoveImage, currentKling26Mode]);

  const handleRun = async () => {
    setError(null);
    setVideoUrl(null);

    if (!kieAIApiKey) {
      setError('Kie.ai API 키가 필요합니다.');
      return;
    }

    const maxPromptLength = currentKling26Mode === 'i2v' ? 2500 : 5000; // 2500 for I2V, 5000 for T2V

    let finalPromptText: string = '';

    if (promptInputMode === 'text') {
      if (!prompt.trim()) {
        setError('프롬프트를 입력해주세요.');
        return;
      }
      if (prompt.length < 1 || prompt.length > maxPromptLength) {
        setError(`프롬프트는 1자에서 ${maxPromptLength}자 사이여야 합니다.`);
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
        if (parsedJson.full_text_prompt.length < 1 || parsedJson.full_text_prompt.length > maxPromptLength) {
          setError(`JSON 내 "full_text_prompt"는 1자에서 ${maxPromptLength}자 사이여야 합니다.`);
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
      let taskId: string;
      let finalVideoUrl: string;

      if (currentKling26Mode === 't2v') {
        const imageUrls: string[] = [];
        if (inputImage) { // inputImage is optional for T2V, but if provided, upload it
          const uploadedUrl = await uploadFileToBase64(kieAIApiKey, inputImage.file, 'kling-t2v-input-image', inputImage.file.name);
          imageUrls.push(uploadedUrl);
        }

        taskId = await createKling26T2VTask(kieAIApiKey, {
          input: {
            prompt: finalPromptText,
            image_urls: imageUrls.length > 0 ? imageUrls : undefined, // Optional for T2V
            sound: sound,
            duration: duration,
          },
        });
        finalVideoUrl = await pollKling26T2VOperation(kieAIApiKey, taskId);
      } else if (currentKling26Mode === 'i2v') {
        if (!inputImage) {
          setError('이미지 투 비디오 모드에는 이미지를 업로드해야 합니다.');
          setLoading(false);
          stopLoadingMessages();
          return;
        }
        const uploadedImageUrl = await uploadFileToBase64(kieAIApiKey, inputImage.file, 'kling-i2v-input-image', inputImage.file.name);
        
        taskId = await createKling26I2VTask(kieAIApiKey, {
          input: {
            prompt: finalPromptText, // Prompt for motion description
            image_urls: [uploadedImageUrl], // Required for I2V, must be an array
            sound: sound,
            duration: duration,
          },
        });
        finalVideoUrl = await pollKling26I2VOperation(kieAIApiKey, taskId);
      } else {
        throw new Error('알 수 없는 Kling 2.6 모델 모드입니다.');
      }
      setVideoUrl(finalVideoUrl);
    } catch (e: any) {
      setError(e.message || '비디오 생성에 실패했습니다.');
    } finally {
      setLoading(false);
      stopLoadingMessages();
    }
  };

  const currentCreditCost = duration === '5' ? 55 : 110;
  const maxPromptLengthForDisplay = currentKling26Mode === 'i2v' ? 2500 : 5000;

  const isRunDisabled = loading || !kieAIApiKey ||
    (promptInputMode === 'text' && (!prompt.trim() || prompt.length < 1 || prompt.length > maxPromptLengthForDisplay)) ||
    (promptInputMode === 'json' && (!jsonPromptInput.trim() || JSON.parse(jsonPromptInput || '{}').full_text_prompt.length < 1 || JSON.parse(jsonPromptInput || '{}').full_text_prompt.length > maxPromptLengthForDisplay)) ||
    (currentKling26Mode === 'i2v' && !inputImage);

  return (
    <div className="flex flex-col lg:flex-row space-y-8 lg:space-y-0 lg:space-x-8 p-6 bg-slate-900 rounded-lg shadow-xl border border-slate-700">
      {/* Input Section */}
      <div className="lg:w-1/2 flex flex-col space-y-6">
        {/* Model Type Tabs for Kling 2.6 */}
        <div className="flex flex-wrap justify-start gap-3 mb-4 sticky top-[250px] bg-slate-900/80 backdrop-blur-md p-3 rounded-lg shadow-md z-10 border border-slate-800">
          <button
            onClick={() => setCurrentKling26Mode('t2v')}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                        ${currentKling26Mode === 't2v'
                          ? 'bg-primary text-white shadow-lg'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                        }
                        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
            disabled={loading}
          >
            텍스트 투 비디오
          </button>
          <button
            onClick={() => setCurrentKling26Mode('i2v')}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                        ${currentKling26Mode === 'i2v'
                          ? 'bg-primary text-white shadow-lg'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                        }
                        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
            disabled={loading}
          >
            이미지 투 비디오
          </button>
          {/* Removed V2V button as it's not supported */}
        </div>

        {/* Pricing Info */}
        <p className="text-sm text-slate-400 mb-6 bg-slate-800 p-3 rounded-lg border border-slate-700">
          <i className="ri-money-dollar-circle-line mr-2"></i>
          가격: 5초 비디오는 55 크레딧(약 $0.28), 10초 비디오는 110 크레딧(약 $0.55)이 소모됩니다. 최대 길이는 10초입니다. 모든 가격은 공식 요금보다 30% 저렴합니다.
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
          <label htmlFor="kling26-prompt-input" className="text-lg font-semibold text-slate-200 mb-2">
            프롬프트 <span className="text-red-500">*</span>
          </label>
          {promptInputMode === 'text' ? (
            <textarea
              id="kling26-prompt-input"
              className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 resize-none text-slate-50"
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`비디오 내용을 상세하게 설명해주세요 (1-${maxPromptLengthForDisplay}자)`}
              maxLength={maxPromptLengthForDisplay}
              minLength={1}
              disabled={loading}
              aria-label="Kling 2.6 비디오 텍스트 프롬프트 입력"
            ></textarea>
          ) : (
            <textarea
              id="kling26-prompt-input"
              className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 resize-none text-slate-50 font-mono"
              rows={10}
              value={jsonPromptInput}
              onChange={(e) => setJsonPromptInput(e.target.value)}
              placeholder="여기에 상세 프롬프트 JSON을 붙여넣으세요. 'full_text_prompt' 필드가 사용됩니다."
              disabled={loading}
              aria-label="Kling 2.6 비디오 JSON 프롬프트 입력"
            ></textarea>
          )}
          <p className="text-sm text-slate-400 mt-2">
            {promptInputMode === 'text' ? `입력된 글자 수: ${prompt.length} / ${maxPromptLengthForDisplay}` : `JSON 프롬프트입니다. 'full_text_prompt' 필드가 사용됩니다.`}
          </p>
        </div>

        {/* Input - Image URLs (for both T2V optional, I2V required) */}
        <div className="flex flex-col">
            <label className="text-lg font-semibold text-slate-200 mb-2">
                이미지 URL (image_urls) {currentKling26Mode === 'i2v' && <span className="text-red-500">*</span>}
            </label>
            <p className="text-sm text-slate-400 mb-4 bg-slate-800 p-3 rounded-md border border-slate-700">
              <i className="ri-information-line mr-2"></i>
              Kie.ai 서버에 이미지가 업로드되며, 생성된 URL이 비디오 생성에 사용됩니다.
              업로드된 파일은 3일 후 자동으로 삭제됩니다. (단일 이미지)
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
                        htmlFor="kling26-image-upload"
                        className="flex flex-col items-center justify-center w-48 h-48 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 cursor-pointer
                                   hover:border-primary hover:text-primary transition-colors duration-200"
                        aria-label="Upload image"
                    >
                        <i className="ri-image-add-line text-4xl mb-2"></i>
                        <span className="text-sm">파일 추가 (1/1)</span>
                        <input
                            id="kling26-image-upload"
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
            <p className="text-sm text-slate-400 mt-2">비디오 생성에 사용될 이미지의 URL</p>
        </div>

        {/* Input - Sound Toggle */}
        <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg border border-slate-700">
          <label htmlFor="kling26-sound-toggle" className="text-lg font-semibold text-slate-200 cursor-pointer">
            사운드 (sound) <span className="text-red-500">*</span>
            <p className="text-sm text-slate-400 mt-1">이 매개변수는 생성된 비디오에 사운드가 포함되는지 여부를 지정하는 데 사용됩니다.</p>
          </label>
          <input
            type="checkbox"
            id="kling26-sound-toggle"
            checked={sound}
            onChange={(e) => setSound(e.target.checked)}
            className="relative h-6 w-11 cursor-pointer appearance-none rounded-full bg-slate-600 transition-colors duration-200 ease-in-out
                       checked:bg-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
            role="switch"
            aria-checked={sound}
            disabled={loading}
          />
        </div>

        {/* Input - Duration */}
        <div className="flex flex-col">
          <label className="text-lg font-semibold text-slate-200 mb-2">
            길이 (duration) <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-3">
            {['5', '10'].map(sec => (
              <button
                key={sec}
                onClick={() => setDuration(sec)}
                className={`px-5 py-2 rounded-lg font-medium transition-colors duration-200
                            ${duration === sec
                              ? 'bg-primary text-white shadow-md'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                            }
                            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:opacity-50`}
                disabled={loading}
                aria-pressed={duration === sec}
              >
                {sec} 초
              </button>
            ))}
          </div>
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
            <LoadingSpinner message={KLING26_LOADING_MESSAGES[currentLoadingMessageIndex]} className="text-primary" />
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
                download={`kling-video-${Date.now()}.mp4`}
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

export default Kling26Generator;