export async function onRequest(context) {
  try {
    const TELEGRAPH_URL = 'https://generativelanguage.googleapis.com';
    const request = context.request;
    const url = new URL(request.url);
    
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

    // 检查是否是 SSE 流
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      const reader = response.body.getReader();
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      let previousChunk = '';  // 存储倒数第二个块
      let lastChunk = '';     // 存储最后一个块
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const {done, value} = await reader.read();
              
              if (done) {
                // 在流结束时检查最后一个块是否和倒数第二个块重复
                const lastContent = extractContent(lastChunk);
                const prevContent = extractContent(previousChunk);
                
                // 只有当内容长度超过3且完全重复时才跳过最后一个块
                if (lastContent.length > 3 && lastContent === prevContent) {
                  // 不发送最后一个块
                } else {
                  // 发送最后一个块
                  controller.enqueue(encoder.encode(lastChunk));
                }
                controller.close();
                break;
              }

              const chunk = decoder.decode(value);
              // 更新块记录
              previousChunk = lastChunk;
              lastChunk = chunk;
              // 立即发送当前块
              controller.enqueue(value);
            }
          } catch (error) {
            controller.error(error);
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    // 非流式响应直接返回
    const modifiedResponse = new Response(response.body, response);
    modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
    modifiedResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    modifiedResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    
    return modifiedResponse;

  } catch (error) {
    console.error('Proxy error:', error);
    return new Response('An error occurred: ' + error.message, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/plain'
      }
    });
  }
}

// 辅助函数：从 SSE 消息中提取内容
function extractContent(chunk) {
  const lines = chunk.split('\n');
  let content = '';
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.slice(6));
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          content += data.candidates[0].content.parts[0].text;
        }
      } catch (e) {
        // 解析失败就跳过
        continue;
      }
    }
  }
  
  return content;
}

// 处理 OPTIONS 请求
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
