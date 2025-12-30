
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DetailedVideoPrompt } from '../types';
import { generateDetailedVideoPrompt } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';

interface PromptGeneratorProps {
  geminiApiKey: string; // API key is now passed as a prop
}

const PROMPT_GEN_LOADING_MESSAGES: string[] = [
  "상세 프롬프트를 생성하는 중...",
  "당신의 아이디어를 AI가 분석 중...",
  "AI 모델이 창의적인 요소를 조합 중...",
  "몇 초 정도 소요될 수 있습니다. 잠시만 기다려 주세요!",
  "프롬프트 구성을 마무리하는 중...",
  "거의 다 됐습니다! 프롬프트가 완성되고 있습니다...",
];

// const PROMPT_GENERATION_CREDITS_COST = 5; // Removed as per request

const CHARACTER_OPTIONS = ['용감한 영웅', '신비로운 마법사', '귀여운 동물', '과학자', '탐험가', '고대 전사', '미래 도시인', '요정', '로봇', '뱀파이어'];
const SCENARIO_OPTIONS = ['모험', '일상', '전투', '미스터리 해결', '탐험', '스포츠', '사랑', '드라마', '생존', '탈출'];
const CAMERA_ANGLE_OPTIONS = ['클로즈업', '미디엄샷', '롱샷', '새의 눈', '로우 앵글', '패닝', '틸트', '핸드헬드', '드론샷', '주밍'];
const STYLE_OPTIONS = ['빈티지', '미래적', '애니메이션', '유화 스타일', '사이버펑크', '흑백 필름', '수채화', '판타지 아트', '만화', '다큐멘터리'];

const PromptGenerator: React.FC<PromptGeneratorProps> = ({ geminiApiKey }) => {
  const [idea, setIdea] = useState<string>('강아지가 공원에서 신나게 뛰어노는 모습');
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [selectedCameraAngles, setSelectedCameraAngles] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [generatedPrompt, setGeneratedPrompt] = useState<DetailedVideoPrompt | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentLoadingMessageIndex, setCurrentLoadingMessageIndex] = useState<number>(0);
  const messageIntervalRef = useRef<number | null>(null);
  const [outputDisplayMode, setOutputDisplayMode] = useState<'preview' | 'json'>('preview');


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
      setCurrentLoadingMessageIndex(prevIndex => (prevIndex + 1) % PROMPT_GEN_LOADING_MESSAGES.length);
    }, 5000);
  };

  const stopLoadingMessages = () => {
    if (messageIntervalRef.current) {
      clearInterval(messageIntervalRef.current);
      messageIntervalRef.current = null;
    }
  };

  const toggleSelection = useCallback((
    options: string[],
    setOptions: React.Dispatch<React.SetStateAction<string[]>>,
    option: string
  ) => {
    setOptions(prev =>
      prev.includes(option) ? prev.filter(item => item !== option) : [...prev, option]
    );
  }, []);

  const addRandomSelection = useCallback((
    allOptions: string[],
    currentSelectedOptions: string[], // Added this parameter to pass the current state array
    setOptions: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const availableOptions = allOptions.filter(opt => !currentSelectedOptions.includes(opt)); // Use currentSelectedOptions
    if (availableOptions.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableOptions.length);
      const randomOption = availableOptions[randomIndex];
      setOptions(prev => [...prev, randomOption]);
    }
  }, []);

  const handleReset = useCallback(() => {
    setIdea('강아지가 공원에서 신나게 뛰어노는 모습');
    setSelectedCharacters([]);
    setSelectedScenarios([]);
    setSelectedCameraAngles([]);
    setSelectedStyles([]);
    setGeneratedPrompt(null);
    setError(null);
    setLoading(false);
    stopLoadingMessages();
    setOutputDisplayMode('preview'); // Reset output mode on reset
  }, []);

  const handleGeneratePrompt = async () => {
    setError(null);
    setGeneratedPrompt(null);
    setOutputDisplayMode('preview'); // Reset to preview when generating new prompt

    if (!geminiApiKey) {
      setError('Gemini API 키가 필요합니다.');
      return;
    }

    if (!idea.trim()) {
      setError('비디오 아이디어를 입력해주세요.');
      return;
    }

    setLoading(true);
    startLoadingMessages();

    try {
      const result = await generateDetailedVideoPrompt(
        idea,
        {
          characters: selectedCharacters,
          scenarios: selectedScenarios,
          cameraAngles: selectedCameraAngles,
          styles: selectedStyles,
        },
        geminiApiKey
      );
      setGeneratedPrompt(result);
    } catch (e: any) {
      setError(e.message || '프롬프트 생성에 실패했습니다.');
    } finally {
      setLoading(false);
      stopLoadingMessages();
    }
  };

  const isGenerateDisabled = loading || !geminiApiKey || !idea.trim();
  const isOutputReady = generatedPrompt && !loading;

  return (
    <div className="flex flex-col lg:flex-row space-y-8 lg:space-y-0 lg:space-x-8 p-6 bg-slate-900 rounded-lg shadow-xl border border-slate-700">
      {/* Input Section */}
      <div className="lg:w-1/2 flex flex-col space-y-6">
        <h2 className="text-3xl font-bold text-center text-primary mb-6">AI 상세 프롬프트 생성기</h2>

        {/* Credits Display - Removed as per request */}
        {/* <div className="flex justify-end mb-4">
          <span className="bg-orange-500 text-white text-sm font-bold px-3 py-1 rounded-full">Credits: 4,979.6</span>
        </div> */}

        {/* Video Idea Input */}
        <div className="flex flex-col">
          <label htmlFor="video-idea" className="text-lg font-semibold text-slate-200 mb-2">
            비디오 아이디어 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="video-idea"
            className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md focus:ring-primary focus:border-primary placeholder-slate-400 resize-none text-slate-50"
            rows={4}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="생성하고 싶은 비디오의 간단한 아이디어를 설명해주세요. (예: 푸른 하늘 아래 활기찬 도시의 풍경)"
            disabled={loading}
            aria-label="비디오 아이디어 입력"
          ></textarea>
        </div>

        {/* Multi-select Categories */}
        {/* Characters */}
        <div className="flex flex-col">
          <label className="text-lg font-semibold text-slate-200 mb-2 flex items-center justify-between">
            인물 (Characters)
            <button
              onClick={() => addRandomSelection(CHARACTER_OPTIONS, selectedCharacters, setSelectedCharacters)}
              className="flex items-center gap-1 text-slate-400 hover:text-primary transition-colors duration-200 text-sm focus:outline-none"
              disabled={loading}
              aria-label="랜덤 인물 추가"
            >
              <i className="ri-lightbulb-line"></i>
              <span>아이디어가 없으신가요?</span>
            </button>
          </label>
          <div className="flex flex-wrap gap-2">
            {CHARACTER_OPTIONS.map(char => (
              <button
                key={char}
                onClick={() => toggleSelection(selectedCharacters, setSelectedCharacters, char)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 text-sm
                            ${selectedCharacters.includes(char)
                              ? 'bg-primary text-white shadow-md'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                            }
                            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:opacity-50`}
                disabled={loading}
              >
                {char}
              </button>
            ))}
          </div>
        </div>

        {/* Scenario */}
        <div className="flex flex-col">
          <label className="text-lg font-semibold text-slate-200 mb-2 flex items-center justify-between">
            상황 (Scenario)
            <button
              onClick={() => addRandomSelection(SCENARIO_OPTIONS, selectedScenarios, setSelectedScenarios)}
              className="flex items-center gap-1 text-slate-400 hover:text-primary transition-colors duration-200 text-sm focus:outline-none"
              disabled={loading}
              aria-label="랜덤 상황 추가"
            >
              <i className="ri-lightbulb-line"></i>
              <span>아이디어가 없으신가요?</span>
            </button>
          </label>
          <div className="flex flex-wrap gap-2">
            {SCENARIO_OPTIONS.map(scenario => (
              <button
                key={scenario}
                onClick={() => toggleSelection(selectedScenarios, setSelectedScenarios, scenario)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 text-sm
                            ${selectedScenarios.includes(scenario)
                              ? 'bg-primary text-white shadow-md'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                            }
                            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:opacity-50`}
                disabled={loading}
              >
                {scenario}
              </button>
            ))}
          </div>
        </div>

        {/* Camera Angle */}
        <div className="flex flex-col">
          <label className="text-lg font-semibold text-slate-200 mb-2 flex items-center justify-between">
            카메라 각도 (Camera Angle)
            <button
              onClick={() => addRandomSelection(CAMERA_ANGLE_OPTIONS, selectedCameraAngles, setSelectedCameraAngles)}
              className="flex items-center gap-1 text-slate-400 hover:text-primary transition-colors duration-200 text-sm focus:outline-none"
              disabled={loading}
              aria-label="랜덤 카메라 각도 추가"
            >
              <i className="ri-lightbulb-line"></i>
              <span>아이디어가 없으신가요?</span>
            </button>
          </label>
          <div className="flex flex-wrap gap-2">
            {CAMERA_ANGLE_OPTIONS.map(angle => (
              <button
                key={angle}
                onClick={() => toggleSelection(selectedCameraAngles, setSelectedCameraAngles, angle)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 text-sm
                            ${selectedCameraAngles.includes(angle)
                              ? 'bg-primary text-white shadow-md'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                            }
                            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:opacity-50`}
                disabled={loading}
              >
                {angle}
              </button>
            ))}
          </div>
        </div>

        {/* Style/Filter */}
        <div className="flex flex-col">
          <label className="text-lg font-semibold text-slate-200 mb-2 flex items-center justify-between">
            필터/스타일 (Filter/Style)
            <button
              onClick={() => addRandomSelection(STYLE_OPTIONS, selectedStyles, setSelectedStyles)}
              className="flex items-center gap-1 text-slate-400 hover:text-primary transition-colors duration-200 text-sm focus:outline-none"
              disabled={loading}
              aria-label="랜덤 스타일 추가"
            >
              <i className="ri-lightbulb-line"></i>
              <span>아이디어가 없으신가요?</span>
            </button>
          </label>
          <div className="flex flex-wrap gap-2">
            {STYLE_OPTIONS.map(style => (
              <button
                key={style}
                onClick={() => toggleSelection(selectedStyles, setSelectedStyles, style)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 text-sm
                            ${selectedStyles.includes(style)
                              ? 'bg-primary text-white shadow-md'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                            }
                            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:opacity-50`}
                disabled={loading}
              >
                {style}
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
            Reset
          </button>
          <button
            onClick={handleGeneratePrompt}
            className="bg-secondary hover:bg-emerald-600 text-white font-bold py-3 px-8 rounded-lg text-xl transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={isGenerateDisabled}
          >
            <i className="ri-flashlight-fill"></i>
            <span>{loading ? '생성 중...' : `Generate`}</span>
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
          <h3 className="text-2xl font-bold text-slate-200">Output</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setOutputDisplayMode('preview')}
              className={`px-4 py-1 text-sm font-medium rounded-md transition-colors duration-200
                          ${outputDisplayMode === 'preview' ? 'bg-primary text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'}
                          ${!isOutputReady ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!isOutputReady}
            >
              Preview
            </button>
            <button
              onClick={() => setOutputDisplayMode('json')}
              className={`px-4 py-1 text-sm font-medium rounded-md transition-colors duration-200
                          ${outputDisplayMode === 'json' ? 'bg-primary text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'}
                          ${!isOutputReady ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!isOutputReady}
            >
              JSON
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-64 bg-slate-700 rounded-lg">
            <LoadingSpinner message={PROMPT_GEN_LOADING_MESSAGES[currentLoadingMessageIndex]} className="text-primary" />
          </div>
        )}

        {isOutputReady && outputDisplayMode === 'preview' && (
          <div className="mt-4 p-4 bg-slate-700 rounded-lg border border-slate-600 text-slate-50 text-md space-y-3 whitespace-pre-wrap custom-scrollbar max-h-[600px] overflow-y-auto">
            <h3 className="text-xl font-bold text-primary-dark mb-2">제안된 상세 프롬프트</h3>
            <p><strong>제목:</strong> {generatedPrompt.title}</p>
            {generatedPrompt.genre && <p><strong>장르:</strong> {generatedPrompt.genre}</p>}
            {generatedPrompt.characters && generatedPrompt.characters.length > 0 && (
              <div>
                <p className="font-semibold">인물:</p>
                <ul className="list-disc list-inside ml-4">
                  {generatedPrompt.characters.map((char, index) => (
                    <li key={index}>
                      <strong>{char.name}:</strong> {char.description} {char.costume && `(${char.costume})`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p><strong>상황:</strong> {generatedPrompt.scenario}</p>
            <p><strong>배경:</strong> {generatedPrompt.background}</p>
            {generatedPrompt.camera_angle && <p><strong>카메라 각도:</strong> {generatedPrompt.camera_angle}</p>}
            {generatedPrompt.style && <p><strong>스타일:</strong> {generatedPrompt.style}</p>}
            {generatedPrompt.dialogue_snippets && generatedPrompt.dialogue_snippets.length > 0 && (
              <div>
                <p className="font-semibold">대사:</p>
                <ul className="list-disc list-inside ml-4">
                  {generatedPrompt.dialogue_snippets.map((dialogue, index) => <li key={index}>"{dialogue}"</li>)}
                </ul>
              </div>
            )}
            {generatedPrompt.music_mood && <p><strong>음악 분위기:</strong> {generatedPrompt.music_mood}</p>}
            {generatedPrompt.sound_effects && generatedPrompt.sound_effects.length > 0 && (
              <div>
                <p className="font-semibold">효과음:</p>
                <ul className="list-disc list-inside ml-4">
                  {generatedPrompt.sound_effects.map((fx, index) => <li key={index}>{fx}</li>)}
                </ul>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-slate-600">
              <p className="text-lg font-bold text-primary-dark mb-2">최종 텍스트 프롬프트:</p>
              <textarea
                readOnly
                value={generatedPrompt.full_text_prompt}
                className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md text-slate-50 text-md resize-none custom-scrollbar"
                rows={Math.max(5, generatedPrompt.full_text_prompt.split('\n').length)}
                aria-label="생성된 최종 텍스트 프롬프트"
              ></textarea>
              <button
                onClick={() => navigator.clipboard.writeText(generatedPrompt.full_text_prompt)}
                className="mt-3 bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-lg text-md transition-colors duration-200 flex items-center gap-2"
              >
                <i className="ri-clipboard-line"></i>
                프롬프트 복사
              </button>
            </div>
          </div>
        )}

        {isOutputReady && outputDisplayMode === 'json' && (
          <div className="mt-4 p-4 bg-slate-700 rounded-lg border border-slate-600 text-slate-50 text-md space-y-3 custom-scrollbar max-h-[600px] overflow-y-auto">
            <h3 className="text-xl font-bold text-primary-dark mb-2">JSON 형식 프롬프트</h3>
            <textarea
              readOnly
              value={JSON.stringify(generatedPrompt, null, 2)}
              className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md text-slate-50 text-sm resize-none custom-scrollbar font-mono"
              rows={20} // Adjust rows as needed, or make it dynamic
              aria-label="생성된 JSON 프롬프트"
            ></textarea>
            <button
              onClick={() => navigator.clipboard.writeText(JSON.stringify(generatedPrompt, null, 2))}
              className="mt-3 bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-lg text-md transition-colors duration-200 flex items-center gap-2"
            >
              <i className="ri-clipboard-line"></i>
              JSON 복사
            </button>
          </div>
        )}

        {!isOutputReady && !error && (
          <div className="flex items-center justify-center h-64 bg-slate-700 rounded-lg text-slate-400 text-xl">
            상세 프롬프트를 생성해주세요.
          </div>
        )}
      </div>
    </div>
  );
};

export default PromptGenerator;