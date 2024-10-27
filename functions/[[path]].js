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

      let bufferedChunk = '';  // 当前缓存的块
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const {done, value} = await reader.read();
              
              if (done) {
                if (bufferedChunk) {
                  controller.enqueue(encoder.encode(bufferedChunk));
                }
                controller.close();
                break;
              }

              const currentChunk = decoder.decode(value);
              
              // 检查是否包含停止标志（[DONE]）
              if (currentChunk.includes('[DONE]')) {
                // 提取 [DONE] 之前的内容
                const [finalContent] = currentChunk.split('[DONE]');
                
                // 如果缓存的内容不为空，检查最后部分是否重复
                if (bufferedChunk) {
                  const prevContent = extractContent(bufferedChunk);
                  const finalContentText = extractContent(finalContent);
                  
                  // 如果最后内容长度大于3且完全包含在之前的内容中，则不发送最后部分
                  if (finalContentText.length > 3 && prevContent.endsWith(finalContentText)) {
                    controller.enqueue(encoder.encode(bufferedChunk));
                  } else {
                    // 发送缓存的内容和最终内容
                    controller.enqueue(encoder.encode(bufferedChunk + finalContent));
                  }
                } else {
                  controller.enqueue(encoder.encode(finalContent));
                }
                
                // 发送 [DONE] 标志
                controller.enqueue(encoder.encode('\ndata: [DONE]\n\n'));
                controller.close();
                break;
              } else {
                // 不是最后一块，发送缓存的内容，并将当前内容存入缓存
                if (bufferedChunk) {
                  controller.enqueue(encoder.encode(bufferedChunk));
                }
                bufferedChunk = currentChunk;
              }
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
