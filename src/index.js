const http = require("http");
const { patternToRegex, extractParamNames, getBody, qs, parseCookies, pathExists, provideFile } = require("./lib/parsers");
const { ResponseHelpers, ServerOptions } = require("./lib/extenders");
class GalaxiteServer {
  constructor(options = {}) {
    this.options = new ServerOptions(options);
    this.routes = new Set();
    this.middlewares = [];
  }

  route(endpoint) {
    return {
      get: (handler) => {
        this.#registerRoute("GET", endpoint, handler);
        return this.route(endpoint);
      },
      post: (handler) => {
        this.#registerRoute("POST", endpoint, handler);
        return this.route(endpoint);
      },
      put: (handler) => {
        this.#registerRoute("PUT", endpoint, handler);
        return this.route(endpoint);
      },
      delete: (handler) => {
        this.#registerRoute("DELETE", endpoint, handler);
        return this.route(endpoint);
      },
      head: (handler) => {
        this.#registerRoute("HEAD", endpoint, handler);
        return this.route(endpoint);
      },
      options: (handler) => {
        this.#registerRoute("OPTIONS", endpoint, handler);
        return this.route(endpoint);
      }
    };
  }

  #registerRoute(method, endpoint, handler) {
    if (endpoint.endsWith("/"))
      endpoint = endpoint.substring(0, endpoint.length - 1);
    let regex = patternToRegex(endpoint);
    let params = extractParamNames(endpoint);

    for (const r of this.routes) {
      if (method === r.method && String(regex) === String(r.regex)) {
        throw new Error(`Duplicate endpoint found: ${method} ${endpoint}`);
      }
    }

    this.routes.add({
      method,
      handler,
      regex,
      params,
    });
  }

  #parseRoute(req) {
    const method = req.method || "";
    const url = req.url || "";
    let [path, query] = url.split("?");
    if (path.endsWith("/")) path = path.substring(0, path.length - 1);
    req.route = { query: { ...qs.parse(query) }, path: path || '/' };
    let route;
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const match = r.regex.exec(path);
      if (!match) continue;
      route = r.handler;
      let params = {};
      let paramsLength = r.params.length;
      for (let i = 0; i < paramsLength; i++) {
        params[r.params[i]] = !!match[i + 1]
          ? decodeURIComponent(match[i + 1])
          : undefined;
      }
      req.route = { ...req.route, params };
      break;
    }
    return route;
  }

  use(middleware) {
    this.middlewares.push(middleware);
  }

  async #handleRequest(req, res) {
    let route = this.#parseRoute(req);
    if (this.staticDirectory) {
      return provideFile(`${this.staticDirectory}${req.route.path}`, res);
    }

    req.cookies = parseCookies(req);

    if (!route) {
      return res.status(404).send("404 Not Found");
    }

    if (!!req.method && ["POST", "PUT", "PATCH"].includes(req.method)) {
      const data = await getBody(req, this.options.uploadDir);
      req.body = data
    }

    let middlewareIndex = 0;
    const next = () => {
      if (middlewareIndex >= this.middlewares.length) {
        return route(req, res);
      }
      const middleware = this.middlewares[middlewareIndex];
      middlewareIndex++;
      middleware(req, res, next);
    };
    return next();
  }

  serveStatic(dir) {
    if (pathExists(dir)) this.staticDirectory = dir;
  }

  close(callback) {
    this.server.close((err) => callback(err));
  }

  listen(port, callback) {
    this.server = http.createServer(
      (req, res) => {
        req.query = {};
        Object.assign(res, ResponseHelpers);
        if (this.options.cors.enabled) {
          if (
            (this.options.cors.origin.includes("*") ||
              (!!req.headers.host &&
                this.options.cors.origin.includes(req.headers.host)))
          )
            res.setHeader(
              "Access-Control-Allow-Origin",
              `${req.headers.host}`
            );
          if (this.options.cors.methods.length)
            res.setHeader(
              "Access-Control-Allow-Methods",
              this.options.cors.methods.join(",  ")
            );
          res.setHeader(
            "Access-Control-Max-Age",
            `${this.options.cors.maxAge}`
          );
        }
        this.#handleRequest(req, res);
      }
    );
    this.server.listen(port, () => callback(port));
  }
}

module.exports = GalaxiteServer;