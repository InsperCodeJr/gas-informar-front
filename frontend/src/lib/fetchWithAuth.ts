import { API_URL } from "../config";

// keys
const TOKEN_KEY = "token";
const USER_ID_KEY = "user_id";
const USER_ROLE_KEY = "user_role";
const USER_NAME_KEY = "user_name";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) { localStorage.setItem(TOKEN_KEY, token); }
export function clearTokenData() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(USER_ROLE_KEY);
  localStorage.removeItem(USER_NAME_KEY);
}

export function logout(redirect = true) {
  fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).finally(() => {
    clearTokenData();
    if (redirect) window.location.href = "/";
  });
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "include",
    });

    if (!res.ok) return false;

    const payload = await res.json().catch(() => null);
    const newToken = payload?.access_token;
    if (newToken) {
      setToken(newToken);
      if (payload.user) {
        localStorage.setItem(USER_ID_KEY, String(payload.user.id));
        localStorage.setItem(USER_ROLE_KEY, payload.user.role);
        localStorage.setItem(USER_NAME_KEY, payload.user.nome);
      }
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * fetchWithAuth
 * - não define Content-Type (nem sobrescreve) — isso permite enviar FormData sem problema
 * - aplica Authorization Bearer se houver token
 * - tenta refresh em 401 e re-executa a requisição
 */
export async function fetchWithAuth(input: RequestInfo, init: RequestInit = {}) {
  let token = getToken();

  // Detect if body is FormData so we don't accidentally force JSON-related headers
  const isFormDataBody = typeof (init as any).body !== "undefined" && (init as any).body instanceof FormData;

  // Build headers from provided init.headers (could be Headers | object)
  const headers = new Headers(init.headers || {});

  // Only set Accept JSON when not sending FormData. (Accept is harmless but some servers behave differently.)
  if (!isFormDataBody) {
    headers.set("Accept", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // prefer explicit credentials: include when using cookies for refresh
  const cred = init.credentials ?? "same-origin";

  let res = await fetch(input, { ...init, headers, credentials: cred });

  // 401 indica sessão expirada. 403 é falta de permissão e não deve deslogar o usuário.
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      // retry original request with new token
      const newToken = getToken();
      // rebuild headers for retry (must apply same FormData logic)
      const headers2 = new Headers(init.headers || {});
      if (!isFormDataBody) {
        headers2.set("Accept", "application/json");
      }
      if (newToken) headers2.set("Authorization", `Bearer ${newToken}`);

      res = await fetch(input, { ...init, headers: headers2, credentials: cred });
    } else {
      clearTokenData();
      window.location.href = "/";
      throw new Error("Não autorizado. Faça login novamente.");
    }
  }

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const payload = await res.json();
      msg = payload?.detail || payload?.message || msg;
    } catch (e) {
      // body não JSON ou vazio
    }
    const err = new Error(msg || `HTTP error ${res.status}`);
    (err as any).response = res;
    throw err;
  }

  return res;
}

/** helper que retorna JSON */
export async function fetchJsonWithAuth(input: RequestInfo, init: RequestInit = {}) {
  const res = await fetchWithAuth(input, init);
  // For responses with no body (204), calling res.json() would fail — guard
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    // se não for JSON, retornar texto (ou undefined)
    const text = await res.text();
    try { return text ? JSON.parse(text) : undefined; } catch { return text; }
  }
  return res.json();
}
