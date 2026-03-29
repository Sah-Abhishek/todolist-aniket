import config from './config.js';

export async function chat(messages) {
  const url = `${config.ollama.baseUrl}/api/chat`;

  console.log(`[ollama] Calling model ${config.ollama.model} with ${messages.length} messages`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ollama.timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollama.model,
        messages,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 404) {
        throw new Error(
          `Model "${config.ollama.model}" not found. Pull it first: ollama pull ${config.ollama.model}`
        );
      }
      throw new Error(`Ollama returned ${res.status}: ${body}`);
    }

    const data = await res.json();
    const content = data.message?.content;

    if (!content) {
      throw new Error('Ollama returned an empty response');
    }

    console.log(`[ollama] Got response (${content.length} chars)`);
    return content;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Ollama request timed out after ${config.ollama.timeoutMs / 1000}s`);
    }
    if (err.cause?.code === 'ECONNREFUSED') {
      throw new Error('Cannot connect to Ollama. Is it running? Start with: ollama serve');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
