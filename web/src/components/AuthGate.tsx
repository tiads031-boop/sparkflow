import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
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
import { defaultNavVisibility, navigationRegistry } from '../navigation';
import type { AuthMethod } from '../auth/credentials';

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

const navigationIconMap = {
  today: Home,
  tasks: CheckSquare,
  board: LayoutGrid,
  timeline: CalendarIcon,
  courses: BookOpen,
  sparks: Sparkles,
  settings: Home,
} as const;

const navigationOptions: Array<{
  value: ToggleableNavTab;
  label: string;
  icon: typeof Home;
}> = navigationRegistry
  .filter((item): item is typeof item & { id: ToggleableNavTab } => item.toggleable)
  .map((item) => ({ value: item.id, label: item.label, icon: navigationIconMap[item.icon] }));

export default function AuthGate({ children }: AuthGateProps) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const authReady = useAppStore((s) => s.authReady);
  const initializeAuth = useAppStore((s) => s.initializeAuth);
  const loginError = useAppStore((s) => s.loginError);
  const hasCompletedOnboarding = useAppStore((s) => s.hasCompletedOnboarding);
  const login = useAppStore((s) => s.login);
  const register = useAppStore((s) => s.register);
  const isRegistering = useAppStore((s) => s.isRegistering);
  const registrationError = useAppStore((s) => s.registrationError);
  const registrationPending = useAppStore((s) => s.registrationPending);
  const setRegistering = useAppStore((s) => s.setRegistering);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  useEffect(() => { void initializeAuth(); }, [initializeAuth]);

  // ── 登录表单状态 ──
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginMethod, setLoginMethod] = useState<AuthMethod>('nickname');

  // ── 注册表单状态 ──
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regLocalError, setRegLocalError] = useState('');
  const [registerMethod, setRegisterMethod] = useState<AuthMethod>('nickname');

  // ── 问候页状态（v2 多选数组） ──
  const [displayName, setDisplayName] = useState('Fish');
  const [professions, setProfessions] = useState<SparkFlowProfession[]>(['student']);
  const [statusNeeds, setStatusNeeds] = useState<SparkFlowStatusNeed[]>(['study-focus']);
  const [navigationNeeds, setNavigationNeeds] = useState<ToggleableNavTab[]>([
    ...navigationOptions.filter((item) => defaultNavVisibility[item.value]).map((item) => item.value),
  ]);

  const canComplete = useMemo(
    () => displayName.trim().length > 0 && navigationNeeds.length > 0,
    [displayName, navigationNeeds],
  );

  if (!authReady) {
    return <div className="min-h-svh bg-[#f4f4f6] flex items-center justify-center text-sm font-bold text-[#242424]">正在验证登录状态…</div>;
  }

  if (isAuthenticated && hasCompletedOnboarding) {
    return <>{children}</>;
  }

  // ── 登录 ──
  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const loggedIn = await login(username, password, loginMethod);
    if (loggedIn && loginMethod === 'nickname') setDisplayName(username.trim());
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

    const registered = await register(regUsername, regPassword, registerMethod);
    if (registered && registerMethod === 'nickname') setDisplayName(regUsername.trim());
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
                <p className="text-xs text-gray-400 mt-1">昵称注册无需邮箱；云端数据仍按账号安全隔离。</p>
              </div>

              <div className="mb-4 grid grid-cols-2 rounded-2xl bg-[#f4f4f6] p-1" aria-label="注册方式">
                {(['nickname', 'email'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    aria-pressed={registerMethod === method}
                    onClick={() => {
                      setRegisterMethod(method);
                      setRegUsername('');
                      setRegLocalError('');
                    }}
                    className={`rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                      registerMethod === method ? 'bg-white text-[#242424] shadow-sm' : 'text-gray-400'
                    }`}
                  >
                    {method === 'nickname' ? '昵称注册' : '邮箱注册'}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-bold text-[#242424]">
                    {registerMethod === 'nickname' ? '昵称' : '邮箱'}
                  </span>
                  <input
                    value={regUsername}
                    onChange={(event) => setRegUsername(event.target.value)}
                    className="mt-1 w-full rounded-2xl bg-[#f4f4f6] px-4 py-3 text-sm text-[#242424] outline-none ring-2 ring-transparent focus:ring-[#cae393]"
                    autoComplete={registerMethod === 'nickname' ? 'username' : 'email'}
                    inputMode={registerMethod === 'email' ? 'email' : 'text'}
                    placeholder={registerMethod === 'nickname' ? '2–24 个字符' : 'name@example.com'}
                    required
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
                    minLength={6}
                    required
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
                    minLength={6}
                    required
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
                disabled={registrationPending}
                aria-busy={registrationPending}
                className="mt-5 w-full rounded-full bg-[#242424] text-[#cae393] py-3 text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-wait"
              >
                <UserPlus size={16} />
                {registrationPending ? '正在注册…' : '注册'}
              </button>

              <button
                type="button"
                disabled={registrationPending}
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

              <div className="mb-4 grid grid-cols-2 rounded-2xl bg-[#f4f4f6] p-1" aria-label="登录方式">
                {(['nickname', 'email'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    aria-pressed={loginMethod === method}
                    onClick={() => {
                      setLoginMethod(method);
                      setUsername('');
                    }}
                    className={`rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                      loginMethod === method ? 'bg-white text-[#242424] shadow-sm' : 'text-gray-400'
                    }`}
                  >
                    {method === 'nickname' ? '昵称登录' : '邮箱登录'}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-bold text-[#242424]">
                    {loginMethod === 'nickname' ? '昵称' : '邮箱'}
                  </span>
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="mt-1 w-full rounded-2xl bg-[#f4f4f6] px-4 py-3 text-sm text-[#242424] outline-none ring-2 ring-transparent focus:ring-[#cae393]"
                    autoComplete={loginMethod === 'nickname' ? 'username' : 'email'}
                    inputMode={loginMethod === 'email' ? 'email' : 'text'}
                    placeholder={loginMethod === 'nickname' ? '输入昵称' : 'name@example.com'}
                    required
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
                    required
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
