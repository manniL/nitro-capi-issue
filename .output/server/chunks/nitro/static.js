global.__timing__.logStart('Load chunks/nitro/static');'use strict';

const server = require('./server.js');
const Co = require('fs');
const po = require('path');
require('stream');
require('http');
require('url');
require('https');
require('zlib');
require('events');

const assets = {
  "/200.html": {
    "type": "text/html; charset=utf-8",
    "etag": "\"653-mqKE+E7a3x4YSBESmLJZqmfn62k\"",
    "mtime": "2021-02-05T23:27:23.744Z",
    "path": "../public/200.html"
  },
  "/README.md": {
    "type": "text/markdown; charset=utf-8",
    "etag": "\"1b3-gTFOSQz0sYaL46rOmUJhcivaZ9s\"",
    "mtime": "2021-02-05T23:27:22.804Z",
    "path": "../public/README.md"
  },
  "/favicon.ico": {
    "type": "image/vnd.microsoft.icon",
    "etag": "\"571-6q9LqIE5Xu944d42R/Jifjt+sEA\"",
    "mtime": "2021-02-05T23:27:22.804Z",
    "path": "../public/favicon.ico"
  },
  "/index.html": {
    "type": "text/html; charset=utf-8",
    "etag": "\"653-mqKE+E7a3x4YSBESmLJZqmfn62k\"",
    "mtime": "2021-02-05T23:27:23.735Z",
    "path": "../public/index.html"
  },
  "/_nuxt/3fb9f92.js": {
    "type": "application/javascript",
    "etag": "\"92c-GDx8ElpqF8h3tBOwjgOnrh+KvYk\"",
    "mtime": "2021-02-05T23:27:22.807Z",
    "path": "../public/_nuxt/3fb9f92.js"
  },
  "/_nuxt/59253ad.js": {
    "type": "application/javascript",
    "etag": "\"553-fyvcdKl61bUnIKAMj+YtV4th+ZM\"",
    "mtime": "2021-02-05T23:27:22.806Z",
    "path": "../public/_nuxt/59253ad.js"
  },
  "/_nuxt/603f7a2.js": {
    "type": "application/javascript",
    "etag": "\"31eff-wa3KguML3CNU7sbYHAur/9i4lH0\"",
    "mtime": "2021-02-05T23:27:22.806Z",
    "path": "../public/_nuxt/603f7a2.js"
  },
  "/_nuxt/d1f4970.js": {
    "type": "application/javascript",
    "etag": "\"16af6-ZBt2ajU9PuDOxTBI+xNQo/vAElQ\"",
    "mtime": "2021-02-05T23:27:22.805Z",
    "path": "../public/_nuxt/d1f4970.js"
  },
  "/_nuxt/d83ea7a.js": {
    "type": "application/javascript",
    "etag": "\"486-0NW5AQU/RUkICKozYB7TiGrx83M\"",
    "mtime": "2021-02-05T23:27:22.805Z",
    "path": "../public/_nuxt/d83ea7a.js"
  }
};

function readAsset (id) {
  return Co.promises.readFile(po.resolve(mainDir, getAsset(id).path))
}

function getAsset (id) {
  return assets[id]
}

const METHODS = ["HEAD", "GET"];
const PUBLIC_PATH = "/_nuxt/";
const TWO_DAYS = 2 * 60 * 60 * 24;
async function serveStatic(req, res) {
  if (!METHODS.includes(req.method)) {
    return;
  }
  let id = server.proxy.withLeadingSlash(server.proxy.withoutTrailingSlash(server.proxy.parseURL(req.url).pathname));
  let asset = getAsset(id);
  if (!asset) {
    const _id = id + "/index.html";
    const _asset = getAsset(_id);
    if (_asset) {
      asset = _asset;
      id = _id;
    }
  }
  if (!asset) {
    if (id.startsWith(PUBLIC_PATH)) {
      throw server.createError_1({
        statusMessage: "Cannot find static asset " + id,
        statusCode: 404
      });
    }
    return;
  }
  const ifNotMatch = req.headers["if-none-match"] === asset.etag;
  if (ifNotMatch) {
    res.statusCode = 304;
    return res.end("Not Modified (etag)");
  }
  const ifModifiedSinceH = req.headers["if-modified-since"];
  if (ifModifiedSinceH && asset.mtime) {
    if (new Date(ifModifiedSinceH) >= new Date(asset.mtime)) {
      res.statusCode = 304;
      return res.end("Not Modified (mtime)");
    }
  }
  if (asset.type) {
    res.setHeader("Content-Type", asset.type);
  }
  if (asset.etag) {
    res.setHeader("ETag", asset.etag);
  }
  if (asset.mtime) {
    res.setHeader("Last-Modified", asset.mtime);
  }
  if (id.startsWith(PUBLIC_PATH)) {
    res.setHeader("Cache-Control", `max-age=${TWO_DAYS}, immutable`);
  }
  const contents = await readAsset(id);
  return res.end(contents);
}

exports.default = serveStatic;;global.__timing__.logEnd('Load chunks/nitro/static');
