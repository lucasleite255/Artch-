import React, { useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, LogIn, LogOut, Mail, RotateCcw } from 'lucide-react';
import { useCatalog } from '../context/CatalogContext';
import { ArtcheLogo } from './ArtcheLogo';

interface AdminLoginPageProps {
  redirectTo?: string;
  onNavigate: (path: string) => void;
}

function resolveSafeRedirect(redirectTo?: string): string {
  if (!redirectTo) return '/admin/';
  const trimmed = redirectTo.trim();
  if (/^\/(admin|painel)(\/|\?|$)/.test(trimmed) && !trimmed.startsWith('/admin/login')) {
    return trimmed;
  }
  return '/admin/';
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ redirectTo, onNavigate }) => {
  const {
    user,
    emailVerified,
    authReady,
    isAdmin,
    checkingAdmin,
    loginWithGoogle,
    loginWithEmail,
    resendVerificationEmail,
    refreshVerification,
    requestPasswordReset,
    logout,
  } = useCatalog();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authErrorMsg, setAuthErrorMsg] = useState<string | null>(null);
  const [authInfoMsg, setAuthInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    if (authReady && !checkingAdmin && isAdmin) {
      onNavigate(resolveSafeRedirect(redirectTo));
    }
  }, [authReady, checkingAdmin, isAdmin, redirectTo, onNavigate]);

  const translateAuthError = (err: unknown): string => {
    const code = (err as { code?: string } | null)?.code;
    switch (code) {
      case 'auth/operation-not-allowed':
        return 'O login por e-mail e senha ainda não está ativado no Firebase Console (Authentication → Sign-in method → E-mail/senha). Ative esse provedor no console ou entre com “Entrar com Google”.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'E-mail ou senha incorretos.';
      case 'auth/invalid-email':
        return 'Informe um endereço de e-mail válido.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas seguidas. Aguarde alguns instantes e tente novamente.';
      case 'auth/user-disabled':
        return 'Esta conta foi desativada no Firebase Authentication.';
      case 'auth/popup-closed-by-user':
        return 'A janela de login do Google foi fechada antes da conclusão.';
      case 'auth/network-request-failed':
        return 'Falha de conexão ao autenticar. Verifique sua internet e tente novamente.';
      default:
        return err instanceof Error ? err.message : 'Não foi possível concluir a autenticação.';
    }
  };

  const handleGoogleLogin = async () => {
    setAuthBusy(true);
    setAuthErrorMsg(null);
    setAuthInfoMsg(null);
    try {
      await loginWithGoogle();
    } catch (err) {
      setAuthErrorMsg(translateAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErrorMsg(null);
    setAuthInfoMsg(null);

    const trimmedEmail = loginEmail.trim();
    if (!trimmedEmail || !loginPassword) {
      setAuthErrorMsg('Informe o e-mail e a senha do administrador.');
      return;
    }

    setAuthBusy(true);
    try {
      await loginWithEmail(trimmedEmail, loginPassword);
      setLoginPassword('');
      setShowPassword(false);
    } catch (err) {
      setAuthErrorMsg(translateAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleResetPassword = async () => {
    setAuthErrorMsg(null);
    setAuthInfoMsg(null);
    const trimmedEmail = loginEmail.trim();
    if (!trimmedEmail) {
      setAuthErrorMsg('Digite seu e-mail acima para receber o link de redefinição de senha.');
      return;
    }
    setAuthBusy(true);
    try {
      await requestPasswordReset(trimmedEmail);
      setAuthInfoMsg(
        'Se o e-mail informado estiver cadastrado, um link de redefinição de senha foi enviado (verifique também a caixa de spam).'
      );
    } catch (err) {
      setAuthErrorMsg(translateAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleResendVerification = async () => {
    setAuthErrorMsg(null);
    setAuthInfoMsg(null);
    setAuthBusy(true);
    try {
      await resendVerificationEmail();
      setAuthInfoMsg(
        'E-mail de confirmação enviado. Clique no link recebido na sua caixa de entrada e depois em “Já confirmei o e-mail”.'
      );
    } catch (err) {
      setAuthErrorMsg(translateAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRefreshVerification = async () => {
    setAuthErrorMsg(null);
    setAuthInfoMsg(null);
    setAuthBusy(true);
    try {
      const verified = await refreshVerification();
      if (verified) {
        setAuthInfoMsg('E-mail confirmado com sucesso.');
      } else {
        setAuthErrorMsg(
          'O e-mail ainda consta como não verificado. Abra o link enviado para sua caixa de entrada e tente novamente.'
        );
      }
    } catch (err) {
      setAuthErrorMsg(translateAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    setAuthBusy(true);
    setAuthErrorMsg(null);
    setAuthInfoMsg(null);
    try {
      await logout();
      setLoginPassword('');
      setShowPassword(false);
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6F5] flex flex-col">
      <header className="border-b border-[#DCE2E5] bg-white">
        <div className="max-w-[1320px] mx-auto px-5 md:px-10 h-16 flex items-center justify-between gap-4">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            aria-label="Artchê — Página inicial"
            className="inline-flex items-center"
          >
            <ArtcheLogo variant="dark" className="h-7" />
          </a>

          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="inline-flex items-center gap-2 text-xs text-[#566773] hover:text-[#152F40] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar para a vitrine</span>
          </a>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-5 py-12 md:py-16">
        <div className="w-full max-w-[460px] bg-white border border-[#DCE2E5] p-7 sm:p-9 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-[#566773]">
              <Lock className="w-3.5 h-3.5 text-[#152F40]" />
              <span>Área restrita</span>
            </div>
            <h1 className="font-serif-display text-[32px] text-[#152F40] leading-[1.08]">
              Painel Administrativo
            </h1>
            <p className="text-xs text-[#566773] leading-relaxed">
              Faça login com uma conta autorizada para gerenciar produtos, estoque, categorias e
              banners.
            </p>
          </div>

          {!authReady || checkingAdmin ? (
            <div className="border border-[#DCE2E5] bg-[#F5F6F5] px-4 py-6 text-center text-xs text-[#566773]">
              Verificando sessão administrativa…
            </div>
          ) : !user ? (
            <div className="space-y-5">
              <form onSubmit={(e) => void handleEmailLogin(e)} className="space-y-4">
                <div>
                  <label
                    htmlFor="admin-login-email"
                    className="block text-[11px] uppercase tracking-[0.08em] text-[#566773] mb-1.5"
                  >
                    E-mail
                  </label>
                  <input
                    id="admin-login-email"
                    type="email"
                    autoComplete="username"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="Digite seu e-mail"
                    className="w-full border border-[#DCE2E5] bg-white px-3.5 py-2.5 min-h-[44px] text-xs text-[#152F40] focus:outline-none focus:border-[#152F40]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="admin-login-password"
                      className="block text-[11px] uppercase tracking-[0.08em] text-[#566773]"
                    >
                      Senha
                    </label>
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={() => void handleResetPassword()}
                      className="text-[11px] text-[#566773] underline underline-offset-4 hover:text-[#152F40] disabled:opacity-60"
                    >
                      Esqueci a senha
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="admin-login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Digite sua senha"
                      className="w-full border border-[#DCE2E5] bg-white pl-3.5 pr-11 py-2.5 min-h-[44px] text-xs text-[#152F40] focus:outline-none focus:border-[#152F40]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      aria-pressed={showPassword}
                      title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute inset-y-0 right-0 px-3 inline-flex items-center justify-center text-[#566773] hover:text-[#152F40] transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] bg-[#152F40] text-white text-xs font-medium hover:bg-[#2E5267] disabled:opacity-60 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  <span>{authBusy ? 'Entrando…' : 'Entrar com e-mail'}</span>
                </button>
              </form>

              <div className="flex items-center gap-3 text-[11px] text-[#566773]">
                <span className="h-px flex-1 bg-[#DCE2E5]" />
                <span>ou</span>
                <span className="h-px flex-1 bg-[#DCE2E5]" />
              </div>

              <button
                type="button"
                disabled={authBusy}
                onClick={() => void handleGoogleLogin()}
                className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 min-h-[44px] border border-[#152F40] bg-white text-[#152F40] text-xs font-medium hover:bg-[#152F40] hover:text-white disabled:opacity-60 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>{authBusy ? 'Conectando…' : 'Entrar com Google'}</span>
              </button>
            </div>
          ) : !emailVerified ? (
            <div className="space-y-4 border border-[#DCE2E5] bg-[#F5F6F5] p-5">
              <div>
                <h2 className="text-xs font-medium text-[#152F40]">
                  Confirmação de e-mail pendente
                </h2>
                <p className="text-xs text-[#566773] mt-1 leading-relaxed">
                  Confirme o link de verificação enviado para <strong>{user.email}</strong> antes
                  de acessar o painel, ou entre com o Google usando a conta autorizada.
                </p>
              </div>
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void handleResendVerification()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] bg-[#152F40] text-white text-xs font-medium hover:bg-[#2E5267] disabled:opacity-60 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Enviar e-mail de verificação</span>
                </button>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void handleRefreshVerification()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] border border-[#152F40] bg-white text-xs font-medium text-[#152F40] hover:bg-[#152F40] hover:text-white disabled:opacity-60 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Já confirmei o e-mail (atualizar)</span>
                </button>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={() => void handleGoogleLogin()}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[40px] border border-[#DCE2E5] bg-white text-xs text-[#152F40] hover:border-[#152F40] disabled:opacity-60 transition-colors"
                  >
                    <span>Google</span>
                  </button>
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={() => void handleLogout()}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[40px] border border-[#DCE2E5] bg-white text-xs text-[#566773] hover:text-[#152F40] transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sair</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 border border-[#DCE2E5] bg-[#F5F6F5] p-5">
              <div>
                <h2 className="text-xs font-medium text-[#152F40]">
                  Conta sem permissão administrativa
                </h2>
                <p className="text-xs text-[#566773] mt-1 leading-relaxed">
                  A conta conectada ({user.email}) não tem permissão para acessar o painel de
                  gestão. Entre com uma conta administradora autorizada.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void handleGoogleLogin()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] border border-[#152F40] bg-white text-xs font-medium text-[#152F40] hover:bg-[#152F40] hover:text-white disabled:opacity-60 transition-colors"
                >
                  <span>Trocar conta</span>
                </button>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void handleLogout()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] border border-[#DCE2E5] bg-white text-xs text-[#566773] hover:text-[#152F40] disabled:opacity-60 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair</span>
                </button>
              </div>
            </div>
          )}

          {authErrorMsg && (
            <p
              role="alert"
              className="text-xs text-[#8B2635] bg-[#F5F6F5] border border-[#8B2635]/40 px-4 py-3 leading-relaxed"
            >
              {authErrorMsg}
            </p>
          )}
          {authInfoMsg && (
            <p
              role="status"
              className="text-xs text-[#152F40] bg-[#D0E5F2]/40 border border-[#9CC1D9] px-4 py-3 leading-relaxed"
            >
              {authInfoMsg}
            </p>
          )}
        </div>
      </main>
    </div>
  );
};
