import * as http from 'node:http';
import type { AddressInfo } from 'node:net';

export type RpcError = {
  message: string;
  code?: string;
};

export type RpcRequest = {
  id: string;
  method: string;
  params?: unknown;
};

export type RpcResponse = {
  id: string;
  result?: unknown;
  error?: RpcError;
};

export type RpcHandlers = Record<string, (params: unknown) => Promise<unknown>>;

export type RpcServerOptions = {
  port: number;
  token?: string;
  handlers: RpcHandlers;
  log: (message: string) => void;
};

export type RpcServer = {
  port: number;
  dispose(): void;
};

export function startRpcServer(options: RpcServerOptions): RpcServer {
  const server = http.createServer();
  let queue = Promise.resolve();

  server.on('request', (req, res) => {
    queue = queue
      .then(async () => {
        await handleRequest(req, res, options);
      })
      .catch(async (error) => {
        options.log(`[rpc] handler error: ${String(error)}`);
        if (res.headersSent) return;
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ id: 'unknown', error: { message: 'internal error' } } satisfies RpcResponse));
      });
  });

  server.listen(options.port, '127.0.0.1');
  const address = server.address() as AddressInfo | null;
  const port = address?.port ?? options.port;
  options.log(`[rpc] listening on http://127.0.0.1:${port}/rpc`);

  return {
    port,
    dispose() {
      server.close();
    },
  };
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse, options: RpcServerOptions): Promise<void> {
  if (req.method === 'GET' && req.url === '/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method !== 'POST' || req.url !== '/rpc') {
    res.statusCode = 404;
    res.end();
    return;
  }

  if (options.token) {
    const token = req.headers['x-tutolang-token'];
    if (token !== options.token) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
      return;
    }
  }

  const raw = await readBody(req);
  let request: RpcRequest;
  try {
    request = JSON.parse(raw) as RpcRequest;
  } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ id: 'unknown', error: { message: 'invalid json' } } satisfies RpcResponse));
    return;
  }

  const handler = options.handlers[request.method];
  if (!handler) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ id: request.id, error: { message: `unknown method: ${request.method}` } } satisfies RpcResponse));
    return;
  }

  try {
    const result = await handler(request.params);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ id: request.id, result } satisfies RpcResponse));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ id: request.id, error: { message } } satisfies RpcResponse));
  }
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });
    req.on('error', reject);
  });
}

