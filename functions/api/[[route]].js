// functions/api/[[route]].js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // 允许跨域访问
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // 处理 OPTIONS 请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  
  // Health check endpoint
  if (url.pathname === '/api/health') {
    return new Response(JSON.stringify({ status: 'OK' }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }

  try {
    const TELEGRAPH_URL = 'https://generativelanguage.googleapis.com/v1beta';
    
    // Process path similar to original
    const path = url.pathname.replace('/api/', '');
    const processedPath = path.startsWith('v1beta/') ? `/${path}` : `/v1beta/${path}`;
    
    // Construct target URL
    const targetURL = new URL(TELEGRAPH_URL.replace(/\/v1beta$/, '') + processedPath);
    
    // Handle API keys
    const apiKey = url.searchParams.get('key');
    if (apiKey) {
      const keys = apiKey.split(';').filter(Boolean);
      if (keys.length > 0) {
        const selectedKey = keys[Math.floor(Math.random() * keys.length)];
        targetURL.searchParams.set('key', selectedKey);
      }
    }
    
    // Copy other query parameters
    for (const [key, value] of url.searchParams.entries()) {
      if (key !== 'key') {
        targetURL.searchParams.set(key, value);
      }
    }

    // Prepare fetch options
    const fetchOptions = {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    // Handle request body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      fetchOptions.body = await request.text();
    }

    // Make the request
    const response = await fetch(targetURL.toString(), fetchOptions);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${error}`);
    }

    // Handle SSE
    const isSSE = url.searchParams.get('alt') === 'sse';
    if (isSSE) {
      return new Response(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...corsHeaders
        }
      });
    }

    // Regular JSON response
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: error.message }), 
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
}