export const API = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:8090';
// Retry utility for HTTP requests
export async function retryFetch(url: string, options: RequestInit = {}, maxRetries = 30, retryDelay = 2000): Promise<Response> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[MCP] Attempting to fetch ${url} (attempt ${attempt}/${maxRetries})...`);
            const response = await fetch(url, {
                ...options,
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            if (response.ok) {
                console.log(`[MCP] Successfully fetched ${url}`);
                return response;
            }
            console.log(`[MCP] Fetch failed with status ${response.status} (attempt ${attempt}/${maxRetries})`);
        }
        catch (error) {
            console.log(`[MCP] Fetch error (attempt ${attempt}/${maxRetries}): ${String(error)}`);
        }
        if (attempt === maxRetries) {
            throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
    throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
}
