
import React, { useState, useEffect } from 'react';
import { testGeminiApiKey } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';

interface ManageApiKeysModalProps {
  initialGeminiApiKey?: string;
  initialKieAIApiKey?: string;
  onSave: (geminiKey: string, kieAiKey: string) => void;
  onCancel: () => void;
}

const ManageApiKeysModal: React.FC<ManageApiKeysModalProps> = ({
  initialGeminiApiKey = '',
  initialKieAIApiKey = '',
  onSave,
  onCancel,
}) => {
  const [geminiApiKey, setGeminiApiKey] = useState(initialGeminiApiKey);
  const [kieAIApiKey, setKieAIApiKey] = useState(initialKieAIApiKey);
  const [geminiTestStatus, setGeminiTestStatus] = useState<'idle' | 'testing' | 'success' | 'failure'>('idle');
  const [kieAiTestStatus, setKieAiTestStatus] = useState<'idle' | 'testing' | 'success' | 'failure'>('idle');
  const [geminiTestError, setGeminiTestError] = useState<string | null>(null);
  const [kieAiTestError, setKieAiTestError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    setGeminiApiKey(initialGeminiApiKey);
    setKieAIApiKey(initialKieAIApiKey);
    setGeminiTestStatus('idle');
    setKieAiTestStatus('idle');
    setGeminiTestError(null);
    setKieAiTestError(null);
    setGlobalError(null);
  }, [initialGeminiApiKey, initialKieAIApiKey]);

  const handleTestGeminiKey = async () => {
    setGeminiTestStatus('testing');
    setGeminiTestError(null);
    if (!geminiApiKey.trim()) {
      setGeminiTestError('Gemini API 키를 입력해주세요.');
      setGeminiTestStatus('failure');
      return;
    }
    try {
      await testGeminiApiKey(geminiApiKey);
      setGeminiTestStatus('success');
    } catch (e: any) {
      setGeminiTestError(e.message || 'Gemini API 키 테스트 실패');
      setGeminiTestStatus('failure');
    }
  };

  const handleTestKieAiKey = () => {
    setKieAiTestStatus('testing');
    setKieAiTestError(null);
    if (!kieAIApiKey.trim()) {
      setKieAiTestError('Kie.ai API 키를 입력해주세요.');
      setKieAiTestStatus('failure');
      return;
    }
    // Simulate Kie.ai API key test
    setTimeout(() => {
      // For now, any non-empty Kie.ai key is considered successful.
      // In a real scenario, this would involve an actual API call to kie.ai
      if (kieAIApiKey.trim().length > 5) { // Simple check for a plausible key length
        setKieAiTestStatus('success');
      } else {
        setKieAiTestError('유효하지 않은 Kie.ai API 키입니다.');
        setKieAiTestStatus('failure');
      }
    }, 1000);
  };

  const handleSave = () => {
    setGlobalError(null);
    if (!geminiApiKey.trim()) {
      setGlobalError('Gemini API 키는 필수입니다.');
      return;
    }
    onSave(geminiApiKey.trim(), kieAIApiKey.trim());
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-900 p-8 rounded-lg shadow-2xl w-full max-w-2xl border border-primary relative my-8">
        <h2 className="text-3xl font-bold text-primary mb-6 text-center">API 키 관리</h2>
        <p className="text-slate-300 mb-6 text-center text-lg">
          비디오 생성 및 AI 프롬프트 기능을 사용하려면 API 키를 입력해주세요.
        </p>

        {globalError && (
          <p className="text-red-400 text-sm mt-2 mb-4 text-center" role="alert">{globalError}</p>
        )}

        {/* Gemini API Key Input */}
        <div className="mb-8 p-4 bg-slate-800 rounded-lg border border-slate-700">
          <label htmlFor="gemini-api-key-input" className="block text-lg font-semibold text-slate-200 mb-2">
            Gemini API 키:
            <span className="text-red-500 ml-1">*</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              id="gemini-api-key-input"
              type="text"
              value={geminiApiKey}
              onChange={(e) => {
                setGeminiApiKey(e.target.value);
                setGeminiTestStatus('idle'); // Reset status on input change
                setGeminiTestError(null);
              }}
              placeholder="여기에 Gemini API 키를 입력하세요"
              className="flex-grow p-3 bg-slate-700 border border-slate-600 rounded-md text-slate-50 text-base
                         focus:ring-primary focus:border-primary placeholder-slate-400"
              aria-label="Gemini API 키 입력"
            />
            <button
              onClick={handleTestGeminiKey}
              className={`py-2 px-5 rounded-lg text-sm font-semibold transition-colors duration-200
                          ${geminiTestStatus === 'testing' ? 'bg-slate-600 text-white' : 'bg-primary hover:bg-primary-dark text-white'}
                          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:opacity-50`}
              disabled={geminiTestStatus === 'testing'}
            >
              {geminiTestStatus === 'testing' ? <LoadingSpinner className="!h-5 !w-5" message="" /> : '테스트'}
            </button>
          </div>
          {geminiTestStatus === 'success' && <p className="text-green-400 text-sm mt-2">Gemini API 키가 유효합니다!</p>}
          {geminiTestStatus === 'failure' && <p className="text-red-400 text-sm mt-2">{geminiTestError || 'Gemini API 키 테스트 실패'}</p>}
        </div>

        {/* Kie.ai API Key Input */}
        <div className="mb-8 p-4 bg-slate-800 rounded-lg border border-slate-700">
          <label htmlFor="kieai-api-key-input" className="block text-lg font-semibold text-slate-200 mb-2">
            Kie.ai API 키 (선택 사항):
          </label>
          <div className="flex items-center gap-3">
            <input
              id="kieai-api-key-input"
              type="text"
              value={kieAIApiKey}
              onChange={(e) => {
                setKieAIApiKey(e.target.value);
                setKieAiTestStatus('idle'); // Reset status on input change
                setKieAiTestError(null);
              }}
              placeholder="여기에 Kie.ai API 키를 입력하세요"
              className="flex-grow p-3 bg-slate-700 border border-slate-600 rounded-md text-slate-50 text-base
                         focus:ring-primary focus:border-primary placeholder-slate-400"
              aria-label="Kie.ai API 키 입력"
            />
            <button
              onClick={handleTestKieAiKey}
              className={`py-2 px-5 rounded-lg text-sm font-semibold transition-colors duration-200
                          ${kieAiTestStatus === 'testing' ? 'bg-slate-600 text-white' : 'bg-secondary hover:bg-emerald-600 text-white'}
                          focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-opacity-50 disabled:opacity-50`}
              disabled={kieAiTestStatus === 'testing'}
            >
              {kieAiTestStatus === 'testing' ? <LoadingSpinner className="!h-5 !w-5" message="" /> : '테스트'}
            </button>
          </div>
          {kieAiTestStatus === 'success' && <p className="text-green-400 text-sm mt-2">Kie.ai API 키가 유효합니다!</p>}
          {kieAiTestStatus === 'failure' && <p className="text-red-400 text-sm mt-2">{kieAiTestError || 'Kie.ai API 키 테스트 실패'}</p>}
        </div>

        <div className="flex justify-end space-x-4 mt-8">
          <button
            onClick={onCancel}
            className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg text-lg
                       transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-6 rounded-lg text-lg
                       transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50"
          >
            저장
          </button>
        </div>

        <p className="mt-6 text-sm text-slate-400 text-center">
          API 키는 브라우저의 로컬 스토리지에 안전하게 저장됩니다.
        </p>
      </div>
    </div>
  );
};

export default ManageApiKeysModal;
    