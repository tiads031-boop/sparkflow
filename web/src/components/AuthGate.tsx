import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  BookOpen,
  Briefcase,
  Check,
  CheckSquare,
  FlaskConical,
  Home,
  LayoutGrid,
  LogIn,
  PenLine,
  Sparkles,
  User,
  UserPlus,
  ArrowLeft,
  Zap,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type {
  SparkFlowProfession,
  SparkFlowProfile,
  SparkFlowStatusNeed,
} from '../store/appStore';
import type { ToggleableNavTab } from '../types';

interface AuthGateProps {
  children: ReactNode;
}

const professionOptions: Array<{
  value: SparkFlowProfession;
  label: string;
  icon: typeof User;
}> = [
  { value: 'student', label: '学生', icon: BookOpen },
  { value: 'work', label: '工作 / 实习', icon: Briefcase },
  { value: 'developer', label: '开发', icon: Zap },
  { value: 'research', label: '科研', icon: FlaskConical },
  { value: 'creator', label: '创作', icon: PenLine },
  { value: 'other', label: '其他', icon: User },
];

const statusOptions: Array<{
  value: SparkFlowStatusNeed;
  label: string;
}> = [
  { value: 'study-focus', label: '学习专注' },
  { value: 'internship-work', label: '工作推进' },
  { value: 'dev-research', label: '开发 / 科研' },
  { value: 'project-shipping', label: '项目交付' },
  { value: 'life-balance', label: '生活平衡' },
];

const navigationOptions: Array<{
  value: ToggleableNavTab;
  label: string;
  icon: typeof Home;
}> = [
  { value: 'dashboard', label: '仪表盘', icon: Home },
  { value: 'tasks', label: '任务', icon: CheckSquare },
  { value: 'board', label: '看板', icon: LayoutGrid },
  { value: 'calendar', label: '日历', icon: CalendarIcon },
  { value: 'courses', label: '课程', icon: BookOpen },
  { value: 'sparks', label: '灵感', icon: Sparkles },
];

export default function AuthGate({ children }: AuthGateProps) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const loginError = useAppStore((s) => s.loginError);
  const hasCompletedOnboarding = useAppStore((s) => s.hasCompletedOnboarding);
  const login = useAppStore((s) => s.login);
  const register = useAppStore((s) => s.register);
  const isRegistering = useAppStore((s) => s.isRegistering);
  const registrationError = useAppStore((s) => s.registrationError);
  const setRegistering = useAppStore((s) => s.setRegistering);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  // ── 登录表单状态 ──
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // ── 注册表单状态 ──
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regLocalError, setRegLocalError] = useState('');

  // ── 问候页状态（v2 多选数组） ──
  const [displayName, setDisplayName] = useState('Fish');
  const [professions, setProfessions] = useState<SparkFlowProfession[]>(['student']);
  const [statusNeeds, setStatusNeeds] = useState<SparkFlowStatusNeed[]>(['study-focus']);
  const [navigationNeeds, setNavigationNeeds] = useState<ToggleableNavTab[]>([
    'dashboard',
    'tasks',
    'calendar',
    'courses',
    'sparks',
  ]);

  const canComplete = useMemo(
    () => displayName.trim().length > 0 && navigationNeeds.length > 0,
    [displayName, navigationNeeds],
  );

  if (isAuthenticated && hasCompletedOnboarding) {
    return <>{children}</>;
  }

  // ── 登录 ──
  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await login(username, password);
  };

  // ── 注册 ──
  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // 本地校验：两次密码一致
    if (regPassword !== regConfirmPassword) {
      setRegLocalError('两次密码不一致');
      return;
    }
    setRegLocalError('');

    await register(regUsername, regPassword);
  };

  // ── 导航 toggle ──
  const handleNavigationToggle = (tab: ToggleableNavTab) => {
    setNavigationNeeds((current) =>
      current.includes(tab)
        ? current.filter((item) => item !== tab)
        : [...current, tab],
    );
  };

  // ── 职业多选 toggle ──
  const handleProfessionToggle = (value: SparkFlowProfession) => {
    setProfessions((current) => {
      if (current.includes(value)) {
        // 至少保留 1 个
        if (current.length <= 1) return current;
        return current.filter((v) => v !== value);
      }
      return [...current, value];
    });
  };

  // ── 状态需求多选 toggle ──
  const handleStatusToggle = (value: SparkFlowStatusNeed) => {
    setStatusNeeds((current) => {
      if (current.includes(value)) {
        if (current.length <= 1) return current;
        return current.filter((v) => v !== value);
      }
      return [...current, value];
    });
  };

  // ── 完成问候 ──
  const handleCompleteOnboarding = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canComplete) return;

    const profile: SparkFlowProfile = {
      displayName: displayName.trim(),
      professions,
      statusNeeds,
      navigationNeeds,
    };

    completeOnboarding(profile);
  };

  // ── 错误消息合并（注册：优先本地错误，其次 store 错误） ──
  const registerErrorDisplay = regLocalError || registrationError;

  return (
    <div className="min-h-svh bg-[#f4f4f6] px-5 py-8 flex items-center justify-center font-sans">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <div className="text-2xl font-black tracking-tighter text-[#242424] italic select-none">
            SparkFlow<span className="text-[#cae393]">.</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#242424] text-[#cae393] flex items-center justify-center shadow-sm">
            <Sparkles size={18} />
          </div>
        </div>

        {!isAuthenticated ? (
          isRegistering ? (
            /* ═══════ 注册表单 ═══════ */
            <form onSubmit={handleRegister} className="bg-white rounded-[2rem] p-5 shadow-sm">
              <div className="mb-5">
                <h1 className="text-xl font-black text-[#242424]">创建账号</h1>
                <p className="text-xs text-gray-400 mt-1">注册后数据仅保存在你的设备上。</p>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-bold text-[#242424]">账号</span>
                  <input
                    value={regUsername}
                    onChange={(event) => setRegUsername(event.target.value)}
                    className="mt-1 w-full rounded-2xl bg-[#f4f4f6] px-4 py-3 text-sm text-[#242424] outline-none ring-2 ring-transparent focus:ring-[#cae393]"
                    autoComplete="username"
                    placeholder="2-20 个字符，字母/数字/下划线"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-[#242424]">密码</span>
                  <input
                    value={regPassword}
                    onChange={(event) => setRegPassword(event.target.value)}
                    className="mt-1 w-full rounded-2xl bg-[#f4f4f6] px-4 py-3 text-sm text-[#242424] outline-none ring-2 ring-transparent focus:ring-[#cae393]"
                    autoComplete="new-password"
                    placeholder="至少 6 个字符"
                    type="password"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-[#242424]">确认密码</span>
                  <input
                    value={regConfirmPassword}
                    onChange={(event) => setRegConfirmPassword(event.target.value)}
                    className="mt-1 w-full rounded-2xl bg-[#f4f4f6] px-4 py-3 text-sm text-[#242424] outline-none ring-2 ring-transparent focus:ring-[#cae393]"
                    autoComplete="new-password"
                    placeholder="再次输入密码"
                    type="password"
                  />
                </label>
              </div>

              {registerErrorDisplay && (
                <div className="mt-4 rounded-2xl bg-[#b0a8db]/20 px-4 py-3 text-xs font-medium text-[#242424]">
                  {registerErrorDisplay}
                </div>
              )}

              <button
                type="submit"
                className="mt-5 w-full rounded-full bg-[#242424] text-[#cae393] py-3 text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <UserPlus size={16} />
                注册
              </button>

              <button
                type="button"
                onClick={() => {
                  setRegistering(false);
                  setRegLocalError('');
                  setRegPassword('');
                  setRegConfirmPassword('');
                }}
                className="mt-3 w-full rounded-full bg-[#f4f4f6] text-[#242424] py-3 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
              >
                <ArrowLeft size={14} />
                返回登录
              </button>
            </form>
          ) : (
            /* ═══════ 登录表单 ═══════ */
            <form onSubmit={handleLogin} className="bg-white rounded-[2rem] p-5 shadow-sm">
              <div className="mb-5">
                <h1 className="text-xl font-black text-[#242424]">欢迎回来</h1>
                <p className="text-xs text-gray-400 mt-1">登录后继续整理今天的节奏。</p>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-bold text-[#242424]">账号</span>
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="mt-1 w-full rounded-2xl bg-[#f4f4f6] px-4 py-3 text-sm text-[#242424] outline-none ring-2 ring-transparent focus:ring-[#cae393]"
                    autoComplete="username"
                    placeholder="fish031"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-[#242424]">密码</span>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-1 w-full rounded-2xl bg-[#f4f4f6] px-4 py-3 text-sm text-[#242424] outline-none ring-2 ring-transparent focus:ring-[#cae393]"
                    autoComplete="current-password"
                    type="password"
                  />
                </label>
              </div>

              {loginError && (
                <div className="mt-4 rounded-2xl bg-[#b0a8db]/20 px-4 py-3 text-xs font-medium text-[#242424]">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                className="mt-5 w-full rounded-full bg-[#242424] text-[#cae393] py-3 text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <LogIn size={16} />
                登录
              </button>

              <button
                type="button"
                onClick={() => setRegistering(true)}
                className="mt-3 w-full text-xs font-bold text-gray-400 hover:text-[#242424] transition-colors"
              >
                注册新账号
              </button>
            </form>
          )
        ) : (
          /* ═══════ 问候页（v2 多选） ═══════ */
          <form onSubmit={handleCompleteOnboarding} className="bg-white rounded-[2rem] p-5 shadow-sm">
            <div className="mb-5">
              <h1 className="text-xl font-black text-[#242424]">先把 SparkFlow 调成你的节奏</h1>
              <p className="text-xs text-gray-400 mt-1">选择最常用的身份、状态和入口。</p>
            </div>

            <label className="block mb-4">
              <span className="text-xs font-bold text-[#242424]">怎么称呼你</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="mt-1 w-full rounded-2xl bg-[#f4f4f6] px-4 py-3 text-sm text-[#242424] outline-none ring-2 ring-transparent focus:ring-[#cae393]"
                placeholder="Fish"
              />
            </label>

            <div className="mb-4">
              <div className="text-xs font-bold text-[#242424] mb-2">职业 / 身份</div>
              <div className="grid grid-cols-2 gap-2">
                {professionOptions.map((option) => {
                  const Icon = option.icon;
                  const active = professions.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleProfessionToggle(option.value)}
                      className={`rounded-2xl px-3 py-3 text-left text-sm font-bold flex items-center gap-2 transition-colors ${
                        active ? 'bg-[#cae393] text-[#242424]' : 'bg-[#f4f4f6] text-gray-500'
                      }`}
                    >
                      <span className="w-7 h-7 rounded-full bg-white/80 flex items-center justify-center">
                        <Icon size={14} />
                      </span>
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <div className="text-xs font-bold text-[#242424] mb-2">现在最需要的状态</div>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((option) => {
                  const active = statusNeeds.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleStatusToggle(option.value)}
                      className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                        active ? 'bg-[#242424] text-[#cae393]' : 'bg-[#e5e2f3] text-[#242424]'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-5">
              <div className="text-xs font-bold text-[#242424] mb-2">底部导航需要哪些页</div>
              <div className="grid grid-cols-3 gap-2">
                {navigationOptions.map((option) => {
                  const Icon = option.icon;
                  const active = navigationNeeds.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleNavigationToggle(option.value)}
                      className={`rounded-2xl px-2 py-3 text-xs font-bold flex flex-col items-center gap-1.5 transition-colors ${
                        active ? 'bg-[#b0a8db]/30 text-[#242424]' : 'bg-[#f4f4f6] text-gray-400'
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          active ? 'bg-[#242424] text-[#cae393]' : 'bg-white text-gray-400'
                        }`}
                      >
                        {active ? <Check size={14} /> : <Icon size={14} />}
                      </span>
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={!canComplete}
              className="w-full rounded-full bg-[#242424] text-[#cae393] py-3 text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              <Check size={16} />
              开始使用
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
