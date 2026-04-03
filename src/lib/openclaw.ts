export const getOpenClawConfig = () => {
  return {
    workspacePath: process.env.WORKSPACE_PATH,
    binPath: process.env.OPENCLAW_BIN,
    token: process.env.OPENCLAW_GATEWAY_TOKEN,
    port: process.env.OPENCLAW_GATEWAY_PORT || "18789",
    baseUrl: `http://127.0.0.1:${process.env.OPENCLAW_GATEWAY_PORT || "18789"}`,
  };
};

export async function fetchFromOpenClaw(endpoint: string, options: RequestInit = {}) {
  const config = getOpenClawConfig();
  
  if (!config.token) {
    throw new Error("OPENCLAW_GATEWAY_TOKEN is missing in environment variables.");
  }

  const url = `${config.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${config.token}`,
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`OpenClaw API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
