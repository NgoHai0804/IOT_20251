import { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, User, Mail, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { authAPI } from '@/services/api';
import { toast } from 'sonner';
import { Logo } from './Logo';
import { Link } from 'react-router-dom';
import type { LoginProps } from '@/types';

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }
    
    if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự');
      return;
    }
    
    setLoading(true);
    try {
      const result = await authAPI.login(email, password);
      toast.success('Đăng nhập thành công!', { duration: 1000 });
      onLogin(result.user.full_name || result.user.email || email);
    } catch (err: any) {
      const errorMessage = err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin đăng nhập.';
      setError(errorMessage);
      toast.error(errorMessage, { duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute -bottom-40 right-1/3 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="bg-slate-800/90 border-slate-700/80 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-6 pb-8">
            {/* Logo */}
            <motion.div
              className="flex justify-center"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
            >
              <Logo size="lg" showText={true} />
            </motion.div>

            {/* Title and Description */}
            <motion.div
              className="text-center space-y-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <CardTitle className="text-white text-3xl font-bold">
                Chào mừng trở lại
              </CardTitle>
              <CardDescription className="text-slate-300/80 text-base">
                Đăng nhập để quản lý hệ thống nhà thông minh của bạn
              </CardDescription>
            </motion.div>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Input */}
              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <label htmlFor="email" className="text-slate-200 font-semibold text-sm flex items-center gap-2">
                  <Mail className="w-4 h-4 text-cyan-400" />
                  Email
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                    <User className="w-5 h-5 text-cyan-400/70" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 pl-11 bg-slate-900/60 border-slate-700/80 text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
              </motion.div>
              
              {/* Password Input */}
              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <label htmlFor="password" className="text-slate-200 font-semibold text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 text-cyan-400" />
                  Mật khẩu
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                    <Lock className="w-5 h-5 text-cyan-400/70" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Nhập mật khẩu của bạn"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pl-11 pr-11 bg-slate-900/60 border-slate-700/80 text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="text-slate-400 text-xs">
                  Mật khẩu phải có ít nhất 8 ký tự
                </p>
              </motion.div>
              
              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-lg p-3.5 flex items-start gap-3"
                >
                  <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-red-400 text-xs">!</span>
                  </div>
                  <p className="text-red-400 text-sm font-medium flex-1">
                    {error}
                  </p>
                </motion.div>
              )}
              
              {/* Submit Button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all duration-200 text-base"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <motion.div
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      />
                      Đang đăng nhập...
                    </span>
                  ) : (
                    'Đăng Nhập'
                  )}
                </Button>
              </motion.div>
            </form>

            {/* Footer Links */}
            <motion.div
              className="pt-4 border-t border-slate-700/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <p className="text-center text-slate-400 text-sm">
                Chưa có tài khoản?{' '}
                <Link
                  to="/"
                  className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors underline underline-offset-2"
                >
                  Đăng ký ngay
                </Link>
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
