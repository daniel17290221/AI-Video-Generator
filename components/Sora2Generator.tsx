
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  createSora2ProT2VTask, pollSora2ProT2VOperation,
  createSora2ProI2VTask, pollSora2ProI2VOperation,
  createSora2T2VTask, pollSora2T2VOperation,
  createSora2I2VTask, pollSora2I2VOperation,
  createSora2WatermarkRemoverTask, pollSora2WatermarkRemoverOperation,
  createSora2CharactersTask, pollSora2CharactersOperation,
  createSora2ProStoryboardTask, pollSora2ProStoryboardOperation, // New Storyboard
  uploadFileToBase64
} from '../services/kieaiService';
import LoadingSpinner from './LoadingSpinner';
import DemoModelPlaceholder from './DemoModelPlaceholder';
import { DetailedVideoPrompt, VideoFile } from '../types';

interface Sora2GeneratorProps {
  kieAIApiKey: string;
}

// Sub-modes for Sora 2
type Sora2Mode = 't2v' | 'i2v' | 't2v_alt' | 'i2v_alt' | 'watermark_remover' | 'characters' | 'storyboard';

interface ImageFile {
  id: string;
  file: File;
  preview: string; // Data URL for local preview
}

interface StoryboardShot {
  id: string; // Unique ID for React list keys
  scene: string;
  duration: number;
}

type OutputResult =
  { type: 'video', url: string } |
  { type: 'characterId', id: string, rawJson: string } |
  null;

// Dynamic loading messages based on mode
const SORA2_LOADING_MESSAGES: Record<Sora2Mode | 'general', string[]> = {
  'general': [ // Fallback messages
    "Sora 2 모델에 비디오 생성을 요청 중...",
    "당신의 아이디어를 AI가 영상으로 변환 중...",
    "이 작업은 몇 분 정도 소요될 수 있습니다. 잠시만 기다려 주세요!",
  ],
  't2v': [
    "Sora 2 Pro 텍스트 투 비디오를 생성 중...",
    "텍스트 프롬프트를 분석하여 장면을 구성 중...",
    "움직임, 질감, 디테일을 정교하게 렌더링 중...",
    "거의 다 됐습니다! 비디오 렌더링이 완료되고 있습니다...",
  ],
  'i2v': [
    "Sora 2 Pro 이미지 투 비디오를 생성 중...",
    "입력 이미지를 AI가 이해하고 움직임을 부여하는 중...",
    "이미지 콘텐츠와 모션 프롬프트를 통합 중...",
    "이 작업은 몇 분 정도 소요될 수 있습니다. 잠시만 기다려 주세요!",
    "고품질 비디오를 렌더링 중...",
  ],
  't2v_alt': [
    "Sora 2 텍스트 투 비디오 (스탠다드)를 생성 중...",
    "텍스트 프롬프트 기반으로 비디오 스토리를 구상 중...",
    "기본 해상도로 장면을 렌더링 중...",
    "비디오 생성이 거의 완료되었습니다...",
  ],
  'i2v_alt': [
    "Sora 2 이미지 투 비디오 (스탠다드)를 생성 중...",
    "입력 이미지를 기반으로 비디오 시퀀스를 생성 중...",
    "모션과 이미지를 스탠다드 품질로 통합 중...",
    "비디오 생성이 거의 완료되었습니다...",
  ],
  'watermark_remover': [
    "Sora 2 비디오에서 워터마크를 제거 중...",
    "원본 비디오를 분석하여 워터마크 영역을 식별 중...",
    "워터마크를 제거하고 깨끗한 비디오를 렌더링 중...",
    "워터마크 제거 작업이 완료되고 있습니다...",
  ],
  'characters': [
    "Sora 2 캐릭터를 생성 중...",
    "입력 비디오를 분석하여 캐릭터 특징을 추출 중...",
    "캐릭터 정의를 생성하고 있습니다...",
    "거의 다 됐습니다! 캐릭터 ID가 생성되고 있습니다...",
  ],
  'storyboard': [
    "Sora 2 Pro 스토리보드를 생성 중...",
    "장면 시퀀스를 분석하고 비디오 흐름을 계획 중...",
    "각 샷의 지속 시간과 내용에 맞춰 콘텐츠를 렌더링 중...",
    "이 작업은 시간이 다소 소요될 수 있습니다. 잠시만 기다려 주세요!",
    "스토리보드 비디오 클립들을 통합하고 최종 렌더링 중...",
    "거의 다 됐습니다! 스토리보드 비디오가 완성되고 있습니다...",
  ],
};

const Sora2Generator: React.FC<Sora2GeneratorProps> = ({ kieAIApiKey }) => {
  const [currentSoraMode, setCurrentSoraMode] = useState<Sora2Mode>('t2v');
  // Common states for video generation (t2v, i2v, t2v_alt, i2v_alt)
  const [prompt, setPrompt] = useState<string>("a happy dog running in the garden");
  const [inputImage, setInputImage] = useState<ImageFile | null>(null); // For I2V modes
  const [aspectRatio, setAspectRatio] = useState<string>('landscape');
  const [nFrames, setNFrames] = useState<string>('10'); // Total duration for storyboard and other T2V/I2V
  const [size, setSize] = useState<'standard' | 'high'>('high');
  const [removeWatermark, setRemoveWatermark] = useState<boolean>(true);
  const [promptInputMode, setPromptInputMode] = useState<'text' | 'json'>('text');
  const [jsonPromptInput, setJsonPromptInput] = useState<string>('');

  // States specific to Watermark Remover
  const [soraVideoUrl, setSoraVideoUrl] = useState<string>('');

  // States specific to Characters
  const [characterVideoFile, setCharacterVideoFile] = useState<VideoFile | null>(null);
  const [characterPrompt, setCharacterPrompt] = useState<string>('');
  const [safetyInstruction, setSafetyInstruction] = useState<string>('');

  // States specific to Storyboard
  const [storyboardImages, setStoryboardImages] = useState<ImageFile | null>(null); // Only 1 image for storyboard input based on UI hint
  const [storyboardShots, setStoryboardShots] = useState<StoryboardShot[]>([
    { id: 'shot-1', scene: "A cute fluffy orange-and-white kitten wearing orange headphones, sitting at a cozy indoor table with a small slice of cake on a plate, a toy fish and a silver microphone nearby, warm soft lighting, cinematic close-up, shallow depth of field, gentle ASMR atmosphere.", duration: 7.5 },
    { id: 'shot-2', scene: "The same cute fluffy orange-and-white kitten wearing orange headphones, in the same cozy indoor ASMR setup with the toy fish and microphone, the cake now finished, the kitten gently licks its lips with a satisfied smile, warm ambient lighting, cinematic close-up, shallow depth of field, calm and content mood.", duration: 7.5 }
  ]);
  const nextShotId = useRef(3); // To generate unique IDs for new shots


  const [loading, setLoading] = useState<boolean>(false);
  const [outputResult, setOutputResult] = useState<OutputResult>(null); // Unified output state
  const [error, setError] = useState<string | null>(null);
  const [currentLoadingMessageIndex, setCurrentLoadingMessageIndex] = useState<number>(0);
  const messageIntervalRef = useRef<number | null>(null);


  useEffect(() => {
    return () => {
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
      }
    };
  }, []);

  // Reset inputs and adjust defaults when switching modes
  useEffect(() => {
    // Clear all input states
    setPrompt("a happy dog running in the garden");
    handleRemoveImage();
    setAspectRatio('landscape');
    setNFrames('10');
    setRemoveWatermark(true);
    setSoraVideoUrl('');
    handleRemoveCharacterVideo();
    setCharacterPrompt('');
    setSafetyInstruction('');
    handleRemoveStoryboardImage(); // New: clear storyboard image
    setStoryboardShots([ // Reset storyboard shots to default
        { id: 'shot-1', scene: "A cute fluffy orange-and-white kitten wearing orange headphones, sitting at a cozy indoor table with a small slice of cake on a plate, a toy fish and a silver microphone nearby, warm soft lighting, cinematic close-up, shallow depth of field, gentle ASMR atmosphere.", duration: 7.5 },
        { id: 'shot-2', scene: "The same cute fluffy orange-and-white kitten wearing orange headphones, in the same cozy indoor ASMR setup with the toy fish and microphone, the cake now finished, the kitten gently licks its lips with a satisfied smile, warm ambient lighting, cinematic close-up, shallow depth of field, calm and content mood.", duration: 7.5 }
    ]);
    nextShotId.current = 3; // Reset nextShotId for consistency
    
    // Clear outputs and errors
    setOutputResult(null);
    setError(null);
    setLoading(false);
    stopLoadingMessages();
    setPromptInputMode('text');
    setJsonPromptInput('');

    // Adjust size based on Pro/Alt mode for video generation, or default
    if (currentSoraMode === 't2v' || currentSoraMode === 'i2v') {
      setSize('high');
    } else if (currentSoraMode === 't2v_alt' || currentSoraMode === 'i2v_alt') {
      setSize('standard');
    } else { // For watermark_remover, characters, storyboard
      setSize('standard'); // Not directly applicable, but ensures a default
    }

    // Adjust nFrames options for storyboard
    if (currentSoraMode === 'storyboard') {
        setNFrames('15'); // Default to 15s for storyboard
    } else {
        setNFrames('10'); // Default to 10s for other modes
    }
  }, [currentSoraMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const startLoadingMessages = () => {
    setCurrentLoadingMessageIndex(0);
    const messages = SORA2_LOADING_MESSAGES[currentSoraMode] || SORA2_LOADING_MESSAGES.general;
    messageIntervalRef.current = window.setInterval(() => {
      setCurrentLoadingMessageIndex(prevIndex => (prevIndex + 1) % messages.length);
    }, 5000);
  };

  const stopLoadingMessages = () => {
    if (messageIntervalRef.current) {
      clearInterval(messageIntervalRef.current);
      messageIntervalRef.current = null;
    }
  };

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>, target: 'inputImage' | 'storyboardImages') => {
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
          if (target === 'inputImage') {
            if (inputImage?.id) {
              URL.revokeObjectURL(inputImage.id);
            }
            setInputImage({ id: URL.createObjectURL(file), file, preview: previewUrl });
          } else { // target === 'storyboardImages'
            if (storyboardImages?.id) {
                URL.revokeObjectURL(storyboardImages.id);
            }
            setStoryboardImages({ id: URL.createObjectURL(file), file, preview: previewUrl });
          }
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
  }, [inputImage, storyboardImages]);

  const handleRemoveImage = useCallback(() => {
    if (inputImage?.id) {
        URL.revokeObjectURL(inputImage.id);
    }
    setInputImage(null);
    setError(null);
  }, [inputImage]);

  // --- Character Video File Handling ---
  const handleCharacterVideoFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
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
          if (characterVideoFile?.id) {
            URL.revokeObjectURL(characterVideoFile.id);
          }
          setCharacterVideoFile({ id: URL.createObjectURL(file), file, preview: previewUrl });
        };
        reader.onerror = (e) => {
          setError(`파일 읽기 오류: ${e.target?.error?.message || '알 수 없는 오류'}`);
        };
        reader.readAsDataURL(file);
      } catch (e: any) {
        setError(e.message || '비디오 미리보기를 생성할 수 없습니다.');
      }
      event.target.value = '';
    }
  }, [characterVideoFile]);

  const handleRemoveCharacterVideo = useCallback(() => {
    if (characterVideoFile?.id) {
        URL.revokeObjectURL(characterVideoFile.id);
    }
    setCharacterVideoFile(null);
    setError(null);
  }, [characterVideoFile]);

  // --- Storyboard Image Handling ---
  const handleStoryboardImageFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(event, 'storyboardImages');
  }, [handleFileChange]);

  const handleRemoveStoryboardImage = useCallback(() => {
    if (storyboardImages?.id) {
        URL.revokeObjectURL(storyboardImages.id);
    }
    setStoryboardImages(null);
    setError(null);
  }, [storyboardImages]);

  // --- Storyboard Shot Management ---
  const handleAddShot = useCallback(() => {
    setStoryboardShots(prev => [
      ...prev,
      { id: `shot-${nextShotId.current++}`, scene: '', duration: 0 }
    ]);
  }, []);

  const handleRemoveShot = useCallback((id: string) => {
    setStoryboardShots(prev => prev.filter(shot => shot.id !== id));
  }, []);

  const handleUpdateShot = useCallback((id: string, field: 'scene' | 'duration', value: string | number) => {
    setStoryboardShots(prev =>
      prev.map(shot =>
        shot.id === id
          ? { ...shot, [field]: value }
          : shot
      )
    );
  }, []);

  const handleRemoveAllShots = useCallback(() => {
    setStoryboardShots([]);
  }, []);

  const totalShotsDuration = useMemo(() => {
    return storyboardShots.reduce((sum, shot) => sum + Number(shot.duration), 0);
  }, [storyboardShots]);

  const handleReset = useCallback(() => {
    setPrompt("a happy dog running in the garden");
    handleRemoveImage();
    setAspectRatio('landscape');
    setNFrames('10'); // Default for standard T2V/I2V
    // Set size based on currentSoraMode
    if (currentSoraMode === 't2v' || currentSoraMode === 'i2v') {
      setSize('high');
    } else if (currentSoraMode === 't2v_alt' || currentSoraMode === 'i2v_alt') {
      setSize('standard');
    }
    setRemoveWatermark(true);
    setSoraVideoUrl('');
    handleRemoveCharacterVideo();
    setCharacterPrompt('');
    setSafetyInstruction('');
    handleRemoveStoryboardImage(); // Clear storyboard image
    setStoryboardShots([ // Reset storyboard shots to initial default
        { id: 'shot-1', scene: "A cute fluffy orange-and-white kitten wearing orange headphones, sitting at a cozy indoor table with a small slice of cake on a plate, a toy fish and a silver microphone nearby, warm soft lighting, cinematic close-up, shallow depth of field, gentle ASMR atmosphere.", duration: 7.5 },
        { id: 'shot-2', scene: "The same cute fluffy orange-and-white kitten wearing orange headphones, in the same cozy indoor ASMR setup with the toy fish and microphone, the cake now finished, the kitten gently licks its lips with a satisfied smile, warm ambient lighting, cinematic close-up, shallow depth of field, calm and content mood.", duration: 7.5 }
    ]);
    nextShotId.current = 3;
    setOutputResult(null);
    setError(null);
    setLoading(false);
    stopLoadingMessages();
    setPromptInputMode('text');
    setJsonPromptInput('');
  }, [handleRemoveImage, handleRemoveCharacterVideo, handleRemoveStoryboardImage, currentSoraMode]);

  const handleRun = async () => {
    setError(null);
    setOutputResult(null); // Clear previous output

    if (!kieAIApiKey) {
      setError('Kie.ai API 키가 필요합니다.');
      return;
    }

    setLoading(true);
    startLoadingMessages(); // Start messages for the current mode

    try {
      let taskId: string;
      let finalResult: string | {character_id: string, rawJson: string};
      let uploadedImageUrl: string | undefined;
      let uploadedVideoUrl: string | undefined;

      if (currentSoraMode === 'watermark_remover') {
        if (!soraVideoUrl.trim()) {
          setError('워터마크를 제거할 Sora 2 비디오 URL을 입력해주세요.');
          setLoading(false);
          stopLoadingMessages();
          return;
        }
        if (!soraVideoUrl.startsWith('https://sora.chatgpt.com/') || soraVideoUrl.length > 500) {
            setError('유효한 Sora 2 비디오 URL을 입력해주세요. (sora.chatgpt.com으로 시작하며, 최대 500자)');
            setLoading(false);
            stopLoadingMessages();
            return;
        }

        taskId = await createSora2WatermarkRemoverTask(kieAIApiKey, {
          input: {
            video_url: soraVideoUrl,
          },
        });
        finalResult = await pollSora2WatermarkRemoverOperation(kieAIApiKey, taskId);
        setOutputResult({ type: 'video', url: finalResult });

      } else if (currentSoraMode === 'characters') {
        if (!characterVideoFile) {
          setError('캐릭터 생성 모드에는 비디오 파일을 업로드해야 합니다.');
          setLoading(false);
          stopLoadingMessages();
          return;
        }
        uploadedVideoUrl = await uploadFileToBase64(kieAIApiKey, characterVideoFile.file, 'sora2-character-video', characterVideoFile.file.name);

        taskId = await createSora2CharactersTask(kieAIApiKey, {
          input: {
            character_file_url: uploadedVideoUrl ? [uploadedVideoUrl] : undefined,
            character_prompt: characterPrompt.trim() !== '' ? characterPrompt : undefined,
            safety_instruction: safetyInstruction.trim() !== '' ? safetyInstruction : undefined,
          },
        });
        finalResult = await pollSora2CharactersOperation(kieAIApiKey, taskId);
        setOutputResult({ type: 'characterId', id: finalResult.character_id, rawJson: finalResult.rawJson });
        
      } else if (currentSoraMode === 'storyboard') {
        if (storyboardShots.length === 0) {
            setError('스토리보드에는 최소 하나 이상의 샷이 필요합니다.');
            setLoading(false);
            stopLoadingMessages();
            return;
        }
        if (totalShotsDuration !== parseInt(nFrames)) {
            setError(`모든 샷의 지속 시간 합계(${totalShotsDuration}s)가 전체 비디오 길이(${nFrames}s)와 일치해야 합니다.`);
            setLoading(false);
            stopLoadingMessages();
            return;
        }
        for (const shot of storyboardShots) {
            if (!shot.scene.trim()) {
                setError('모든 샷에 장면 설명을 입력해야 합니다.');
                setLoading(false);
                stopLoadingMessages();
                return;
            }
            if (shot.duration <= 0) {
                setError('모든 샷의 지속 시간은 0보다 커야 합니다.');
                setLoading(false);
                stopLoadingMessages();
                return;
            }
            if (shot.scene.length > 5000) { // Max length for scene prompt
                setError(`샷 설명은 5000자를 초과할 수 없습니다. (샷 ID: ${shot.id})`);
                setLoading(false);
                stopLoadingMessages();
                return;
            }
        }

        let storyboardImageUrls: string[] | undefined;
        if (storyboardImages) {
            uploadedImageUrl = await uploadFileToBase64(kieAIApiKey, storyboardImages.file, 'sora2-storyboard-image', storyboardImages.file.name);
            storyboardImageUrls = [uploadedImageUrl];
        }

        taskId = await createSora2ProStoryboardTask(kieAIApiKey, {
          input: {
            n_frames: nFrames,
            image_urls: storyboardImageUrls,
            aspect_ratio: aspectRatio,
            shots: storyboardShots.map(s => ({ Scene: s.scene, duration: s.duration })),
          },
        });
        finalResult = await pollSora2ProStoryboardOperation(kieAIApiKey, taskId);
        setOutputResult({ type: 'video', url: finalResult });

      } else { // T2V/I2V video generation modes
        let finalPromptText: string = '';

        if (promptInputMode === 'text') {
          if (!prompt.trim()) {
            setError('프롬프트를 입력해주세요.');
            setLoading(false);
            stopLoadingMessages();
            return;
          }
          if (prompt.length < 1 || prompt.length > 10000) {
            setError('프롬프트는 1자에서 10000자 사이여야 합니다.');
            setLoading(false);
            stopLoadingMessages();
            return;
          }
          finalPromptText = prompt;
        } else { // JSON mode
          if (!jsonPromptInput.trim()) {
            setError('JSON 프롬프트를 입력해주세요.');
            setLoading(false);
            stopLoadingMessages();
            return;
          }
          try {
            const parsedJson: DetailedVideoPrompt = JSON.parse(jsonPromptInput);
            if (!parsedJson.full_text_prompt) {
              setError('JSON 입력에 "full_text_prompt" 필드가 누락되었습니다.');
              setLoading(false);
              stopLoadingMessages();
              return;
            }
            if (parsedJson.full_text_prompt.length < 1 || parsedJson.full_text_prompt.length > 10000) {
              setError('JSON 내 "full_text_prompt"는 1자에서 10000자 사이여야 합니다.');
              setLoading(false);
              stopLoadingMessages();
              return;
            }
            finalPromptText = parsedJson.full_text_prompt;
          } catch (e: any) {
            setError(`유효하지 않은 JSON 형식입니다: ${e.message}`);
            setLoading(false);
            stopLoadingMessages();
            return;
          }
        }

        // Handle image upload if in I2V mode
        if (currentSoraMode === 'i2v' || currentSoraMode === 'i2v_alt') {
          if (!inputImage) {
            setError('이미지 투 비디오 모드에는 이미지를 업로드해야 합니다.');
            setLoading(false);
            stopLoadingMessages();
            return;
          }
          uploadedImageUrl = await uploadFileToBase64(kieAIApiKey, inputImage.file, 'sora2-input-image', inputImage.file.name);
        }

        switch (currentSoraMode) {
          case 't2v':
            taskId = await createSora2ProT2VTask(kieAIApiKey, {
              input: {
                prompt: finalPromptText,
                aspect_ratio: aspectRatio,
                n_frames: nFrames,
                size: size,
                remove_watermark: removeWatermark,
              },
            });
            finalResult = await pollSora2ProT2VOperation(kieAIApiKey, taskId);
            break;
          case 'i2v':
            taskId = await createSora2ProI2VTask(kieAIApiKey, {
              input: {
                prompt: finalPromptText, // Motion description
                image_urls: uploadedImageUrl ? [uploadedImageUrl] : undefined, // Assumed to be single image for now
                aspect_ratio: aspectRatio,
                n_frames: nFrames,
                size: size,
                remove_watermark: removeWatermark,
              },
            });
            finalResult = await pollSora2ProI2VOperation(kieAIApiKey, taskId);
            break;
          case 't2v_alt':
            taskId = await createSora2T2VTask(kieAIApiKey, {
              input: {
                prompt: finalPromptText,
                aspect_ratio: aspectRatio,
                n_frames: nFrames,
                size: size, // Should be 'standard' by default from useEffect
                remove_watermark: removeWatermark,
              },
            });
            finalResult = await pollSora2T2VOperation(kieAIApiKey, taskId);
            break;
          case 'i2v_alt':
            taskId = await createSora2I2VTask(kieAIApiKey, {
              input: {
                prompt: finalPromptText, // Motion description
                image_urls: uploadedImageUrl ? [uploadedImageUrl] : undefined,
                aspect_ratio: aspectRatio,
                n_frames: nFrames,
                size: size, // Should be 'standard' by default from useEffect
                remove_watermark: removeWatermark,
              },
            });
            finalResult = await pollSora2I2VOperation(kieAIApiKey, taskId);
            break;
          default:
            setError('선택된 Sora 2 모드는 아직 구현되지 않았습니다.');
            setLoading(false);
            stopLoadingMessages();
            return;
        }
        setOutputResult({ type: 'video', url: finalResult });
      }
    } catch (e: any) {
      setError(e.message || '작업 생성에 실패했습니다.');
    } finally {
      setLoading(false);
      stopLoadingMessages();
    }
  };

  const calculateCreditCost = useCallback(() => {
    if (currentSoraMode === 'watermark_remover') {
      return 70; // Fixed cost for watermark removal
    }
    if (currentSoraMode === 'characters') {
      return 50; // Fixed cost for character creation
    }
    if (currentSoraMode === 'storyboard') {
      const frames = parseInt(nFrames, 10);
      if (frames === 10) return 400;
      if (frames === 15) return 600;
      if (frames === 25) return 900;
      return 0; // Fallback
    }
    // Pro modes (t2v, i2v)
    if (currentSoraMode === 't2v' || currentSoraMode === 'i2v') {
      if (size === 'high') {
        return nFrames === '10' ? 330 : 630; // 10s High vs 15s High
      } else { // 'standard' size for Pro (though UI defaults to high)
        return nFrames === '10' ? 150 : 270; // 10s Standard vs 15s Standard
      }
    }
    // Alt modes (t2v_alt, i2v_alt) - assumed to be 'standard' quality
    else if (currentSoraMode === 't2v_alt' || currentSoraMode === 'i2v_alt') {
      return nFrames === '10' ? 150 : 270; // 10s Standard vs 15s Standard
    }
    return 0; // For unimplemented modes
  }, [currentSoraMode, nFrames, size]);

  const currentCreditCost = calculateCreditCost();

  const isRunDisabled = loading || !kieAIApiKey ||
    (currentSoraMode === 'watermark_remover' && (!soraVideoUrl.trim() || !soraVideoUrl.startsWith('https://sora.chatgpt.com/') || soraVideoUrl.length > 500)) ||
    (currentSoraMode === 'characters' && !characterVideoFile) || // Only character video is strictly required
    (currentSoraMode === 'storyboard' && (
        storyboardShots.length === 0 ||
        totalShotsDuration !== parseInt(nFrames, 10) ||
        storyboardShots.some(shot => !shot.scene.trim() || shot.duration <= 0 || shot.scene.length > 5000) // Validate shots
    )) ||
    (!['watermark_remover', 'characters', 'storyboard'].includes(currentSoraMode) && // Only validate prompt/image for non-placeholder/non-watermark/non-character/non-storyboard modes
      (promptInputMode === 'text' && (!prompt.trim() || prompt.length < 1 || prompt.length > 10000)) ||
      (promptInputMode === 'json' && !jsonPromptInput.trim()) ||
      ((currentSoraMode === 'i2v' || currentSoraMode === 'i2v_alt') && !inputImage)) ||
    !['t2v', 'i2v', 't2v_alt', 'i2v_alt', 'watermark_remover', 'characters', 'storyboard'].includes(currentSoraMode); // Only enabled modes are clickable


  const isImageInputRequired = currentSoraMode === 'i2v' || currentSoraMode === 'i2v_alt';
  const isPromptInputRequired = !['watermark_remover', 'characters', 'storyboard'].includes(currentSoraMode);
  const isSoraVideoUrlInputRequired = currentSoraMode === 'watermark_remover';
  const isCharacterInputRequired = currentSoraMode === 'characters';
  const isStoryboardInputRequired = currentSoraMode === 'storyboard';

  const renderVideoGenerationInputs = (
    <>
      {isPromptInputRequired && (
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
            <label htmlFor="sora2-프롬프트-input" className="text-lg font-semibold text-slate-200 mb-2">
              프롬프트 <span className="text-red-500">*</span>
            </label>
            {promptInputMode === 'text' ? (
              <textarea
                id="sora2-프롬프트-input"
                className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 resize-none text-slate-50"
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="비디오 내용을 상세하게 설명해주세요 (1-10000자)"
                maxLength={10000}
                minLength={1}
                disabled={loading}
                aria-label="Sora 2 비디오 텍스트 프롬프트 입력"
              ></textarea>
            ) : (
              <textarea
                id="sora2-프롬프트-input"
                className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 resize-none text-slate-50 font-mono"
                rows={10}
                value={jsonPromptInput}
                onChange={(e) => setJsonPromptInput(e.target.value)}
                placeholder="여기에 상세 프롬프트 JSON을 붙여넣으세요. 'full_text_prompt' 필드가 사용됩니다."
                disabled={loading}
                aria-label="Sora 2 비디오 JSON 프롬프트 입력"
              ></textarea>
            )}
            <p className="text-sm text-slate-400 mt-2">
              {promptInputMode === 'text' ? `입력된 글자 수: ${prompt.length} / 10000` : `JSON 프롬프트입니다. 'full_text_prompt' 필드가 사용됩니다.`}
            </p>
          </div>
        </>
      )}

      {/* Input - Image Input (Only for I2V modes) */}
      {isImageInputRequired && (
        <div className="flex flex-col">
          <label className="text-lg font-semibold text-slate-200 mb-2">
            시작 이미지 (image_urls) <span className="text-red-500">*</span>
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
                  업로드 성공
                </span>
              </div>
            ) : (
              <label
                htmlFor="sora2-image-upload"
                className="flex flex-col items-center justify-center w-48 h-48 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 cursor-pointer
                           hover:border-primary hover:text-primary transition-colors duration-200"
                aria-label="Upload image"
              >
                <i className="ri-image-add-line text-4xl mb-2"></i>
                <span className="text-sm">파일 추가 (1/1)</span>
                <input
                  id="sora2-image-upload"
                  type="file"
                  accept="image/jpeg, image/png, image/webp"
                  onChange={(e) => handleFileChange(e, 'inputImage')}
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
          <p className="text-sm text-slate-400 mt-2">비디오의 시작점으로 사용될 이미지 (단일 이미지만 지원)</p>
        </div>
      )}

      {/* Input - Aspect Ratio */}
      <div className="flex flex-col">
        <label className="text-lg font-semibold text-slate-200 mb-2">
          화면 비율 (aspect_ratio)
        </label>
        <div className="flex flex-wrap gap-3">
          {['portrait', 'landscape'].map(ratio => (
            <button
              key={ratio}
              onClick={() => setAspectRatio(ratio)}
              className={`px-5 py-2 rounded-lg font-medium capitalize transition-colors duration-200
                          ${aspectRatio === ratio
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                          }
                          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:opacity-50`}
              disabled={loading}
              aria-pressed={aspectRatio === ratio}
            >
              {ratio === 'portrait' ? '세로' : '가로'}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-400 mt-2">이미지의 종횡비를 정의합니다.</p>
      </div>

      {/* Input - N Frames (Duration) */}
      <div className="flex flex-col">
        <label className="text-lg font-semibold text-slate-200 mb-2">
          프레임 수 (n_frames)
        </label>
        <div className="flex flex-wrap gap-3">
          {['10', '15'].map(frames => (
            <button
              key={frames}
              onClick={() => setNFrames(frames)}
              className={`px-5 py-2 rounded-lg font-medium transition-colors duration-200
                          ${nFrames === frames
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                          }
                          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:opacity-50`}
                disabled={loading}
                aria-pressed={nFrames === frames}
              >
                {frames}s
              </button>
            ))}
          </div>
          <p className="text-sm text-slate-400 mt-2">생성될 프레임 수 (비디오 길이).</p>
        </div>
      )}

      {/* Input - Size (Quality) */}
      <div className="flex flex-col">
        <label className="text-lg font-semibold text-slate-200 mb-2">
          크기 (size)
        </label>
        <div className="flex flex-wrap gap-3">
          {['standard', 'high'].map(s => (
            <button
              key={s}
              onClick={() => setSize(s as 'standard' | 'high')}
              className={`px-5 py-2 rounded-lg font-medium capitalize transition-colors duration-200
                          ${size === s
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                          }
                          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:opacity-50`}
              disabled={loading ||
                        ((currentSoraMode === 't2v_alt' || currentSoraMode === 'i2v_alt') && s === 'high')} // Non-Pro cannot select 'high'
              aria-pressed={size === s}
            >
              {s === 'standard' ? '스탠다드' : '고품질'}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-400 mt-2">생성된 비디오의 품질 또는 크기.</p>
        {(currentSoraMode === 't2v_alt' || currentSoraMode === 'i2v_alt') && (
            <p className="text-sm text-yellow-400 mt-2 bg-slate-800 p-2 rounded-md border border-yellow-700">
                <i className="ri-alert-line mr-2"></i>
                일반 Sora 2 모델은 고품질(High) 모드를 지원하지 않습니다. 스탠다드(Standard) 모드만 선택 가능합니다.
            </p>
        )}
      </div>

      {/* Input - Remove Watermark Toggle */}
      <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg border border-slate-700">
        <label htmlFor="sora2-watermark-toggle" className="text-lg font-semibold text-slate-200 cursor-pointer">
          워터마크 제거 (remove_watermark)
          <p className="text-sm text-slate-400 mt-1">생성된 비디오에서 워터마크를 제거합니다.</p>
        </label>
        <input
          type="checkbox"
          id="sora2-watermark-toggle"
          checked={removeWatermark}
          onChange={(e) => setRemoveWatermark(e.target.checked)}
          className="relative h-6 w-11 cursor-pointer appearance-none rounded-full bg-slate-600 transition-colors duration-200 ease-in-out
                     checked:bg-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
          role="switch"
          aria-checked={removeWatermark}
          disabled={loading}
        />
      </div>
    </>
  );

  const renderWatermarkRemoverInputs = (
    <div className="flex flex-col space-y-6">
      <h3 className="text-2xl font-bold text-slate-200">워터마크 제거 입력</h3>
      <label htmlFor="sora-video-url-input" className="text-lg font-semibold text-slate-200 mb-2">
        Sora 2 비디오 URL <span className="text-red-500">*</span>
      </label>
      <p className="text-sm text-slate-400 mb-4 bg-slate-800 p-3 rounded-md border border-slate-700">
        <i className="ri-information-line mr-2"></i>
        워터마크를 제거할 Sora 2 비디오의 공개 URL을 입력하세요.
        (예: `https://sora.chatgpt.com/p/s_68e83bd7eee88191be79d2ba7158516f`)
      </p>
      <input
        id="sora-video-url-input"
        type="text"
        value={soraVideoUrl}
        onChange={(e) => setSoraVideoUrl(e.target.value)}
        placeholder="여기에 Sora 2 비디오 URL을 붙여넣으세요."
        maxLength={500}
        className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 text-slate-50"
        disabled={loading}
        aria-label="Sora 2 비디오 URL 입력"
      />
      {soraVideoUrl.length > 0 && (!soraVideoUrl.startsWith('https://sora.chatgpt.com/') || soraVideoUrl.length > 500) && (
        <p className="text-sm text-red-400 mt-2 bg-slate-800 p-2 rounded-md border border-red-700">
          <i className="ri-error-warning-line mr-2"></i>
          유효한 Sora 2 비디오 URL을 입력해주세요. (sora.chatgpt.com으로 시작하며, 최대 500자)
        </p>
      )}
      <p className="text-sm text-slate-400 mt-2">워터마크를 제거할 Sora 2 비디오의 공개 URL.</p>
    </div>
  );

  const renderCharactersInputs = (
    <div className="flex flex-col space-y-6">
      <h3 className="text-2xl font-bold text-slate-200">캐릭터 생성 입력</h3>
      {/* Input - character_file_url */}
      <div className="flex flex-col">
        <label className="text-lg font-semibold text-slate-200 mb-2">
          캐릭터 비디오 파일 (character_file_url) <span className="text-red-500">*</span>
        </label>
        <p className="text-sm text-slate-400 mb-4 bg-slate-800 p-3 rounded-md border border-slate-700">
          <i className="ri-information-line mr-2"></i>
          캐릭터 정의에 사용될 비디오 파일을 업로드하세요. Kie.ai 서버에 업로드되며, 3일 후 자동 삭제됩니다.
          (지원 형식: MP4, WEBM, AVI, MOV. 최대 파일 크기: 10MB; 최대 파일 수: 1)
        </p>
        <div className="flex flex-wrap gap-4 mb-4">
          {characterVideoFile ? (
            <div key={characterVideoFile.id} className="relative w-48 h-48 rounded-lg overflow-hidden border border-slate-600">
              <video src={characterVideoFile.preview} className="w-full h-full object-cover" controls={false} muted loop />
              <button
                onClick={handleRemoveCharacterVideo}
                className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 text-sm
                           hover:bg-red-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                aria-label={`Remove video ${characterVideoFile.file.name}`}
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
              htmlFor="sora2-character-video-upload"
              className="flex flex-col items-center justify-center w-48 h-48 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 cursor-pointer
                         hover:border-primary hover:text-primary transition-colors duration-200"
              aria-label="Upload character video"
            >
              <i className="ri-video-add-line text-4xl mb-2"></i>
              <span className="text-sm">비디오 추가 (1/1)</span>
              <input
                id="sora2-character-video-upload"
                type="file"
                accept="video/mp4,video/webm,video/avi,video/quicktime,video/x-matroska"
                onChange={handleCharacterVideoFileChange}
                className="hidden"
                disabled={loading}
              />
            </label>
          )}
        </div>
        {characterVideoFile && (
          <div className="flex justify-end mt-2">
            <button
              onClick={handleRemoveCharacterVideo}
              className="bg-red-700 hover:bg-red-800 text-white font-semibold py-2 px-4 rounded-lg text-sm
                         transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
              disabled={loading}
            >
              제거
            </button>
          </div>
        )}
      </div>

      {/* Input - character_prompt */}
      <div className="flex flex-col">
        <label htmlFor="character-prompt-input" className="text-lg font-semibold text-slate-200 mb-2">
          캐릭터 프롬프트 (character_prompt)
        </label>
        <textarea
          id="character-prompt-input"
          className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 resize-none text-slate-50"
          rows={4}
          value={characterPrompt}
          onChange={(e) => setCharacterPrompt(e.target.value)}
          placeholder="캐릭터의 표시 효과를 설명해주세요 (최대 5000자)"
          maxLength={5000}
          disabled={loading}
          aria-label="캐릭터 프롬프트 입력"
        ></textarea>
        <p className="text-sm text-slate-400 mt-2">입력된 글자 수: {characterPrompt.length} / 5000</p>
      </div>

      {/* Input - safety_instruction */}
      <div className="flex flex-col">
        <label htmlFor="safety-instruction-input" className="text-lg font-semibold text-slate-200 mb-2">
          안전 지침 (safety_instruction)
        </label>
        <textarea
          id="safety-instruction-input"
          className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 resize-none text-slate-50"
          rows={4}
          value={safetyInstruction}
          onChange={(e) => setSafetyInstruction(e.target.value)}
          placeholder="캐릭터가 표시해서는 안 되는 내용을 설명해주세요 (최대 5000자)"
          maxLength={5000}
          disabled={loading}
          aria-label="안전 지침 입력"
        ></textarea>
        <p className="text-sm text-slate-400 mt-2">입력된 글자 수: {safetyInstruction.length} / 5000</p>
      </div>
    </div>
  );

  const renderStoryboardInputs = (
    <div className="flex flex-col space-y-6">
        <h3 className="text-2xl font-bold text-slate-200 mb-4">스토리보드 입력</h3>

        {/* Total Video Length (n_frames) */}
        <div className="flex flex-col">
            <label className="text-lg font-semibold text-slate-200 mb-2">
                전체 비디오 길이 (n_frames) <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-3">
            {['10', '15', '25'].map(frames => (
                <button
                key={frames}
                onClick={() => setNFrames(frames)}
                className={`px-5 py-2 rounded-lg font-medium transition-colors duration-200
                            ${nFrames === frames
                                ? 'bg-primary text-white shadow-md'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                            }
                            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:opacity-50`}
                disabled={loading}
                aria-pressed={nFrames === frames}
                >
                {frames}s
                </button>
            ))}
            </div>
            <p className="text-sm text-slate-400 mt-2">생성될 비디오의 총 길이 (초).</p>
        </div>

        {/* Input - Image URLs (storyboard_image_urls) */}
        <div className="flex flex-col">
            <label className="text-lg font-semibold text-slate-200 mb-2">
                참조 이미지 (image_urls)
            </label>
            <p className="text-sm text-slate-400 mb-4 bg-slate-800 p-3 rounded-md border border-slate-700">
                <i className="ri-information-line mr-2"></i>
                스토리보드의 시각적 스타일 및 콘텐츠에 대한 참조로 사용할 이미지를 업로드하세요.
                Kie.ai 서버에 업로드되며, 3일 후 자동으로 삭제됩니다. (단일 이미지)
            </p>
            <div className="flex flex-wrap gap-4 mb-4">
            {storyboardImages ? (
                <div key={storyboardImages.id} className="relative w-48 h-48 rounded-lg overflow-hidden border border-slate-600">
                <img src={storyboardImages.preview} alt="Storyboard input preview" className="w-full h-full object-cover" />
                <button
                    onClick={handleRemoveStoryboardImage}
                    className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 text-sm
                                hover:bg-red-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label={`Remove image ${storyboardImages.file.name}`}
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
                htmlFor="sora2-storyboard-image-upload"
                className="flex flex-col items-center justify-center w-48 h-48 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 cursor-pointer
                            hover:border-primary hover:text-primary transition-colors duration-200"
                aria-label="Upload storyboard image"
                >
                <i className="ri-image-add-line text-4xl mb-2"></i>
                <span className="text-sm">파일 추가 (1/1)</span>
                <input
                    id="sora2-storyboard-image-upload"
                    type="file"
                    accept="image/jpeg, image/png, image/webp"
                    onChange={handleStoryboardImageFileChange}
                    className="hidden"
                    disabled={loading}
                />
                </label>
            )}
            </div>
            {storyboardImages && (
            <div className="flex justify-end mt-2">
                <button
                onClick={handleRemoveStoryboardImage}
                className="bg-red-700 hover:bg-red-800 text-white font-semibold py-2 px-4 rounded-lg text-sm
                            transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                disabled={loading}
                >
                제거
                </button>
            </div>
            )}
            <p className="text-sm text-slate-400 mt-2">비디오의 전반적인 분위기와 스타일을 결정하는 참조 이미지.</p>
        </div>

        {/* Aspect Ratio */}
        <div className="flex flex-col">
            <label className="text-lg font-semibold text-slate-200 mb-2">
                화면 비율 (aspect_ratio)
            </label>
            <div className="flex flex-wrap gap-3">
            {['portrait', 'landscape'].map(ratio => (
                <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                className={`px-5 py-2 rounded-lg font-medium capitalize transition-colors duration-200
                            ${aspectRatio === ratio
                                ? 'bg-primary text-white shadow-md'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                            }
                            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:opacity-50`}
                disabled={loading}
                aria-pressed={aspectRatio === ratio}
                >
                {ratio === 'portrait' ? '세로' : '가로'}
                </button>
            ))}
            </div>
            <p className="text-sm text-slate-400 mt-2">비디오의 종횡비를 정의합니다.</p>
        </div>

        {/* Shots Input */}
        <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
                <label className="text-lg font-semibold text-slate-200">
                    장면 (shots) <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center text-sm text-slate-400">
                    <span className="mr-2">총 지속 시간: {totalShotsDuration.toFixed(1)}s</span>
                    <span className={`font-bold ${totalShotsDuration === parseInt(nFrames, 10) ? 'text-green-400' : 'text-red-400'}`}>
                        남은 시간: {(parseInt(nFrames, 10) - totalShotsDuration).toFixed(1)}s
                    </span>
                </div>
            </div>
            <p className="text-sm text-slate-400 bg-slate-800 p-3 rounded-md border border-slate-700">
                <i className="ri-information-line mr-2"></i>
                각 샷의 지속 시간과 설명을 입력하여 비디오의 흐름을 정의합니다. 모든 샷의 지속 시간 합계는 위에 설정된 "전체 비디오 길이"와 정확히 일치해야 합니다. (샷 설명 최대 5000자)
            </p>
            {storyboardShots.map((shot, index) => (
                <div key={shot.id} className="p-4 bg-slate-800 rounded-lg border border-slate-700 flex flex-col space-y-3">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-md font-bold text-slate-200">Scene {index + 1}</span>
                        <button
                            onClick={() => handleRemoveShot(shot.id)}
                            className="text-red-500 hover:text-red-400 transition-colors"
                            aria-label={`Remove scene ${index + 1}`}
                            disabled={loading}
                        >
                            <i className="ri-delete-bin-line"></i>
                        </button>
                    </div>
                    <textarea
                        value={shot.scene}
                        onChange={(e) => handleUpdateShot(shot.id, 'scene', e.target.value)}
                        placeholder="이 장면에서 무엇이, 누가, 어떻게 일어나는지 설명해주세요 (최대 5000자)"
                        rows={3}
                        maxLength={5000}
                        className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 resize-none text-slate-50"
                        disabled={loading}
                        aria-label={`Scene ${index + 1} description`}
                    ></textarea>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={shot.duration}
                            onChange={(e) => handleUpdateShot(shot.id, 'duration', parseFloat(e.target.value) || 0)}
                            min={0.1}
                            step={0.1}
                            className="w-24 p-2 bg-slate-700 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 text-slate-50"
                            disabled={loading}
                            aria-label={`Scene ${index + 1} duration in seconds`}
                        />
                        <span className="text-slate-300">s</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">입력된 글자 수: {shot.scene.length} / 5000</p>
                </div>
            ))}
            <div className="flex justify-end gap-3 mt-4">
                <button
                    onClick={handleRemoveAllShots}
                    className="bg-red-700 hover:bg-red-800 text-white font-semibold py-2 px-4 rounded-lg text-sm
                               transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                    disabled={loading || storyboardShots.length === 0}
                >
                    모든 샷 제거
                </button>
                <button
                    onClick={handleAddShot}
                    className="bg-secondary hover:bg-emerald-600 text-white font-semibold py-2 px-4 rounded-lg text-sm
                               transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-50"
                    disabled={loading}
                >
                    <i className="ri-add-line mr-1"></i> 샷 추가
                </button>
            </div>
        </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row space-y-8 lg:space-y-0 lg:space-x-8 p-6 bg-slate-900 rounded-lg shadow-xl border border-slate-700">
      {/* Input Section */}
      <div className="lg:w-1/2 flex flex-col space-y-6">
        {/* Model Description and Pricing */}
        <div className="mb-4">
          <p className="text-md text-slate-300 mb-2">
            Sora 2는 OpenAI의 첨단 비디오 생성 모델로, 텍스트 또는 이미지를 통해 현실적이고 상상력이 풍부한 비디오를 생성합니다.
          </p>
          <div className="flex flex-wrap justify-start gap-3 mb-4">
            <button
              onClick={() => setCurrentSoraMode('t2v')}
              className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                          ${currentSoraMode === 't2v'
                            ? 'bg-primary text-white shadow-lg'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                          }
                          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
              disabled={loading}
            >
              Sora 2 Pro 텍스트 투 비디오 {currentSoraMode === 't2v' && <i className="ri-check-line ml-1"></i>}
            </button>
            <button
              onClick={() => setCurrentSoraMode('i2v')}
              className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                          ${currentSoraMode === 'i2v'
                            ? 'bg-primary text-white shadow-lg'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                          }
                          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
              disabled={loading}
            >
              Sora 2 Pro 이미지 투 비디오 {currentSoraMode === 'i2v' && <i className="ri-check-line ml-1"></i>}
            </button>
            <button
              onClick={() => setCurrentSoraMode('t2v_alt')}
              className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                          ${currentSoraMode === 't2v_alt'
                            ? 'bg-primary text-white shadow-lg'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                          }
                          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
              disabled={loading}
            >
              Sora 2 일반 텍스트 투 비디오 {currentSoraMode === 't2v_alt' && <i className="ri-check-line ml-1"></i>}
            </button>
            <button
              onClick={() => setCurrentSoraMode('i2v_alt')}
              className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                          ${currentSoraMode === 'i2v_alt'
                            ? 'bg-primary text-white shadow-lg'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                          }
                          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
              disabled={loading}
            >
              Sora 2 일반 이미지 투 비디오 {currentSoraMode === 'i2v_alt' && <i className="ri-check-line ml-1"></i>}
            </button>
            <button
              onClick={() => setCurrentSoraMode('watermark_remover')}
              className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                          ${currentSoraMode === 'watermark_remover'
                            ? 'bg-primary text-white shadow-lg'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                          }
                          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
              disabled={loading}
            >
              Sora 워터마크 제거 {currentSoraMode === 'watermark_remover' && <i className="ri-check-line ml-1"></i>}
            </button>
            <button
              onClick={() => setCurrentSoraMode('characters')}
              className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                          ${currentSoraMode === 'characters'
                            ? 'bg-primary text-white shadow-lg'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                          }
                          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
              disabled={loading}
            >
              Sora 2 캐릭터 {currentSoraMode === 'characters' && <i className="ri-check-line ml-1"></i>}
            </button>
            <button
              onClick={() => setCurrentSoraMode('storyboard')}
              className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                          ${currentSoraMode === 'storyboard'
                            ? 'bg-primary text-white shadow-lg'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                          }
                          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
              disabled={loading}
            >
              Sora 2 Pro 스토리보드 {currentSoraMode === 'storyboard' && <i className="ri-check-line ml-1"></i>}
            </button>
          </div>
          <p className="text-sm text-slate-400 bg-slate-800 p-3 rounded-lg border border-slate-700">
            <i className="ri-money-dollar-circle-line mr-2"></i>
            가격: Sora 2 Pro 고품질 모드는 10초 비디오에 330 크레딧(약 $1.65), 15초 비디오에 630 크레딧(약 $3.15)이 소모됩니다. Sora 2 스탠다드 모드는 10초 비디오에 150 크레딧(약 $0.75), 15초 비디오에 270 크레딧(약 $1.35)이 소모됩니다. **Sora 워터마크 제거는 70 크레딧(약 $0.35)이 소모됩니다. Sora 2 캐릭터 생성은 50 크레딧(약 $0.25)이 소모됩니다. Sora 2 Pro 스토리보드 10초는 400 크레딧(약 $2.00), 15초는 600 크레딧(약 $3.00), 25초는 900 크레딧(약 $4.50)이 소모됩니다.** 이 모든 가격은 공식 가격보다 58-75% 저렴하며, 워터마크가 없습니다.
          </p>
        </div>

        {/* Conditional Input Rendering based on currentSoraMode */}
        {currentSoraMode === 'watermark_remover' ? (
          renderWatermarkRemoverInputs
        ) : currentSoraMode === 'characters' ? (
          renderCharactersInputs
        ) : currentSoraMode === 'storyboard' ? (
          renderStoryboardInputs
        ) : ['t2v', 'i2v', 't2v_alt', 'i2v_alt'].includes(currentSoraMode) ? (
          renderVideoGenerationInputs
        ) : (
          <DemoModelPlaceholder modelName={`Sora 2 ${
            currentSoraMode === 'storyboard' ? 'Pro 스토리보드' : '알 수 없는 모드'
          }`} />
        )}

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
            {outputResult?.type === 'characterId' ? (
              <>
                <button className="px-4 py-1 text-sm bg-slate-700 text-slate-400 rounded-md cursor-not-allowed" disabled>미리보기</button>
                <button className="px-4 py-1 text-sm bg-primary text-white rounded-md transition-colors duration-200" disabled>JSON</button>
              </>
            ) : (
              <>
                <button className="px-4 py-1 text-sm bg-slate-700 text-white rounded-md hover:bg-slate-600 transition-colors duration-200" disabled>미리보기</button>
                <button className="px-4 py-1 text-sm bg-slate-700 text-slate-400 rounded-md cursor-not-allowed" disabled>JSON</button>
              </>
            )}
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-64 bg-slate-700 rounded-lg">
            <LoadingSpinner message={SORA2_LOADING_MESSAGES[currentSoraMode][currentLoadingMessageIndex]} className="text-primary" />
          </div>
        )}

        {outputResult?.type === 'video' && !loading && (
          <>
            <p className="text-slate-300">출력 유형: 비디오</p>
            <video
              src={outputResult.url}
              controls
              className="w-full rounded-lg shadow-lg border border-slate-600"
              style={{ maxHeight: '400px' }}
            >
              귀하의 브라우저는 비디오 태그를 지원하지 않습니다.
            </video>
            <div className="flex justify-center gap-4 mt-4">
              <a
                href={outputResult.url}
                target="_blank"
                rel="noopener noreferrer"
                download={`sora2-video-${Date.now()}.mp4`}
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

        {outputResult?.type === 'characterId' && !loading && (
            <div className="mt-4 p-4 bg-slate-700 rounded-lg border border-slate-600 text-slate-50 text-md space-y-3 whitespace-pre-wrap custom-scrollbar max-h-[600px] overflow-y-auto">
                <p className="text-slate-300">출력 유형: 캐릭터 ID</p>
                <p className="text-md text-slate-200 font-bold mb-2">생성된 캐릭터 ID:</p>
                <textarea
                  readOnly
                  value={outputResult.rawJson ? JSON.stringify(JSON.parse(outputResult.rawJson).resultObject, null, 2) : `{"character_id": "${outputResult.id}"}`}
                  className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md text-slate-50 text-sm resize-none custom-scrollbar font-mono"
                  rows={5}
                  aria-label="생성된 캐릭터 ID JSON"
                ></textarea>
                <button
                  onClick={() => navigator.clipboard.writeText(outputResult.rawJson ? JSON.stringify(JSON.parse(outputResult.rawJson).resultObject, null, 2) : `{"character_id": "${outputResult.id}"}`)}
                  className="mt-3 bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-lg text-md transition-colors duration-200 flex items-center gap-2"
                >
                  <i className="ri-clipboard-line"></i>
                  JSON 복사
                </button>
            </div>
        )}

        {!outputResult && !loading && !error && (
          <div className="flex items-center justify-center h-64 bg-slate-700 rounded-lg text-slate-400 text-xl">
            비디오/캐릭터를 생성해주세요.
          </div>
        )}
      </div>
    </div>
  );
};

export default Sora2Generator;
