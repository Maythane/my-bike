import client from "./client";

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserInfo {
  id: number;
  email: string;
  created_at: string;
}

export async function fetchRegister(email: string, password: string): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>("/api/auth/register", { email, password });
  return data;
}

export async function fetchLogin(email: string, password: string): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>("/api/auth/login", { email, password });
  return data;
}

export async function fetchMe(): Promise<UserInfo> {
  const { data } = await client.get<UserInfo>("/api/auth/me");
  return data;
}

export async function fetchUpdateEmail(new_email: string): Promise<void> {
  await client.put("/api/auth/email", { new_email });
}

export async function fetchUpdatePassword(
  current_password: string,
  new_password: string,
): Promise<void> {
  await client.put("/api/auth/password", { current_password, new_password });
}
