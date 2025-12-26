import { useState } from 'react';
import { motion } from 'motion/react';
import { Home, Lock, User } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { authAPI } from '@/services/api';
import { toast } from 'sonner';
import type { LoginProps } from '@/types';

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    setLoading(true);
    try {
      const result = await authAPI.login(email, password);
      toast.success('Login successful!', { duration: 1000 });
      onLogin(result.user.full_name || result.user.email || email);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      toast.error(errorMessage, { duration: 1000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="w-full min-w-[24rem] bg-slate-800/80 border-slate-700/80 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-5">
            <motion.div
              className="flex justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <div className="w-20 h-20 bg-linear-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-cyan-500/30">
                <Home className="w-10 h-10 text-white" />
              </div>
            </motion.div>
            <div className="text-center">
              <CardTitle className="text-white text-2xl font-bold mb-2">Smart Home System</CardTitle>
              <CardDescription className="text-cyan-200/70 text-base">
                Đăng nhập để quản lý thiết bị của bạn
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="text-cyan-200/80 font-medium">
                  Email
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400/70" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Nhập email của bạn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 bg-slate-900/60 border-slate-700/80 text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-cyan-500/30"
                    disabled={loading}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="password" className="text-cyan-200/80 font-medium">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400/70" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Nhập mật khẩu của bạn"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 bg-slate-900/60 border-slate-700/80 text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-cyan-500/30"
                    disabled={loading}
                  />
                </div>
              </div>
              
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-400 text-sm font-medium bg-red-500/10 border border-red-500/30 rounded-lg p-3"
                >
                  {error}
                </motion.p>
              )}
              
              <Button
                type="submit"
                className="w-full bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold shadow-lg shadow-cyan-500/30 h-11"
                disabled={loading}
              >
                {loading ? 'Đang đăng nhập...' : 'Đăng Nhập'}
              </Button>
              
              <p className="text-center text-cyan-200/60 text-sm">
                Mật khẩu phải có ít nhất 8 ký tự
              </p>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
