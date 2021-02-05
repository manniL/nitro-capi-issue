const global="undefined"!=typeof globalThis?globalThis:void 0!==o?o:"undefined"!=typeof self?self:{};
global.process = global.process || {};
const o=Date.now(),t=()=>Date.now()-o;global.process.hrtime=global.process.hrtime||(o=>{const e=Math.floor(.001*(Date.now()-t())),a=.001*t();let l=Math.floor(a)+e,n=Math.floor(a%1*1e9);return o&&(l-=o[0],n-=o[1],n<0&&(l--,n+=1e9)),[l,n]});(function() { const hrtime = global.process.hrtime;const start = () => hrtime();const end = s => { const d = hrtime(s); return ((d[0] * 1e9) + d[1]) / 1e6; };const _s = {};const metrics = [];const logStart = id => { _s[id] = hrtime(); };const logEnd = id => { const t = end(_s[id]); delete _s[id]; metrics.push([id, t]); console.debug('>', id + ' (' + t + 'ms)'); };global.__timing__ = { hrtime, start, end, metrics, logStart, logEnd }; })();global.__timing__.logStart('Cold Start');'use strict';

const server = require('./chunks/nitro/server.js');
require('http');
require('stream');
require('url');
require('https');
require('zlib');
require('events');



module.exports = server.server;;global.__timing__.logEnd('Cold Start');global.mainDir="undefined"!=typeof __dirname?__dirname:require.main.filename;
