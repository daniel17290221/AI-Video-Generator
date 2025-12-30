
import React, { useState, useEffect, useCallback } from 'react';
// import VideoGenerator from './components/VideoGenerator'; // Removed
import PromptGenerator from './components/PromptGenerator'; // New import
import DemoModelPlaceholder from './components/DemoModelPlaceholder';
import ManageApiKeysModal from './components/ManageApiKeysModal';
import SeedanceGenerator from './components/SeedanceGenerator';
import Wan26Generator from './components/Wan26Generator'; // Changed import
import Kling26Generator from './components/Kling26Generator'; // Changed import from Kling26TextToVideoGenerator
import GrokImagineGenerator from './components/GrokImagineGenerator'; // Changed import from GrokImagineImageToVideoGenerator
import Hailuo23Generator from './components/Hailuo23Generator'; // Renamed import from Hailuo23ImageToVideoProGenerator
import Sora2Generator from './components/Sora2Generator'; // Renamed import from Sora2ProTextToVideoGenerator
import Veo31Generator from './components/Veo31Generator'; // New import
import { VideoMode, AppFeature } from './types';

const GEMINI_API_KEY_STORAGE_KEY = 'gemini-api-key';
const KIE_AI_API_KEY_STORAGE_KEY = 'kie-ai-api-key';

const App: React.FC = () => {
  const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);
  const [kieAIApiKey, setKieAIApiKey] = useState<string | null>(null);
  const [showManageKeysModal, setShowManageKeysModal] = useState<boolean>(false);
  const [currentVideoMode, setCurrentVideoMode] = useState<VideoMode>('t2v'); // This state is now mostly unused by PromptGenerator, but kept for other video generators
  const [selectedFeature, setSelectedFeature] = useState<AppFeature>('prompt-gen'); // Changed 'video-gen' to 'prompt-gen'
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    const storedGeminiApiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
    const storedKieAIApiKey = localStorage.getItem(KIE_AI_API_KEY_STORAGE_KEY);

    if (storedGeminiApiKey) {
      setGeminiApiKey(storedGeminiApiKey);
    }
    if (storedKieAIApiKey) {
      setKieAIApiKey(storedKieAIApiKey);
    }

    // Only show the modal if Gemini API Key is missing, as it's critical for core features.
    if (!storedGeminiApiKey) {
      setShowManageKeysModal(true);
    }
  }, []);

  const handleSaveApiKeys = useCallback((newGeminiKey: string, newKieAiKey: string) => {
    localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, newGeminiKey);
    localStorage.setItem(KIE_AI_API_KEY_STORAGE_KEY, newKieAiKey);
    setGeminiApiKey(newGeminiKey);
    setKieAIApiKey(newKieAiKey);
    setShowManageKeysModal(false);
    setApiError(null);
  }, []);

  const handleCancelApiKeysInput = useCallback(() => {
    // If Gemini API key is still missing after cancel, show an error.
    if (!geminiApiKey) {
      setApiError("Gemini API 키가 없으면 비디오 생성 기능을 사용할 수 없습니다.");
    }
    setShowManageKeysModal(false);
  }, [geminiApiKey]);

  const handleTriggerApiKeysInput = useCallback(() => {
    setApiError(null);
    setShowManageKeysModal(true);
  }, []);

  if (!geminiApiKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full max-w-4xl mx-auto py-8">
        <div className="flex flex-col items-center justify-center p-8 bg-slate-800 rounded-lg shadow-xl text-center">
          <h2 className="text-2xl font-bold mb-4 text-primary">API 키 필요</h2>
          <p className="mb-6 text-slate-300">
            비디오 생성을 시작하려면 Gemini API 키를 입력해야 합니다.
          </p>
          {apiError && (
            <p className="text-red-400 mb-4">{apiError}</p>
          )}
          <button
            onClick={handleTriggerApiKeysInput}
            className="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50"
          >
            API 키 입력
          </button>
        </div>
        {showManageKeysModal && (
          <ManageApiKeysModal
            initialGeminiApiKey={localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || ''}
            initialKieAIApiKey={localStorage.getItem(KIE_AI_API_KEY_STORAGE_KEY) || ''}
            onSave={handleSaveApiKeys}
            onCancel={handleCancelApiKeysInput}
          />
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {showManageKeysModal && (
        <ManageApiKeysModal
          initialGeminiApiKey={geminiApiKey || ''}
          initialKieAIApiKey={kieAIApiKey || ''}
          onSave={handleSaveApiKeys}
          onCancel={handleCancelApiKeysInput}
        />
      )}

      {/* New: Title and API Key Management Button in the same row */}
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary leading-tight flex-grow text-center">
          AI 비디오 생성기
        </h1>
        <button
          onClick={handleTriggerApiKeysInput}
          className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-lg text-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 flex items-center gap-2 whitespace-nowrap"
        >
          <i className="ri-key-line"></i>
          API 키 관리
        </button>
      </div>

      {apiError && (
        <div className="p-4 bg-red-700 text-white rounded-md text-center mb-6 border border-red-500">
          <p className="font-semibold text-lg">오류 발생:</p>
          <p className="mt-1">{apiError}</p>
        </div>
      )}

      {/* New: Model/Feature Selection Tabs */}
      <div className="flex flex-wrap justify-center gap-4 mb-8 sticky top-[100px] bg-slate-950/80 backdrop-blur-md p-4 rounded-lg shadow-lg z-10 border border-slate-800">
        <button
          onClick={() => setSelectedFeature('prompt-gen')} // Changed to 'prompt-gen'
          className={`px-6 py-2 text-md font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                      ${selectedFeature === 'prompt-gen' // Changed to 'prompt-gen'
                        ? 'bg-primary text-white shadow-lg'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                      }
                      focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
        >
          AI 프롬프트 생성기 {/* Changed label */}
        </button>
        <button
          onClick={() => setSelectedFeature('seedance-1.5pro')}
          className={`px-6 py-2 text-md font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                      ${selectedFeature === 'seedance-1.5pro'
                        ? 'bg-primary text-white shadow-lg'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                      }
                      focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
        >
          Seedance 1.5 Pro
        </button>
        <button
          onClick={() => setSelectedFeature('wan-2.6')}
          className={`px-6 py-2 text-md font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                      ${selectedFeature === 'wan-2.6'
                        ? 'bg-primary text-white shadow-lg'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                      }
                      focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
        >
          Wan 2.6
        </button>
        <button
          onClick={() => setSelectedFeature('kling-2.6')}
          className={`px-6 py-2 text-md font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                      ${selectedFeature === 'kling-2.6'
                        ? 'bg-primary text-white shadow-lg'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                      }
                      focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
        >
          Kling 2.6
        </button>
        <button
          onClick={() => setSelectedFeature('grok-imagine')}
          className={`px-6 py-2 text-md font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                      ${selectedFeature === 'grok-imagine'
                        ? 'bg-primary text-white shadow-lg'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                      }
                      focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
        >
          Grok Imagine
        </button>
        <button
          onClick={() => setSelectedFeature('hailuo-2.3')}
          className={`px-6 py-2 text-md font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                      ${selectedFeature === 'hailuo-2.3'
                        ? 'bg-primary text-white shadow-lg'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                      }
                      focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
        >
          Hailuo 2.3
        </button>
        <button
          onClick={() => setSelectedFeature('sora-2')}
          className={`px-6 py-2 text-md font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                      ${selectedFeature === 'sora-2'
                        ? 'bg-primary text-white shadow-lg'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                      }
                      focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
        >
          Sora 2
        </button>
        <button
          onClick={() => setSelectedFeature('veo-3.1')}
          className={`px-6 py-2 text-md font-semibold rounded-full transition-all duration-300 whitespace-nowrap
                      ${selectedFeature === 'veo-3.1'
                        ? 'bg-primary text-white shadow-lg'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                      }
                      focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50`}
        >
          Veo 3.1
        </button>
      </div>

      {apiError && (
        <div className="p-4 bg-red-700 text-white rounded-md text-center mb-6 border border-red-500">
          <p className="font-semibold text-lg">오류 발생:</p>
          <p className="mt-1">{apiError}</p>
        </div>
      )}

      <div className="p-6 bg-slate-900 rounded-lg shadow-xl mb-6 border border-slate-700">
        {selectedFeature === 'prompt-gen' ? ( // Changed to 'prompt-gen'
          geminiApiKey ? (
            // No longer uses VideoMode for PromptGenerator
            <PromptGenerator geminiApiKey={geminiApiKey} />
          ) : (
            <p className="text-center text-red-400 text-xl font-bold">
              Gemini API 키가 없어 프롬프트 생성 기능을 사용할 수 없습니다.
            </p>
          )
        ) : selectedFeature === 'seedance-1.5pro' ? (
          kieAIApiKey ? (
            <SeedanceGenerator kieAIApiKey={kieAIApiKey} />
          ) : (
            <p className="text-center text-red-400 text-xl font-bold">
              Seedance 1.5 Pro 기능을 사용하려면 Kie.ai API 키가 필요합니다.
            </p>
          )
        ) : selectedFeature === 'wan-2.6' ? (
          kieAIApiKey ? (
            <Wan26Generator kieAIApiKey={kieAIApiKey} />
          ) : (
            <p className="text-center text-red-400 text-xl font-bold">
              Wan 2.6 기능을 사용하려면 Kie.ai API 키가 필요합니다.
            </p>
          )
        ) : selectedFeature === 'kling-2.6' ? (
          kieAIApiKey ? (
            <Kling26Generator kieAIApiKey={kieAIApiKey} />
          ) : (
            <p className="text-center text-red-400 text-xl font-bold">
              Kling 2.6 기능을 사용하려면 Kie.ai API 키가 필요합니다.
            </p>
          )
        ) : selectedFeature === 'grok-imagine' ? (
          kieAIApiKey ? (
            <GrokImagineGenerator kieAIApiKey={kieAIApiKey} />
          ) : (
            <p className="text-center text-red-400 text-xl font-bold">
              Grok Imagine 기능을 사용하려면 Kie.ai API 키가 필요합니다.
            </p>
          )
        ) : selectedFeature === 'hailuo-2.3' ? (
          kieAIApiKey ? (
            <Hailuo23Generator kieAIApiKey={kieAIApiKey} />
          ) : (
            <p className="text-center text-red-400 text-xl font-bold">
              Hailuo 2.3 기능을 사용하려면 Kie.ai API 키가 필요합니다.
            </p>
          )
        ) : selectedFeature === 'sora-2' ? (
          kieAIApiKey ? (
            <Sora2Generator kieAIApiKey={kieAIApiKey} />
          ) : (
            <p className="text-center text-red-400 text-xl font-bold">
              Sora 2 기능을 사용하려면 Kie.ai API 키가 필요합니다.
            </p>
          )
        ) : selectedFeature === 'veo-3.1' ? ( // Conditional render for Veo 3.1
          kieAIApiKey ? (
            <Veo31Generator kieAIApiKey={kieAIApiKey} />
          ) : (
            <p className="text-center text-red-400 text-xl font-bold">
              Veo 3.1 기능을 사용하려면 Kie.ai API 키가 필요합니다.
            </p>
          )
        ) : (
          <DemoModelPlaceholder modelName={'알 수 없는 모델'} />
        )}
      </div>
    </div>
  );
};

export default App;
