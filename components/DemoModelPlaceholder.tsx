
import React from 'react';
import LoadingSpinner from './LoadingSpinner';

interface DemoModelPlaceholderProps {
  modelName: string;
}

const DemoModelPlaceholder: React.FC<DemoModelPlaceholderProps> = ({ modelName }) => {
  return (
    <div className="p-8 bg-slate-800 rounded-lg shadow-xl border border-slate-700 flex flex-col items-center justify-center text-center space-y-6">
      <h3 className="text-3xl font-bold text-primary">
        {modelName}
      </h3>
      <p className="text-xl font-medium text-slate-300">
        이 모델은 현재 개발 중입니다. 곧 지원될 예정입니다.
      </p>
      <LoadingSpinner message="새로운 기능 준비 중..." className="text-primary" />
    </div>
  );
};

export default DemoModelPlaceholder;
