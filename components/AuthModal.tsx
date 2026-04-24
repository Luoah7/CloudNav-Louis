import React, { useState } from 'react';
import { Lock, ArrowRight, Loader2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onLogin: (password: string) => Promise<boolean>;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onLogin }) => {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    const success = await onLogin(password);
    if (!success) {
      setError('密码错误或无法连接服务器');
    }
    setIsLoading(false);
  };

  return (
    <div className="liquid-overlay fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="liquid-panel w-full max-w-sm overflow-hidden rounded-2xl p-7">
        <div className="flex flex-col items-center mb-6">
          <div className="liquid-section w-16 h-16 rounded-full flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400">
            <Lock size={32} />
          </div>
          <h2 className="text-xl font-bold dark:text-white">身份验证</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-2">
            请输入部署时设置的 PASSWORD 以同步数据
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="liquid-input w-full p-3 rounded-xl dark:text-white outline-none transition-all text-center tracking-widest"
              placeholder="访问密码"
              autoFocus
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <>解锁进入 <ArrowRight size={18} /></>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;
