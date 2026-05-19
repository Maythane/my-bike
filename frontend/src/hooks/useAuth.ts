import { fetchLogin, fetchRegister } from "../api/auth";

const TOKEN_KEY = "moto_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function useAuth() {
  const isAuthenticated = !!getToken();

  async function login(email: string, password: string): Promise<void> {
    const { access_token } = await fetchLogin(email, password);
    setToken(access_token);
  }

  async function register(email: string, password: string): Promise<void> {
    const { access_token } = await fetchRegister(email, password);
    setToken(access_token);
  }

  function logout(): void {
    clearToken();
    window.location.href = "/login";
  }

  return { isAuthenticated, login, register, logout };
}
