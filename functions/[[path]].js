export async function onRequest(context) {
  try {
    const TELEGRAPH_URL = 'https://generativelanguage.googleapis.com/v1beta';
    const request = context.request;
    const url = new URL(request.url);
    
    // 构建新的 URL，保持路径部分
    const newUrl = new URL(url.pathname + url.search, TELEGRAPH_URL);
    
    const providedApiKeys = url.searchParams.get('key');

    if (!providedApiKeys) {
      return new Response('API key is missing.', { status: 400 });
    }

    const apiKeyArray = providedApiKeys.split(';').map(key => key.trim()).filter(key => key !== '');

    if (apiKeyArray.length === 0) {
      return new Response('Valid API key is missing.', { status: 400 });
    }

    const selectedApiKey = apiKeyArray[Math.floor(Math.random() * apiKeyArray.length)];
    newUrl.searchParams.set('key', selectedApiKey);

    const modifiedRequest = new Request(newUrl.toString(), {
      headers: request.headers,
      method: request.method,
      body: request.body,
      redirect: 'follow'
    });

    const response = await fetch(modifiedRequest);

    if (!response.ok) {
      const errorBody = await response.text();
      return new Response(`API request failed: ${errorBody}`, { status: response.status });
    }

    const modifiedResponse = new Response(response.body, response);
    modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
    return modifiedResponse;

  } catch (error) {
    return new Response('An error occurred: ' + error.message, { status: 500 });
  }
}
