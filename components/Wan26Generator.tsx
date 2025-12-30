
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createWan26T2VTask, pollWan26T2VOperation, createWan26I2VTask, pollWan26I2VOperation, createWan26V2VTask, pollWan26V2VOperation, uploadFileToBase64 } from '../services/kieaiService';
import LoadingSpinner from './LoadingSpinner';
import DemoModelPlaceholder from './DemoModelPlaceholder';
import { DetailedVideoPrompt, VideoFile } from '../types'; // Import DetailedVideoPrompt and VideoFile types

interface Wan26GeneratorProps { // Renamed from Wan26TextToVideoGeneratorProps
  kieAIApiKey: string;
}

// Sub-modes for Wan 2.6
type Wan26Mode = 't2v' | 'i2v' | 'v2v';

interface ImageFile {
  id: string;
  file: File;
  preview: string; // Data URL for local preview
}

const WAN26_LOADING_MESSAGES: string[] = [
  "Wan 2.6 모델에 비디오 생성을 요청 중...",
  "당신의 아이디어를 AI가 영상으로 변환 중...",
  "초고해상도 영상 생성을 위해 데이터를 처리하고 있습니다...",
  "이 작업은 몇 분 정도 소요될 수 있습니다. 잠시만 기다려 주세요!",
  "장면 전환 및 샷 구성을 조율 중...",
  "거의 다 됐습니다! 비디오 렌더링이 완료되고 있습니다...",
];

const Wan26Generator: React.FC<Wan26GeneratorProps> = ({ kieAIApiKey }) => { // Renamed component
  const [currentWan26Mode, setCurrentWan26Mode] = useState<Wan26Mode>('t2v');
  const [prompt, setPrompt] = useState<string>("In a hyperrealistic ASMR video, a hand uses a knitted knife to slowly slice a burger made entirely of knitted wool. The satisfyingly crisp cut reveals a detailed cross-section of knitted meat, lettuce, and tomato slices. Captured in a close-up with a shallow depth of field, the scene is set against a stark, matte black surface. Cinematic lighting makes the surreal yarn textures shine with clear reflections. The focus is on the deliberate, satisfying motion and the unique, tactile materials.");
  const [inputImages, setInputImages] = useState<ImageFile[]>([]); // For I2V
  const [inputVideos, setInputVideos] = useState<VideoFile[]>([]); // For V2V
  const [duration, setDuration] = useState<string>('5'); // Default to '5' seconds
  const [resolution, setResolution] = useState<string>('1080p'); // Default to '1080p'
  const [multiShots, setMultiShots] = useState<boolean>(false); // Default to false

  const [loading, setLoading] = useState<boolean>(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentLoadingMessageIndex, setCurrentLoadingMessageIndex] = useState<number>(0);
  const messageIntervalRef = useRef<number | null>(null);

  const [promptInputMode, setPromptInputMode] = useState<'text' | 'json'>('text');
  const [jsonPromptInput, setJsonPromptInput] = useState<string>('');

  useEffect(() => {
    return () => {
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
      }
    };
  }, []);

  // Effect to reset image/video inputs when mode changes
  useEffect(() => {
    handleRemoveAllImages();
    handleRemoveAllVideos();
    // Adjust duration options if switching to V2V which has different limits
    if (currentWan26Mode === 'v2v' && !['5', '10'].includes(duration)) {
        setDuration('5'); // Default to 5s if current duration is not supported
    } else if (currentWan26Mode !== 'v2v' && !['5', '10', '15'].includes(duration)) {
        setDuration('5'); // Default to 5s for other modes if current duration is not supported
    }
  }, [currentWan26Mode]); // eslint-disable-line react-hooks/exhaustive-deps


  const startLoadingMessages = () => {
    setCurrentLoadingMessageIndex(0);
    messageIntervalRef.current = window.setInterval(() => {
      setCurrentLoadingMessageIndex(prevIndex => (prevIndex + 1) % WAN26_LOADING_MESSAGES.length);
    }, 5000);
  };

  const stopLoadingMessages = () => {
    if (messageIntervalRef.current) {
      clearInterval(messageIntervalRef.current);
      messageIntervalRef.current = null;
    }
  };

  // --- Image Handling for I2V ---
  const handleImageFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (inputImages.length >= 3) { // Allow up to 3 images for I2V as per other models
      setError('최대 3개의 이미지만 업로드할 수 있습니다.');
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
        reader.readAsDataURL(file);
      } catch (e: any) {
        setError(e.message || '이미지 미리보기를 생성할 수 없습니다.');
      }
      event.target.value = '';
    }
  }, [inputImages]);

  const handleRemoveImage = useCallback((id: string) => {
    setInputImages(prev => prev.filter(img => img.id !== id));
    URL.revokeObjectURL(id);
    setError(null);
  }, []);

  const handleRemoveAllImages = useCallback(() => {
    inputImages.forEach(img => URL.revokeObjectURL(img.id));
    setInputImages([]);
    setError(null);
  }, [inputImages]);

  // --- Video Handling for V2V ---
  const handleVideoFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (inputVideos.length >= 3) { // Allow up to 3 videos for V2V
      setError('최대 3개의 비디오만 업로드할 수 있습니다.');
      return;
    }
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (!file.type.startsWith('video/')) {
        setError('비디오 파일만 선택해주세요.');
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
          setInputVideos(prev => [...prev, { id: URL.createObjectURL(file), file, preview: previewUrl }]);
        };
        reader.onerror = (e) => {
          setError(`파일 읽기 오류: ${e.target?.error?.message || '알 수 없는 오류'}`);
        };
        reader.readAsDataURL(file); // Or use readAsArrayBuffer if needed for actual processing
      } catch (e: any) {
        setError(e.message || '비디오 미리보기를 생성할 수 없습니다.');
      }
      event.target.value = '';
    }
  }, [inputVideos]);

  const handleRemoveVideo = useCallback((id: string) => {
    setInputVideos(prev => prev.filter(vid => vid.id !== id));
    URL.revokeObjectURL(id);
    setError(null);
  }, []);

  const handleRemoveAllVideos = useCallback(() => {
    inputVideos.forEach(vid => URL.revokeObjectURL(vid.id));
    setInputVideos([]);
    setError(null);
  }, [inputVideos]);


  const handleReset = useCallback(() => {
    setPrompt("In a hyperrealistic ASMR video, a hand uses a knitted knife to slowly slice a burger made entirely of knitted wool. The satisfyingly crisp cut reveals a detailed cross-section of knitted meat, lettuce, and tomato slices. Captured in a close-up with a shallow depth of field, the scene is set against a stark, matte black surface. Cinematic lighting makes the surreal yarn textures shine with clear reflections. The focus is on the deliberate, satisfying motion and the unique, tactile materials.");
    handleRemoveAllImages();
    handleRemoveAllVideos();
    setDuration('5');
    setResolution('1080p');
    setMultiShots(false);
    setVideoUrl(null);
    setError(null);
    setLoading(false);
    stopLoadingMessages();
    setPromptInputMode('text');
    setJsonPromptInput('');
    setCurrentWan26Mode('t2v'); // Reset mode as well
  }, [handleRemoveAllImages, handleRemoveAllVideos]);

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

    setLoading(true);
    startLoadingMessages();

    try {
      let taskId: string;
      let finalVideoUrl: string;

      if (currentWan26Mode === 't2v') {
        taskId = await createWan26T2VTask(kieAIApiKey, {
          input: {
            prompt: finalPromptText,
            duration: duration,
            resolution: resolution,
            multi_shots: multiShots,
          },
        });
        finalVideoUrl = await pollWan26T2VOperation(kieAIApiKey, taskId);
      } else if (currentWan26Mode === 'i2v') {
        if (inputImages.length === 0) {
          setError('이미지 투 비디오 모드에는 이미지를 업로드해야 합니다.');
          setLoading(false);
          stopLoadingMessages();
          return;
        }
        const uploadedImageUrls: string[] = [];
        for (const imageFile of inputImages) {
          const uploadedUrl = await uploadFileToBase64(kieAIApiKey, imageFile.file, 'wan26-input-images', imageFile.file.name);
          uploadedImageUrls.push(uploadedUrl);
        }
        taskId = await createWan26I2VTask(kieAIApiKey, {
          input: {
            prompt: finalPromptText,
            image_urls: uploadedImageUrls,
            duration: duration,
            resolution: resolution,
            multi_shots: multiShots,
          },
        });
        finalVideoUrl = await pollWan26I2VOperation(kieAIApiKey, taskId);
      } else if (currentWan26Mode === 'v2v') {
        if (inputVideos.length === 0) {
          setError('비디오 투 비디오 모드에는 비디오를 업로드해야 합니다.');
          setLoading(false);
          stopLoadingMessages();
          return;
        }
        const uploadedVideoUrls: string[] = [];
        for (const videoFile of inputVideos) {
          // Assuming uploadFileToBase64 can handle video files correctly.
          // This might require a specific video upload endpoint if not.
          const uploadedUrl = await uploadFileToBase64(kieAIApiKey, videoFile.file, 'wan26-input-videos', videoFile.file.name);
          uploadedVideoUrls.push(uploadedUrl);
        }
        taskId = await createWan26V2VTask(kieAIApiKey, {
          input: {
            prompt: finalPromptText,
            video_urls: uploadedVideoUrls,
            duration: duration, // V2V duration limited to 5 or 10s
            resolution: resolution,
            multi_shots: multiShots,
          },
        });
        finalVideoUrl = await pollWan26V2VOperation(kieAIApiKey, taskId);
      } else {
        throw new Error('알 수 없는 Wan 2.6 모델 모드입니다.');
      }
      setVideoUrl(finalVideoUrl);
    } catch (e: any) {
      setError(e.message || '비디오 생성에 실패했습니다.');
    } finally {
      setLoading(false);
      stopLoadingMessages();
    }
  };

  const currentDurationOptions = currentWan26Mode === 'v2v' ? ['5', '10'] : ['5', '10', '15'];
  const currentCreditCost =
    resolution === '720p'
      ? (duration === '5' ? 70 : duration === '10' ? 140 : 209.5)
      : (duration === '5' ? 104.5 : duration === '10' ? 209.5 : 315);


  const isRunDisabled = loading || !kieAIApiKey ||
    (promptInputMode === 'text' && (!prompt.trim() || prompt.length < 1 || prompt.length > 5000)) ||
    (promptInputMode === 'json' && !jsonPromptInput.trim()) ||
    (currentWan26Mode === 'i2v' && inputImages.length === 0) ||
    (currentWan26Mode === 'v2v' && inputVideos.length === 0);

  return (
    <div className="flex flex-col lg:flex-row space-y-8 lg:space-y-0 lg:space-x-8 p-6 bg-slate-900 rounded-lg shadow-xl border border-slate-700">
      <div className="lg:w-1/2 flex flex-col space-y-6">
        {/* Model Type Tabs for Wan 2.6 */}
        <div className="flex flex-wrap justify-start gap-3 mb-4 sticky top-[250px] bg-slate-900/80 backdrop-blur-md p-3 rounded-lg shadow-md z-10 border border-slate-800">
          <button
            onClick={() => setCurrentWan26Mode('t2v')}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                        ${currentWan26Mode === 't2v'
                          ? 'bg-primary text-white shadow-lg'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                        }
                        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
            disabled={loading}
          >
            텍스트 투 비디오
          </button>
          <button
            onClick={() => setCurrentWan26Mode('i2v')}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                        ${currentWan26Mode === 'i2v'
                          ? 'bg-primary text-white shadow-lg'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                        }
                        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
            disabled={loading}
          >
            이미지 투 비디오
          </button>
          <button
            onClick={() => setCurrentWan26Mode('v2v')}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                        ${currentWan26Mode === 'v2v'
                          ? 'bg-primary text-white shadow-lg'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                        }
                        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
            disabled={loading}
          >
            비디오 투 비디오
          </button>
        </div>

        {/* Pricing Info */}
        <p className="text-sm text-slate-400 mb-6 bg-slate-800 p-3 rounded-lg border border-slate-700">
          <i className="ri-information-line mr-2"></i>
          가격: Wan 2.6 API는 720p 해상도에서 5/10/15초 비디오에 각각 70/140/209.5 크레딧(약 $0.35/$0.70/$1.05)이, 1080p 해상도에서 5/10/15초 비디오에 각각 104.5/209.5/315 크레딧(약 $0.53/$1.05/$1.58)이 소모됩니다. 이 모든 가격은 Fal 공식 요금보다 약 30% 저렴한 단일 요금제입니다.
          (참고: 비디오 투 비디오 모드에서는 최대 10초까지 지원됩니다.)
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
          <label htmlFor="wan26-prompt-input" className="text-lg font-semibold text-slate-200 mb-2">
            프롬프트 <span className="text-red-500">*</span>
          </label>
          {promptInputMode === 'text' ? (
            <textarea
              id="wan26-prompt-input"
              className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 resize-none text-slate-50"
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="비디오 내용을 상세하게 설명해주세요 (1-5000자)"
              maxLength={5000}
              minLength={1}
              disabled={loading}
              aria-label="Wan 2.6 비디오 텍스트 프롬프트 입력"
            ></textarea>
          ) : (
            <textarea
              id="wan26-prompt-input"
              className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 resize-none text-slate-50 font-mono"
              rows={10}
              value={jsonPromptInput}
              onChange={(e) => setJsonPromptInput(e.target.value)}
              placeholder="여기에 상세 프롬프트 JSON을 붙여넣으세요. 'full_text_prompt' 필드가 사용됩니다."
              disabled={loading}
              aria-label="Wan 2.6 비디오 JSON 프롬프트 입력"
            ></textarea>
          )}
          <p className="text-sm text-slate-400 mt-2">
            {promptInputMode === 'text' ? `입력된 글자 수: ${prompt.length} / 5000` : `JSON 프롬프트입니다. 'full_text_prompt' 필드가 사용됩니다.`}
          </p>
        </div>

        {/* Conditional Image Input for I2V */}
        {currentWan26Mode === 'i2v' && (
          <div className="flex flex-col">
            <label className="text-lg font-semibold text-slate-200 mb-2">
              이미지 (image_urls) <span className="text-red-500">*</span>
            </label>
            <p className="text-sm text-slate-400 mb-4 bg-slate-800 p-3 rounded-md border border-slate-700">
              <i className="ri-information-line mr-2"></i>
              Kie.ai 서버에 이미지가 업로드되며, 생성된 URL이 비디오 생성에 사용됩니다.
              업로드된 파일은 3일 후 자동으로 삭제됩니다. (최대 3개)
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
              {inputImages.length < 3 && (
                <label
                  htmlFor="wan26-image-upload"
                  className="flex flex-col items-center justify-center w-48 h-48 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 cursor-pointer
                             hover:border-primary hover:text-primary transition-colors duration-200"
                  aria-label="Add more image files"
                >
                  <i className="ri-image-add-line text-4xl mb-2"></i>
                  <span className="text-sm">파일 추가 ({inputImages.length}/3)</span>
                  <input
                    id="wan26-image-upload"
                    type="file"
                    accept="image/jpeg, image/png, image/webp"
                    onChange={handleImageFileChange}
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
        )}

        {/* Conditional Video Input for V2V */}
        {currentWan26Mode === 'v2v' && (
          <div className="flex flex-col">
            <label className="text-lg font-semibold text-slate-200 mb-2">
              비디오 (video_urls) <span className="text-red-500">*</span>
            </label>
            <p className="text-sm text-slate-400 mb-4 bg-slate-800 p-3 rounded-md border border-slate-700">
              <i className="ri-information-line mr-2"></i>
              Kie.ai 서버에 비디오가 업로드되며, 생성된 URL이 비디오 생성에 사용됩니다.
              업로드된 파일은 3일 후 자동으로 삭제됩니다. (최대 3개)
            </p>
            <div className="flex flex-wrap gap-4 mb-4">
              {inputVideos.map((vid) => (
                <div key={vid.id} className="relative w-48 h-48 rounded-lg overflow-hidden border border-slate-600">
                  <video src={vid.preview} className="w-full h-full object-cover" />
                  <button
                    onClick={() => handleRemoveVideo(vid.id)}
                    className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 text-sm
                             hover:bg-red-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label={`Remove video ${vid.file.name}`}
                    disabled={loading}
                  >
                    <i className="ri-close-line"></i>
                  </button>
                  <span className="absolute bottom-1 left-2 text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
                    파일 {inputVideos.indexOf(vid) + 1}
                  </span>
                </div>
              ))}
              {inputVideos.length < 3 && (
                <label
                  htmlFor="wan26-video-upload"
                  className="flex flex-col items-center justify-center w-48 h-48 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 cursor-pointer
                             hover:border-primary hover:text-primary transition-colors duration-200"
                  aria-label="Add more video files"
                >
                  <i className="ri-video-add-line text-4xl mb-2"></i>
                  <span className="text-sm">파일 추가 ({inputVideos.length}/3)</span>
                  <input
                    id="wan26-video-upload"
                    type="file"
                    accept="video/mp4, video/quicktime, video/x-matroska"
                    onChange={handleVideoFileChange}
                    className="hidden"
                    disabled={loading}
                  />
                </label>
              )}
            </div>
            {inputVideos.length > 0 && (
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleRemoveAllVideos}
                  className="bg-red-700 hover:bg-red-800 text-white font-semibold py-2 px-4 rounded-lg text-sm
                             transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                  disabled={loading}
                >
                  모두 제거
                </button>
              </div>
            )}
          </div>
        )}

        {/* Input - Duration */}
        <div className="flex flex-col">
          <label className="text-lg font-semibold text-slate-200 mb-2">
            길이 (duration)
          </label>
          <p className="text-sm text-slate-400 mb-2">생성될 비디오의 길이 (초)</p>
          <div className="flex flex-wrap gap-3">
            {currentDurationOptions.map(sec => (
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

        {/* Input - Resolution */}
        <div className="flex flex-col">
          <label className="text-lg font-semibold text-slate-200 mb-2">
            해상도 (resolution)
          </label>
          <p className="text-sm text-slate-400 mb-2">비디오 해상도</p>
          <div className="flex flex-wrap gap-3">
            {['720p', '1080p'].map(res => (
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

        {/* Input - Multi Shots Toggle */}
        <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg border border-slate-700">
          <label htmlFor="multi-shots-toggle" className="text-lg font-semibold text-slate-200 cursor-pointer">
            멀티샷 (multi_shots)
            <p className="text-sm text-slate-400 mt-1">AI 비디오 생성 중 샷 구성 스타일을 제어하여, 생성된 비디오가 단일 연속 샷인지 또는 전환이 있는 여러 샷인지 결정합니다.</p>
          </label>
          <input
            type="checkbox"
            id="multi-shots-toggle"
            checked={multiShots}
            onChange={(e) => setMultiShots(e.target.checked)}
            className="relative h-6 w-11 cursor-pointer appearance-none rounded-full bg-slate-600 transition-colors duration-200 ease-in-out
                       checked:bg-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
            role="switch"
            aria-checked={multiShots}
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
            <LoadingSpinner message={WAN26_LOADING_MESSAGES[currentLoadingMessageIndex]} className="text-primary" />
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
                download={`wan26-video-${Date.now()}.mp4`}
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

export default Wan26Generator;