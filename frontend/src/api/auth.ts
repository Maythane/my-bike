import client from "./client";

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserInfo {
  id: number;
  email: string | null;
  username: string | null;
  phone: string | null;
  phone_verified: boolean;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export async function fetchRegister(
  username: string,
  password: string,
  email?: string,
): Promise<TokenResponse> {
  const body: Record<string, string> = { username, password };
  if (email) body.email = email;
  const { data } = await client.post<TokenResponse>("/api/auth/register", body);
  return data;
}

export async function fetchLogin(identifier: string, password: string): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>("/api/auth/login", { identifier, password });
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

export async function sendOtp(phone: string): Promise<void> {
  await client.post("/api/auth/otp/send", { phone });
}

export async function otpLogin(phone: string, otp_code: string): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>("/api/auth/otp/login", { phone, otp_code });
  return data;
}

export async function fetchUpdateUsername(username: string): Promise<void> {
  await client.put("/api/auth/username", { username });
}

export async function fetchUpdateDisplayName(display_name: string): Promise<void> {
  await client.put("/api/auth/display-name", { display_name });
}

export async function fetchUploadAvatar(file: File): Promise<{ avatar_url: string }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await client.post<{ avatar_url: string }>("/api/auth/avatar", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function fetchDeleteAvatar(): Promise<void> {
  await client.delete("/api/auth/avatar");
}

export async function fetchRequestPhone(phone: string): Promise<void> {
  await client.post("/api/auth/phone/request", { phone });
}

export async function fetchConfirmPhone(phone: string, otp_code: string): Promise<void> {
  await client.post("/api/auth/phone/confirm", { phone, otp_code });
}
