const { readFile } = require("fs");
const { IncomingMessage, Server, ServerResponse } = require("http");

const ResponseHelpers = {
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  send(text) {
    this.setHeader("Content-Type", "text/plain");
    this.end(text);
    return this;
  },
  html(html) {
    this.setHeader("Content-Type", "text/html");
    this.end(html);
    return this;
  },
  json(json) {
    this.setHeader("Content-Type", "application/json");
    this.end(JSON.stringify(json));
    return this;
  },
  csv(csv) {
    this.setHeader("Content-Type", "text/csv");
    this.end(csv);
    return this;
  },
  download(filepath, filename) {
    readFile(filepath, (err, data) => {
      if (err) throw err;
      this.setHeader('Content-Type', 'application/octet-stream');
      this.setHeader('Content-Disposition', `attachment; filename=${filename || filepath.split('/').reverse()[0]}`);
      this.write(data);
      this.end();
    });
  },
  setCookie(key, value, options = {}) {
    const cookie = [`${key}=${value}`];
    if (options.maxAge) cookie.push(`Max-Age=${options.maxAge}`);
    if (options.domain) cookie.push(`Domain=${options.domain}`);
    if (options.path) cookie.push(`Path=${options.path}`);
    if (options.secure) cookie.push(`Secure`);
    if (options.httpOnly) cookie.push(`HttpOnly`);
    this.setHeader('Set-Cookie', cookie.join('; '));
  },
  deleteCookie(key) {
    this.setCookie(key, '', { maxAge: new Date(0) });
  }
};

const defaultOptions = {
  cors: {
    enabled: false,
    origin: ['*'],
    methods: ["POST", "GET"],
    maxAge: 86400
  },
  uploadDir: './tmp'
}

class ServerOptions {
  constructor({ cors, uploadDir }) {
    this.cors = cors || {};
    this.cors.enabled = this.cors.enabled || false;
    this.cors.origins = this.cors.origins || [];
    this.cors.methods = this.cors.methods || [];
    this.cors.maxAge = this.cors.maxAge || 86400;
    this.uploadDir = uploadDir || '/tmp'
  }
}

module.exports = { ResponseHelpers, ServerOptions }
