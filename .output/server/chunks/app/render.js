global.__timing__.logStart('Load chunks/app/render');'use strict';

const server$1 = require('../nitro/server.js');
const require$$0 = require('util');
const po = require('path');
const Co = require('fs');
const require$$3 = require('os');
const require$$4 = require('tty');
const Stream = require('stream');
const go = require('vm');
const wo = require('module');
const require$$6 = require('querystring');
require('http');
require('url');
require('https');
require('zlib');
require('events');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

const require$$0__default = /*#__PURE__*/_interopDefaultLegacy(require$$0);
const po__default = /*#__PURE__*/_interopDefaultLegacy(po);
const Co__default = /*#__PURE__*/_interopDefaultLegacy(Co);
const require$$3__default = /*#__PURE__*/_interopDefaultLegacy(require$$3);
const require$$4__default = /*#__PURE__*/_interopDefaultLegacy(require$$4);
const Stream__default = /*#__PURE__*/_interopDefaultLegacy(Stream);
const go__default = /*#__PURE__*/_interopDefaultLegacy(go);
const wo__default = /*#__PURE__*/_interopDefaultLegacy(wo);
const require$$6__default = /*#__PURE__*/_interopDefaultLegacy(require$$6);

function createMapper(clientManifest) {
  const map = createMap(clientManifest);
  return function mapper(moduleIds) {
    const res = new Set();
    for (let i = 0; i < moduleIds.length; i++) {
      const mapped = map.get(moduleIds[i]);
      if (mapped) {
        for (let j = 0; j < mapped.length; j++) {
          res.add(mapped[j]);
        }
      }
    }
    return Array.from(res);
  };
}
function createMap(clientManifest) {
  const map = new Map();
  Object.keys(clientManifest.modules).forEach((id) => {
    map.set(id, mapIdToFile(id, clientManifest));
  });
  return map;
}
function mapIdToFile(id, clientManifest) {
  const files = [];
  const fileIndices = clientManifest.modules[id];
  if (fileIndices) {
    fileIndices.forEach((index) => {
      const file = clientManifest.all[index];
      if (clientManifest.async.includes(file) || !/\.(js|css)($|\?)/.test(file)) {
        files.push(file);
      }
    });
  }
  return files;
}

function isJS(file) {
  return /\.js(\?[^.]+)?$/.test(file);
}
function isCSS(file) {
  return /\.css(\?[^.]+)?$/.test(file);
}
function normalizeFile(file) {
  const withoutQuery = file.replace(/\?.*/, "");
  const extension = withoutQuery.split(".").pop() || "";
  return {
    file,
    extension,
    fileWithoutQuery: withoutQuery,
    asType: getPreloadType(extension)
  };
}
function ensureTrailingSlash(path) {
  if (path === "") {
    return path;
  }
  return path.replace(/([^/])$/, "$1/");
}
function getPreloadType(ext) {
  if (ext === "js") {
    return "script";
  } else if (ext === "css") {
    return "style";
  } else if (/jpe?g|png|svg|gif|webp|ico/.test(ext)) {
    return "image";
  } else if (/woff2?|ttf|otf|eot/.test(ext)) {
    return "font";
  } else {
    return "";
  }
}

function createRenderContext({clientManifest, publicPath, basedir}) {
  const renderContext = {
    clientManifest,
    publicPath,
    basedir
  };
  if (renderContext.clientManifest) {
    renderContext.publicPath = renderContext.publicPath || renderContext.clientManifest.publicPath;
    renderContext.preloadFiles = (renderContext.clientManifest.initial || []).map(normalizeFile);
    renderContext.prefetchFiles = (renderContext.clientManifest.async || []).map(normalizeFile);
    renderContext.mapFiles = createMapper(renderContext.clientManifest);
  }
  renderContext.publicPath = ensureTrailingSlash(renderContext.publicPath || "/");
  return renderContext;
}
function renderStyles(ssrContext, renderContext) {
  const initial = renderContext.preloadFiles || [];
  const async = getUsedAsyncFiles(ssrContext, renderContext) || [];
  const cssFiles = initial.concat(async).filter(({file}) => isCSS(file));
  return cssFiles.map(({file}) => {
    return `<link rel="stylesheet" href="${renderContext.publicPath}${file}">`;
  }).join("");
}
function renderResourceHints(ssrContext, renderContext) {
  return renderPreloadLinks(ssrContext, renderContext) + renderPrefetchLinks(ssrContext, renderContext);
}
function renderPreloadLinks(ssrContext, renderContext) {
  const files = getPreloadFiles(ssrContext, renderContext);
  const shouldPreload = renderContext.shouldPreload;
  if (files.length) {
    return files.map(({file, extension, fileWithoutQuery, asType}) => {
      let extra = "";
      if (!shouldPreload && asType !== "script" && asType !== "style") {
        return "";
      }
      if (shouldPreload && !shouldPreload(fileWithoutQuery, asType)) {
        return "";
      }
      if (asType === "font") {
        extra = ` type="font/${extension}" crossorigin`;
      }
      return `<link rel="preload" href="${renderContext.publicPath}${file}"${asType !== "" ? ` as="${asType}"` : ""}${extra}>`;
    }).join("");
  } else {
    return "";
  }
}
function renderPrefetchLinks(ssrContext, renderContext) {
  const shouldPrefetch = renderContext.shouldPrefetch;
  if (renderContext.prefetchFiles) {
    const usedAsyncFiles = getUsedAsyncFiles(ssrContext, renderContext);
    const alreadyRendered = (file) => {
      return usedAsyncFiles && usedAsyncFiles.some((f) => f.file === file);
    };
    return renderContext.prefetchFiles.map(({file, fileWithoutQuery, asType}) => {
      if (shouldPrefetch && !shouldPrefetch(fileWithoutQuery, asType)) {
        return "";
      }
      if (alreadyRendered(file)) {
        return "";
      }
      return `<link rel="prefetch" href="${renderContext.publicPath}${file}">`;
    }).join("");
  } else {
    return "";
  }
}
function renderScripts(ssrContext, renderContext) {
  if (renderContext.clientManifest && renderContext.preloadFiles) {
    const initial = renderContext.preloadFiles.filter(({file}) => isJS(file));
    const async = (getUsedAsyncFiles(ssrContext, renderContext) || []).filter(({file}) => isJS(file));
    const needed = [initial[0]].concat(async, initial.slice(1));
    return needed.map(({file}) => {
      return `<script src="${renderContext.publicPath}${file}" defer></script>`;
    }).join("");
  } else {
    return "";
  }
}
function getPreloadFiles(ssrContext, renderContext) {
  const usedAsyncFiles = getUsedAsyncFiles(ssrContext, renderContext);
  if (renderContext.preloadFiles || usedAsyncFiles) {
    return (renderContext.preloadFiles || []).concat(usedAsyncFiles || []);
  } else {
    return [];
  }
}
function getUsedAsyncFiles(ssrContext, renderContext) {
  if (!ssrContext._mappedFiles && ssrContext._registeredComponents && renderContext.mapFiles) {
    const registered = Array.from(ssrContext._registeredComponents);
    ssrContext._mappedFiles = renderContext.mapFiles(registered).map(normalizeFile);
  }
  return ssrContext._mappedFiles || [];
}
function createRenderer(createApp, renderOptions) {
  const renderContext = createRenderContext(renderOptions);
  return {
    async renderToString(ssrContext) {
      ssrContext._registeredComponents = ssrContext._registeredComponents || new Set();
      const _createApp = await Promise.resolve(createApp).then((r) => r.default || r);
      const app = await _createApp(ssrContext);
      const html = await renderOptions.renderToString(app, ssrContext);
      const wrap = (fn) => () => fn(ssrContext, renderContext);
      return {
        html,
        renderResourceHints: wrap(renderResourceHints),
        renderStyles: wrap(renderStyles),
        renderScripts: wrap(renderScripts)
      };
    }
  };
}

function createBundleRenderer(_bundle, renderOptions) {
  const {evaluateEntry, rewriteErrorTrace} = renderOptions.bundleRunner.createBundle(_bundle, renderOptions);
  async function createApp(ssrContext, evalContext) {
    try {
      const entry = await evaluateEntry(evalContext);
      const app = await entry(ssrContext);
      return app;
    } catch (err) {
      rewriteErrorTrace(err);
      throw err;
    }
  }
  return createRenderer(createApp, renderOptions);
}

var createBundleRenderer_1 = createBundleRenderer;
var createRenderer_1 = createRenderer;

/*#__PURE__*/Object.defineProperty({
	createBundleRenderer: createBundleRenderer_1,
	createRenderer: createRenderer_1
}, '__esModule', {value: true});

function u(u){return u&&"object"==typeof u&&"default"in u?u.default:u}var D=u(require$$0__default['default']),e=po__default['default'],t=Co__default['default'],r=u(require$$3__default['default']),n=u(require$$4__default['default']);function s(u,D){return u(D={exports:{}},D.exports),D.exports}var o,i=(o=Object.freeze({__proto__:null,default:[{name:"AppVeyor",constant:"APPVEYOR",env:"APPVEYOR",pr:"APPVEYOR_PULL_REQUEST_NUMBER"},{name:"Bamboo",constant:"BAMBOO",env:"bamboo_planKey"},{name:"Bitbucket Pipelines",constant:"BITBUCKET",env:"BITBUCKET_COMMIT"},{name:"Bitrise",constant:"BITRISE",env:"BITRISE_IO",pr:"BITRISE_PULL_REQUEST"},{name:"Buddy",constant:"BUDDY",env:"BUDDY_WORKSPACE_ID",pr:"BUDDY_EXECUTION_PULL_REQUEST_ID"},{name:"Buildkite",constant:"BUILDKITE",env:"BUILDKITE",pr:{env:"BUILDKITE_PULL_REQUEST",ne:"false"}},{name:"CircleCI",constant:"CIRCLE",env:"CIRCLECI",pr:"CIRCLE_PULL_REQUEST"},{name:"Cirrus CI",constant:"CIRRUS",env:"CIRRUS_CI",pr:"CIRRUS_PR"},{name:"AWS CodeBuild",constant:"CODEBUILD",env:"CODEBUILD_BUILD_ARN"},{name:"Codeship",constant:"CODESHIP",env:{CI_NAME:"codeship"}},{name:"Drone",constant:"DRONE",env:"DRONE",pr:{DRONE_BUILD_EVENT:"pull_request"}},{name:"dsari",constant:"DSARI",env:"DSARI"},{name:"GitLab CI",constant:"GITLAB",env:"GITLAB_CI"},{name:"GoCD",constant:"GOCD",env:"GO_PIPELINE_LABEL"},{name:"Hudson",constant:"HUDSON",env:"HUDSON_URL"},{name:"Jenkins",constant:"JENKINS",env:["JENKINS_URL","BUILD_ID"],pr:{any:["ghprbPullId","CHANGE_ID"]}},{name:"Magnum CI",constant:"MAGNUM",env:"MAGNUM"},{name:"Sail CI",constant:"SAIL",env:"SAILCI",pr:"SAIL_PULL_REQUEST_NUMBER"},{name:"Semaphore",constant:"SEMAPHORE",env:"SEMAPHORE",pr:"PULL_REQUEST_NUMBER"},{name:"Shippable",constant:"SHIPPABLE",env:"SHIPPABLE",pr:{IS_PULL_REQUEST:"true"}},{name:"Solano CI",constant:"SOLANO",env:"TDDIUM",pr:"TDDIUM_PR_ID"},{name:"Strider CD",constant:"STRIDER",env:"STRIDER"},{name:"TaskCluster",constant:"TASKCLUSTER",env:["TASK_ID","RUN_ID"]},{name:"Solano CI",constant:"TDDIUM",env:"TDDIUM",pr:"TDDIUM_PR_ID",deprecated:!0},{name:"TeamCity",constant:"TEAMCITY",env:"TEAMCITY_VERSION"},{name:"Team Foundation Server",constant:"TFS",env:"TF_BUILD"},{name:"Travis CI",constant:"TRAVIS",env:"TRAVIS",pr:{env:"TRAVIS_PULL_REQUEST",ne:"false"}}]}))&&o.default||o,a=s((function(u,D){var e=process.env;function t(u){return "string"==typeof u?!!e[u]:Object.keys(u).every((function(D){return e[D]===u[D]}))}Object.defineProperty(D,"_vendors",{value:i.map((function(u){return u.constant}))}),D.name=null,D.isPR=null,i.forEach((function(u){var r=(Array.isArray(u.env)?u.env:[u.env]).every((function(u){return t(u)}));if(D[u.constant]=r,r)switch(D.name=u.name,typeof u.pr){case"string":D.isPR=!!e[u.pr];break;case"object":"env"in u.pr?D.isPR=u.pr.env in e&&e[u.pr.env]!==u.pr.ne:"any"in u.pr?D.isPR=u.pr.any.some((function(u){return !!e[u]})):D.isPR=t(u.pr);break;default:D.isPR=null;}})),D.isCI=!!(e.CI||e.CONTINUOUS_INTEGRATION||e.BUILD_NUMBER||e.RUN_ID||D.name);})),l=(a.name,a.isPR,a.isCI,!1),c=!1,h=!1,F="development",C="undefined"!="undefined",f="",E=!1;function g(u){return !(!u||"false"===u)}"undefined"!=typeof process&&(process.platform&&(f=String(process.platform)),process.stdout&&(h=g(process.stdout.isTTY)),l=Boolean(a.isCI),process.env&&((F="production"),c=g(false),E=g(process.env.MINIMAL)));var d={browser:C,test:"test"===F,dev:"development"===F||"dev"===F,production:"production"===F,debug:c,ci:l,tty:h,minimal:void 0,minimalCLI:void 0,windows:/^win/i.test(f),darwin:/^darwin/i.test(f),linux:/^linux/i.test(f)};d.minimal=E||d.ci||d.test||!d.tty,d.minimalCLI=d.minimal;var p=Object.freeze(d);const m={};m[m.Fatal=0]="Fatal",m[m.Error=0]="Error",m[m.Warn=1]="Warn",m[m.Log=2]="Log",m[m.Info=3]="Info",m[m.Success=3]="Success",m[m.Debug=4]="Debug",m[m.Trace=5]="Trace",m[m.Silent=-1/0]="Silent",m[m.Verbose=1/0]="Verbose";var b={silent:{level:-1},fatal:{level:m.Fatal},error:{level:m.Error},warn:{level:m.Warn},log:{level:m.Log},info:{level:m.Info},success:{level:m.Success},debug:{level:m.Debug},trace:{level:m.Trace},verbose:{level:m.Trace},ready:{level:m.Info},start:{level:m.Info}};function y(u){return D=u,"[object Object]"===Object.prototype.toString.call(D)&&(!(!u.message&&!u.args)&&!u.stack);var D;}let B=!1;const v=[];class _{constructor(u={}){this._reporters=u.reporters||[],this._types=u.types||b,this.level=void 0!==u.level?u.level:3,this._defaults=u.defaults||{},this._async=void 0!==u.async?u.async:void 0,this._stdout=u.stdout,this._stderr=u.stderr,this._mockFn=u.mockFn,this._throttle=u.throttle||1e3,this._throttleMin=u.throttleMin||5;for(const u in this._types){const D={type:u,...this._types[u],...this._defaults};this[u]=this._wrapLogFn(D),this[u].raw=this._wrapLogFn(D,!0);}this._mockFn&&this.mockTypes(),this._lastLogSerialized=void 0,this._lastLog=void 0,this._lastLogTime=void 0,this._lastLogCount=0,this._throttleTimeout=void 0;}get stdout(){return this._stdout||console._stdout}get stderr(){return this._stderr||console._stderr}create(u){return new _(Object.assign({reporters:this._reporters,level:this.level,types:this._types,defaults:this._defaults,stdout:this._stdout,stderr:this._stderr,mockFn:this._mockFn},u))}withDefaults(u){return this.create({defaults:Object.assign({},this._defaults,u)})}withTag(u){return this.withDefaults({tag:this._defaults.tag?this._defaults.tag+":"+u:u})}addReporter(u){return this._reporters.push(u),this}removeReporter(u){if(u){const D=this._reporters.indexOf(u);if(D>=0)return this._reporters.splice(D,1)}else this._reporters.splice(0);return this}setReporters(u){return this._reporters=Array.isArray(u)?u:[u],this}wrapAll(){this.wrapConsole(),this.wrapStd();}restoreAll(){this.restoreConsole(),this.restoreStd();}wrapConsole(){for(const u in this._types)console["__"+u]||(console["__"+u]=console[u]),console[u]=this[u].raw;}restoreConsole(){for(const u in this._types)console["__"+u]&&(console[u]=console["__"+u],delete console["__"+u]);}wrapStd(){this._wrapStream(this.stdout,"log"),this._wrapStream(this.stderr,"log");}_wrapStream(u,D){u&&(u.__write||(u.__write=u.write),u.write=u=>{this[D].raw(String(u).trim());});}restoreStd(){this._restoreStream(this.stdout),this._restoreStream(this.stderr);}_restoreStream(u){u&&u.__write&&(u.write=u.__write,delete u.__write);}pauseLogs(){B=!0;}resumeLogs(){B=!1;const u=v.splice(0);for(const D of u)D[0]._logFn(D[1],D[2]);}mockTypes(u){if(this._mockFn=u||this._mockFn,"function"==typeof this._mockFn)for(const u in this._types)this[u]=this._mockFn(u,this._types[u])||this[u];}_wrapLogFn(u,D){return (...e)=>{if(!B)return this._logFn(u,e,D);v.push([this,u,e,D]);}}_logFn(u,D,e){if(u.level>this.level)return !!this._async&&Promise.resolve(!1);const t=Object.assign({date:new Date,args:[]},u);!e&&1===D.length&&y(D[0])?Object.assign(t,D[0]):t.args=Array.from(D),t.message&&(t.args.unshift(t.message),delete t.message),t.additional&&(Array.isArray(t.additional)||(t.additional=t.additional.split("\n")),t.args.push("\n"+t.additional.join("\n")),delete t.additional),t.type="string"==typeof t.type?t.type.toLowerCase():"",t.tag="string"==typeof t.tag?t.tag.toLowerCase():"";const r=(u=!1)=>{const D=this._lastLogCount-this._throttleMin;if(this._lastLog&&D>0){const u=[...this._lastLog.args];D>1&&u.push(`(repeated ${D} times)`),this._log({...this._lastLog,args:u}),this._lastLogCount=1;}if(u){if(this._lastLog=t,this._async)return this._logAsync(t);this._log(t);}};clearTimeout(this._throttleTimeout);const n=this._lastLogTime?t.date-this._lastLogTime:0;if(this._lastLogTime=t.date,n<this._throttle)try{const u=JSON.stringify([t.type,t.tag,t.args]),D=this._lastLogSerialized===u;if(this._lastLogSerialized=u,D&&(this._lastLogCount++,this._lastLogCount>this._throttleMin))return void(this._throttleTimeout=setTimeout(r,this._throttle))}catch(u){}r(!0);}_log(u){for(const D of this._reporters)D.log(u,{async:!1,stdout:this.stdout,stderr:this.stderr});}_logAsync(u){return Promise.all(this._reporters.map(D=>D.log(u,{async:!0,stdout:this.stdout,stderr:this.stderr})))}}function A(u){const D=process.cwd()+e.sep;return u.split("\n").splice(1).map(u=>u.trim().replace("file://","").replace(D,""))}_.prototype.add=_.prototype.addReporter,_.prototype.remove=_.prototype.removeReporter,_.prototype.clear=_.prototype.removeReporter,_.prototype.withScope=_.prototype.withTag,_.prototype.mock=_.prototype.mockTypes,_.prototype.pause=_.prototype.pauseLogs,_.prototype.resume=_.prototype.resumeLogs;var w=s((function(u,D){u.exports=function(){var u="millisecond",D="second",e="minute",t="hour",r="day",n="week",s="month",o="quarter",i="year",a=/^(\d{4})-?(\d{1,2})-?(\d{0,2})[^0-9]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?.?(\d{1,3})?$/,l=/\[([^\]]+)]|Y{2,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g,c=function(u,D,e){var t=String(u);return !t||t.length>=D?u:""+Array(D+1-t.length).join(e)+u},h={s:c,z:function(u){var D=-u.utcOffset(),e=Math.abs(D),t=Math.floor(e/60),r=e%60;return (D<=0?"+":"-")+c(t,2,"0")+":"+c(r,2,"0")},m:function(u,D){var e=12*(D.year()-u.year())+(D.month()-u.month()),t=u.clone().add(e,s),r=D-t<0,n=u.clone().add(e+(r?-1:1),s);return Number(-(e+(D-t)/(r?t-n:n-t))||0)},a:function(u){return u<0?Math.ceil(u)||0:Math.floor(u)},p:function(a){return {M:s,y:i,w:n,d:r,D:"date",h:t,m:e,s:D,ms:u,Q:o}[a]||String(a||"").toLowerCase().replace(/s$/,"")},u:function(u){return void 0===u}},F={name:"en",weekdays:"Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),months:"January_February_March_April_May_June_July_August_September_October_November_December".split("_")},C="en",f={};f[C]=F;var E=function(u){return u instanceof m},g=function(u,D,e){var t;if(!u)return C;if("string"==typeof u)f[u]&&(t=u),D&&(f[u]=D,t=u);else {var r=u.name;f[r]=u,t=r;}return !e&&t&&(C=t),t||!e&&C},d=function(u,D){if(E(u))return u.clone();var e="object"==typeof D?D:{};return e.date=u,e.args=arguments,new m(e)},p=h;p.l=g,p.i=E,p.w=function(u,D){return d(u,{locale:D.$L,utc:D.$u,$offset:D.$offset})};var m=function(){function c(u){this.$L=this.$L||g(u.locale,null,!0),this.parse(u);}var h=c.prototype;return h.parse=function(u){this.$d=function(u){var D=u.date,e=u.utc;if(null===D)return new Date(NaN);if(p.u(D))return new Date;if(D instanceof Date)return new Date(D);if("string"==typeof D&&!/Z$/i.test(D)){var t=D.match(a);if(t)return e?new Date(Date.UTC(t[1],t[2]-1,t[3]||1,t[4]||0,t[5]||0,t[6]||0,t[7]||0)):new Date(t[1],t[2]-1,t[3]||1,t[4]||0,t[5]||0,t[6]||0,t[7]||0)}return new Date(D)}(u),this.init();},h.init=function(){var u=this.$d;this.$y=u.getFullYear(),this.$M=u.getMonth(),this.$D=u.getDate(),this.$W=u.getDay(),this.$H=u.getHours(),this.$m=u.getMinutes(),this.$s=u.getSeconds(),this.$ms=u.getMilliseconds();},h.$utils=function(){return p},h.isValid=function(){return !("Invalid Date"===this.$d.toString())},h.isSame=function(u,D){var e=d(u);return this.startOf(D)<=e&&e<=this.endOf(D)},h.isAfter=function(u,D){return d(u)<this.startOf(D)},h.isBefore=function(u,D){return this.endOf(D)<d(u)},h.$g=function(u,D,e){return p.u(u)?this[D]:this.set(e,u)},h.year=function(u){return this.$g(u,"$y",i)},h.month=function(u){return this.$g(u,"$M",s)},h.day=function(u){return this.$g(u,"$W",r)},h.date=function(u){return this.$g(u,"$D","date")},h.hour=function(u){return this.$g(u,"$H",t)},h.minute=function(u){return this.$g(u,"$m",e)},h.second=function(u){return this.$g(u,"$s",D)},h.millisecond=function(D){return this.$g(D,"$ms",u)},h.unix=function(){return Math.floor(this.valueOf()/1e3)},h.valueOf=function(){return this.$d.getTime()},h.startOf=function(u,o){var a=this,l=!!p.u(o)||o,c=p.p(u),h=function(u,D){var e=p.w(a.$u?Date.UTC(a.$y,D,u):new Date(a.$y,D,u),a);return l?e:e.endOf(r)},F=function(u,D){return p.w(a.toDate()[u].apply(a.toDate("s"),(l?[0,0,0,0]:[23,59,59,999]).slice(D)),a)},C=this.$W,f=this.$M,E=this.$D,g="set"+(this.$u?"UTC":"");switch(c){case i:return l?h(1,0):h(31,11);case s:return l?h(1,f):h(0,f+1);case n:var d=this.$locale().weekStart||0,m=(C<d?C+7:C)-d;return h(l?E-m:E+(6-m),f);case r:case"date":return F(g+"Hours",0);case t:return F(g+"Minutes",1);case e:return F(g+"Seconds",2);case D:return F(g+"Milliseconds",3);default:return this.clone()}},h.endOf=function(u){return this.startOf(u,!1)},h.$set=function(n,o){var a,l=p.p(n),c="set"+(this.$u?"UTC":""),h=(a={},a.day=c+"Date",a.date=c+"Date",a[s]=c+"Month",a[i]=c+"FullYear",a[t]=c+"Hours",a[e]=c+"Minutes",a[D]=c+"Seconds",a[u]=c+"Milliseconds",a)[l],F=l===r?this.$D+(o-this.$W):o;if(l===s||l===i){var C=this.clone().set("date",1);C.$d[h](F),C.init(),this.$d=C.set("date",Math.min(this.$D,C.daysInMonth())).toDate();}else h&&this.$d[h](F);return this.init(),this},h.set=function(u,D){return this.clone().$set(u,D)},h.get=function(u){return this[p.p(u)]()},h.add=function(u,o){var a,l=this;u=Number(u);var c=p.p(o),h=function(D){var e=d(l);return p.w(e.date(e.date()+Math.round(D*u)),l)};if(c===s)return this.set(s,this.$M+u);if(c===i)return this.set(i,this.$y+u);if(c===r)return h(1);if(c===n)return h(7);var F=(a={},a[e]=6e4,a[t]=36e5,a[D]=1e3,a)[c]||1,C=this.$d.getTime()+u*F;return p.w(C,this)},h.subtract=function(u,D){return this.add(-1*u,D)},h.format=function(u){var D=this;if(!this.isValid())return "Invalid Date";var e=u||"YYYY-MM-DDTHH:mm:ssZ",t=p.z(this),r=this.$locale(),n=this.$H,s=this.$m,o=this.$M,i=r.weekdays,a=r.months,c=function(u,t,r,n){return u&&(u[t]||u(D,e))||r[t].substr(0,n)},h=function(u){return p.s(n%12||12,u,"0")},F=r.meridiem||function(u,D,e){var t=u<12?"AM":"PM";return e?t.toLowerCase():t},C={YY:String(this.$y).slice(-2),YYYY:this.$y,M:o+1,MM:p.s(o+1,2,"0"),MMM:c(r.monthsShort,o,a,3),MMMM:c(a,o),D:this.$D,DD:p.s(this.$D,2,"0"),d:String(this.$W),dd:c(r.weekdaysMin,this.$W,i,2),ddd:c(r.weekdaysShort,this.$W,i,3),dddd:i[this.$W],H:String(n),HH:p.s(n,2,"0"),h:h(1),hh:h(2),a:F(n,s,!0),A:F(n,s,!1),m:String(s),mm:p.s(s,2,"0"),s:String(this.$s),ss:p.s(this.$s,2,"0"),SSS:p.s(this.$ms,3,"0"),Z:t};return e.replace(l,(function(u,D){return D||C[u]||t.replace(":","")}))},h.utcOffset=function(){return 15*-Math.round(this.$d.getTimezoneOffset()/15)},h.diff=function(u,r,a){var l,c=p.p(r),h=d(u),F=6e4*(h.utcOffset()-this.utcOffset()),C=this-h,f=p.m(this,h);return f=(l={},l[i]=f/12,l[s]=f,l[o]=f/3,l[n]=(C-F)/6048e5,l.day=(C-F)/864e5,l[t]=C/36e5,l[e]=C/6e4,l[D]=C/1e3,l)[c]||C,a?f:p.a(f)},h.daysInMonth=function(){return this.endOf(s).$D},h.$locale=function(){return f[this.$L]},h.locale=function(u,D){if(!u)return this.$L;var e=this.clone(),t=g(u,D,!0);return t&&(e.$L=t),e},h.clone=function(){return p.w(this.$d,this)},h.toDate=function(){return new Date(this.valueOf())},h.toJSON=function(){return this.isValid()?this.toISOString():null},h.toISOString=function(){return this.$d.toISOString()},h.toString=function(){return this.$d.toUTCString()},c}();return d.prototype=m.prototype,d.extend=function(u,D){return u(D,m,d),d},d.locale=g,d.isDayjs=E,d.unix=function(u){return d(1e3*u)},d.en=f[C],d.Ls=f,d}();}));const O={dateFormat:"HH:mm:ss",formatOptions:{date:!0,colors:!1,compact:!0}},M=u=>u?`[${u}]`:"";class S{constructor(u){this.options=Object.assign({},O,u);}formatStack(u){return "  "+A(u).join("\n  ")}formatArgs(u){const e=u.map(u=>u&&"string"==typeof u.stack?u.message+"\n"+this.formatStack(u.stack):u);return "function"==typeof D.formatWithOptions?D.formatWithOptions(this.options.formatOptions,...e):D.format(...e)}formatDate(u){return this.options.formatOptions.date?function(u,D){return w(D).format(u)}(this.options.dateFormat,u):""}filterAndJoin(u){return u.filter(u=>u).join(" ")}formatLogObj(u){const D=this.formatArgs(u.args);return this.filterAndJoin([M(u.type),M(u.tag),D])}log(u,{async:D,stdout:e,stderr:r}={}){return function(u,D,e="default"){const r=D.__write||D.write;switch(e){case"async":return new Promise(e=>{!0===r.call(D,u)?e():D.once("drain",()=>{e();});});case"sync":return t.writeSync(D.fd,u);default:return r.call(D,u)}}(this.formatLogObj(u,{width:e.columns||0})+"\n",u.level<2?r:e,D?"async":"default")}}var I=u=>"string"==typeof u?u.replace((({onlyFirst:u=!1}={})=>{const D=["[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)","(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))"].join("|");return new RegExp(D,u?void 0:"g")})(),""):u;const k=u=>!Number.isNaN(u)&&(u>=4352&&(u<=4447||9001===u||9002===u||11904<=u&&u<=12871&&12351!==u||12880<=u&&u<=19903||19968<=u&&u<=42182||43360<=u&&u<=43388||44032<=u&&u<=55203||63744<=u&&u<=64255||65040<=u&&u<=65049||65072<=u&&u<=65131||65281<=u&&u<=65376||65504<=u&&u<=65510||110592<=u&&u<=110593||127488<=u&&u<=127569||131072<=u&&u<=262141));var R=k,T=k;R.default=T;const L=u=>{if("string"!=typeof(u=u.replace(/\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74|\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73)\uDB40\uDC7F|\uD83D\uDC68(?:\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFB|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFE])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83D\uDC68|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D[\uDC66\uDC67])|[\u2695\u2696\u2708]\uFE0F|\uD83D[\uDC66\uDC67]|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|(?:\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708])\uFE0F|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C[\uDFFB-\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)\uD83C\uDFFB|\uD83E\uDDD1(?:\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])|\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1)|(?:\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFE])|(?:\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)(?:\uD83C[\uDFFB\uDFFC])|\uD83D\uDC69(?:\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFC-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|(?:\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)(?:\uD83C[\uDFFB-\uDFFD])|\uD83D\uDC69\u200D\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8|\uD83D\uDC69(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|(?:(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)\uFE0F|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF])\u200D[\u2640\u2642]|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|\u200D[\u2640\u2642])|\uD83C\uDFF4\u200D\u2620)\uFE0F|\uD83D\uDC69\u200D\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08|\uD83D\uDC15\u200D\uD83E\uDDBA|\uD83D\uDC69\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC67|\uD83C\uDDFD\uD83C\uDDF0|\uD83C\uDDF4\uD83C\uDDF2|\uD83C\uDDF6\uD83C\uDDE6|[#\*0-9]\uFE0F\u20E3|\uD83C\uDDE7(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF])|\uD83C\uDDF9(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF])|\uD83C\uDDEA(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA])|\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])|\uD83C\uDDF7(?:\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC])|\uD83D\uDC69(?:\uD83C[\uDFFB-\uDFFF])|\uD83C\uDDF2(?:\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF])|\uD83C\uDDE6(?:\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF])|\uD83C\uDDF0(?:\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF])|\uD83C\uDDED(?:\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA])|\uD83C\uDDE9(?:\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF])|\uD83C\uDDFE(?:\uD83C[\uDDEA\uDDF9])|\uD83C\uDDEC(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE])|\uD83C\uDDF8(?:\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF])|\uD83C\uDDEB(?:\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7])|\uD83C\uDDF5(?:\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE])|\uD83C\uDDFB(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA])|\uD83C\uDDF3(?:\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF])|\uD83C\uDDE8(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF])|\uD83C\uDDF1(?:\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE])|\uD83C\uDDFF(?:\uD83C[\uDDE6\uDDF2\uDDFC])|\uD83C\uDDFC(?:\uD83C[\uDDEB\uDDF8])|\uD83C\uDDFA(?:\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF])|\uD83C\uDDEE(?:\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9])|\uD83C\uDDEF(?:\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5])|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u270A-\u270D]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC70\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDCAA\uDD74\uDD7A\uDD90\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD36\uDDB5\uDDB6\uDDBB\uDDD2-\uDDD5])(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDED5\uDEEB\uDEEC\uDEF4-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])|(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD7A\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA4\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED2\uDED5\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])\uFE0F|(?:[\u261D\u26F9\u270A-\u270D]|\uD83C[\uDF85\uDFC2-\uDFC4\uDFC7\uDFCA-\uDFCC]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66-\uDC78\uDC7C\uDC81-\uDC83\uDC85-\uDC87\uDC8F\uDC91\uDCAA\uDD74\uDD75\uDD7A\uDD90\uDD95\uDD96\uDE45-\uDE47\uDE4B-\uDE4F\uDEA3\uDEB4-\uDEB6\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1F\uDD26\uDD30-\uDD39\uDD3C-\uDD3E\uDDB5\uDDB6\uDDB8\uDDB9\uDDBB\uDDCD-\uDDCF\uDDD1-\uDDDD])/g,"  "))||0===u.length)return 0;u=I(u);let D=0;for(let e=0;e<u.length;e++){const t=u.codePointAt(e);t<=31||t>=127&&t<=159||(t>=768&&t<=879||(t>65535&&e++,D+=R(t)?2:1));}return D};var $=L,x=L;$.default=x;var U=/[|\\{}()[\]^$+*?.]/g,j=function(u){if("string"!=typeof u)throw new TypeError("Expected a string");return u.replace(U,"\\$&")};const{platform:P}=process,N={tick:"✔",cross:"✖",star:"★",square:"▇",squareSmall:"◻",squareSmallFilled:"◼",play:"▶",circle:"◯",circleFilled:"◉",circleDotted:"◌",circleDouble:"◎",circleCircle:"ⓞ",circleCross:"ⓧ",circlePipe:"Ⓘ",circleQuestionMark:"?⃝",bullet:"●",dot:"․",line:"─",ellipsis:"…",pointer:"❯",pointerSmall:"›",info:"ℹ",warning:"⚠",hamburger:"☰",smiley:"㋡",mustache:"෴",heart:"♥",nodejs:"⬢",arrowUp:"↑",arrowDown:"↓",arrowLeft:"←",arrowRight:"→",radioOn:"◉",radioOff:"◯",checkboxOn:"☒",checkboxOff:"☐",checkboxCircleOn:"ⓧ",checkboxCircleOff:"Ⓘ",questionMarkPrefix:"?⃝",oneHalf:"½",oneThird:"⅓",oneQuarter:"¼",oneFifth:"⅕",oneSixth:"⅙",oneSeventh:"⅐",oneEighth:"⅛",oneNinth:"⅑",oneTenth:"⅒",twoThirds:"⅔",twoFifths:"⅖",threeQuarters:"¾",threeFifths:"⅗",threeEighths:"⅜",fourFifths:"⅘",fiveSixths:"⅚",fiveEighths:"⅝",sevenEighths:"⅞"},q={tick:"√",cross:"×",star:"*",square:"█",squareSmall:"[ ]",squareSmallFilled:"[█]",play:"►",circle:"( )",circleFilled:"(*)",circleDotted:"( )",circleDouble:"( )",circleCircle:"(○)",circleCross:"(×)",circlePipe:"(│)",circleQuestionMark:"(?)",bullet:"*",dot:".",line:"─",ellipsis:"...",pointer:">",pointerSmall:"»",info:"i",warning:"‼",hamburger:"≡",smiley:"☺",mustache:"┌─┐",heart:N.heart,nodejs:"♦",arrowUp:N.arrowUp,arrowDown:N.arrowDown,arrowLeft:N.arrowLeft,arrowRight:N.arrowRight,radioOn:"(*)",radioOff:"( )",checkboxOn:"[×]",checkboxOff:"[ ]",checkboxCircleOn:"(×)",checkboxCircleOff:"( )",questionMarkPrefix:"？",oneHalf:"1/2",oneThird:"1/3",oneQuarter:"1/4",oneFifth:"1/5",oneSixth:"1/6",oneSeventh:"1/7",oneEighth:"1/8",oneNinth:"1/9",oneTenth:"1/10",twoThirds:"2/3",twoFifths:"2/5",threeQuarters:"3/4",threeFifths:"3/5",threeEighths:"3/8",fourFifths:"4/5",fiveSixths:"5/6",fiveEighths:"5/8",sevenEighths:"7/8"};"linux"===P&&(N.questionMarkPrefix="?");const Y="win32"===P?q:N;var H=Object.assign(u=>{if(Y===N)return u;for(const[D,e]of Object.entries(N))e!==Y[D]&&(u=u.replace(new RegExp(j(e),"g"),Y[D]));return u},Y),V=N,W=q;H.main=V,H.windows=W;var G={aliceblue:[240,248,255],antiquewhite:[250,235,215],aqua:[0,255,255],aquamarine:[127,255,212],azure:[240,255,255],beige:[245,245,220],bisque:[255,228,196],black:[0,0,0],blanchedalmond:[255,235,205],blue:[0,0,255],blueviolet:[138,43,226],brown:[165,42,42],burlywood:[222,184,135],cadetblue:[95,158,160],chartreuse:[127,255,0],chocolate:[210,105,30],coral:[255,127,80],cornflowerblue:[100,149,237],cornsilk:[255,248,220],crimson:[220,20,60],cyan:[0,255,255],darkblue:[0,0,139],darkcyan:[0,139,139],darkgoldenrod:[184,134,11],darkgray:[169,169,169],darkgreen:[0,100,0],darkgrey:[169,169,169],darkkhaki:[189,183,107],darkmagenta:[139,0,139],darkolivegreen:[85,107,47],darkorange:[255,140,0],darkorchid:[153,50,204],darkred:[139,0,0],darksalmon:[233,150,122],darkseagreen:[143,188,143],darkslateblue:[72,61,139],darkslategray:[47,79,79],darkslategrey:[47,79,79],darkturquoise:[0,206,209],darkviolet:[148,0,211],deeppink:[255,20,147],deepskyblue:[0,191,255],dimgray:[105,105,105],dimgrey:[105,105,105],dodgerblue:[30,144,255],firebrick:[178,34,34],floralwhite:[255,250,240],forestgreen:[34,139,34],fuchsia:[255,0,255],gainsboro:[220,220,220],ghostwhite:[248,248,255],gold:[255,215,0],goldenrod:[218,165,32],gray:[128,128,128],green:[0,128,0],greenyellow:[173,255,47],grey:[128,128,128],honeydew:[240,255,240],hotpink:[255,105,180],indianred:[205,92,92],indigo:[75,0,130],ivory:[255,255,240],khaki:[240,230,140],lavender:[230,230,250],lavenderblush:[255,240,245],lawngreen:[124,252,0],lemonchiffon:[255,250,205],lightblue:[173,216,230],lightcoral:[240,128,128],lightcyan:[224,255,255],lightgoldenrodyellow:[250,250,210],lightgray:[211,211,211],lightgreen:[144,238,144],lightgrey:[211,211,211],lightpink:[255,182,193],lightsalmon:[255,160,122],lightseagreen:[32,178,170],lightskyblue:[135,206,250],lightslategray:[119,136,153],lightslategrey:[119,136,153],lightsteelblue:[176,196,222],lightyellow:[255,255,224],lime:[0,255,0],limegreen:[50,205,50],linen:[250,240,230],magenta:[255,0,255],maroon:[128,0,0],mediumaquamarine:[102,205,170],mediumblue:[0,0,205],mediumorchid:[186,85,211],mediumpurple:[147,112,219],mediumseagreen:[60,179,113],mediumslateblue:[123,104,238],mediumspringgreen:[0,250,154],mediumturquoise:[72,209,204],mediumvioletred:[199,21,133],midnightblue:[25,25,112],mintcream:[245,255,250],mistyrose:[255,228,225],moccasin:[255,228,181],navajowhite:[255,222,173],navy:[0,0,128],oldlace:[253,245,230],olive:[128,128,0],olivedrab:[107,142,35],orange:[255,165,0],orangered:[255,69,0],orchid:[218,112,214],palegoldenrod:[238,232,170],palegreen:[152,251,152],paleturquoise:[175,238,238],palevioletred:[219,112,147],papayawhip:[255,239,213],peachpuff:[255,218,185],peru:[205,133,63],pink:[255,192,203],plum:[221,160,221],powderblue:[176,224,230],purple:[128,0,128],rebeccapurple:[102,51,153],red:[255,0,0],rosybrown:[188,143,143],royalblue:[65,105,225],saddlebrown:[139,69,19],salmon:[250,128,114],sandybrown:[244,164,96],seagreen:[46,139,87],seashell:[255,245,238],sienna:[160,82,45],silver:[192,192,192],skyblue:[135,206,235],slateblue:[106,90,205],slategray:[112,128,144],slategrey:[112,128,144],snow:[255,250,250],springgreen:[0,255,127],steelblue:[70,130,180],tan:[210,180,140],teal:[0,128,128],thistle:[216,191,216],tomato:[255,99,71],turquoise:[64,224,208],violet:[238,130,238],wheat:[245,222,179],white:[255,255,255],whitesmoke:[245,245,245],yellow:[255,255,0],yellowgreen:[154,205,50]};const z={};for(const u of Object.keys(G))z[G[u]]=u;const Q={rgb:{channels:3,labels:"rgb"},hsl:{channels:3,labels:"hsl"},hsv:{channels:3,labels:"hsv"},hwb:{channels:3,labels:"hwb"},cmyk:{channels:4,labels:"cmyk"},xyz:{channels:3,labels:"xyz"},lab:{channels:3,labels:"lab"},lch:{channels:3,labels:"lch"},hex:{channels:1,labels:["hex"]},keyword:{channels:1,labels:["keyword"]},ansi16:{channels:1,labels:["ansi16"]},ansi256:{channels:1,labels:["ansi256"]},hcg:{channels:3,labels:["h","c","g"]},apple:{channels:3,labels:["r16","g16","b16"]},gray:{channels:1,labels:["gray"]}};var J=Q;for(const u of Object.keys(Q)){if(!("channels"in Q[u]))throw new Error("missing channels property: "+u);if(!("labels"in Q[u]))throw new Error("missing channel labels property: "+u);if(Q[u].labels.length!==Q[u].channels)throw new Error("channel and label counts mismatch: "+u);const{channels:D,labels:e}=Q[u];delete Q[u].channels,delete Q[u].labels,Object.defineProperty(Q[u],"channels",{value:D}),Object.defineProperty(Q[u],"labels",{value:e});}function K(u){const D=function(){const u={},D=Object.keys(J);for(let e=D.length,t=0;t<e;t++)u[D[t]]={distance:-1,parent:null};return u}(),e=[u];for(D[u].distance=0;e.length;){const u=e.pop(),t=Object.keys(J[u]);for(let r=t.length,n=0;n<r;n++){const r=t[n],s=D[r];-1===s.distance&&(s.distance=D[u].distance+1,s.parent=u,e.unshift(r));}}return D}function Z(u,D){return function(e){return D(u(e))}}function X(u,D){const e=[D[u].parent,u];let t=J[D[u].parent][u],r=D[u].parent;for(;D[r].parent;)e.unshift(D[r].parent),t=Z(J[D[r].parent][r],t),r=D[r].parent;return t.conversion=e,t}Q.rgb.hsl=function(u){const D=u[0]/255,e=u[1]/255,t=u[2]/255,r=Math.min(D,e,t),n=Math.max(D,e,t),s=n-r;let o,i;n===r?o=0:D===n?o=(e-t)/s:e===n?o=2+(t-D)/s:t===n&&(o=4+(D-e)/s),o=Math.min(60*o,360),o<0&&(o+=360);const a=(r+n)/2;return i=n===r?0:a<=.5?s/(n+r):s/(2-n-r),[o,100*i,100*a]},Q.rgb.hsv=function(u){let D,e,t,r,n;const s=u[0]/255,o=u[1]/255,i=u[2]/255,a=Math.max(s,o,i),l=a-Math.min(s,o,i),c=function(u){return (a-u)/6/l+.5};return 0===l?(r=0,n=0):(n=l/a,D=c(s),e=c(o),t=c(i),s===a?r=t-e:o===a?r=1/3+D-t:i===a&&(r=2/3+e-D),r<0?r+=1:r>1&&(r-=1)),[360*r,100*n,100*a]},Q.rgb.hwb=function(u){const D=u[0],e=u[1];let t=u[2];const r=Q.rgb.hsl(u)[0],n=1/255*Math.min(D,Math.min(e,t));return t=1-1/255*Math.max(D,Math.max(e,t)),[r,100*n,100*t]},Q.rgb.cmyk=function(u){const D=u[0]/255,e=u[1]/255,t=u[2]/255,r=Math.min(1-D,1-e,1-t);return [100*((1-D-r)/(1-r)||0),100*((1-e-r)/(1-r)||0),100*((1-t-r)/(1-r)||0),100*r]},Q.rgb.keyword=function(u){const D=z[u];if(D)return D;let e,t=1/0;for(const D of Object.keys(G)){const s=(n=G[D],((r=u)[0]-n[0])**2+(r[1]-n[1])**2+(r[2]-n[2])**2);s<t&&(t=s,e=D);}var r,n;return e},Q.keyword.rgb=function(u){return G[u]},Q.rgb.xyz=function(u){let D=u[0]/255,e=u[1]/255,t=u[2]/255;D=D>.04045?((D+.055)/1.055)**2.4:D/12.92,e=e>.04045?((e+.055)/1.055)**2.4:e/12.92,t=t>.04045?((t+.055)/1.055)**2.4:t/12.92;return [100*(.4124*D+.3576*e+.1805*t),100*(.2126*D+.7152*e+.0722*t),100*(.0193*D+.1192*e+.9505*t)]},Q.rgb.lab=function(u){const D=Q.rgb.xyz(u);let e=D[0],t=D[1],r=D[2];e/=95.047,t/=100,r/=108.883,e=e>.008856?e**(1/3):7.787*e+16/116,t=t>.008856?t**(1/3):7.787*t+16/116,r=r>.008856?r**(1/3):7.787*r+16/116;return [116*t-16,500*(e-t),200*(t-r)]},Q.hsl.rgb=function(u){const D=u[0]/360,e=u[1]/100,t=u[2]/100;let r,n,s;if(0===e)return s=255*t,[s,s,s];r=t<.5?t*(1+e):t+e-t*e;const o=2*t-r,i=[0,0,0];for(let u=0;u<3;u++)n=D+1/3*-(u-1),n<0&&n++,n>1&&n--,s=6*n<1?o+6*(r-o)*n:2*n<1?r:3*n<2?o+(r-o)*(2/3-n)*6:o,i[u]=255*s;return i},Q.hsl.hsv=function(u){const D=u[0];let e=u[1]/100,t=u[2]/100,r=e;const n=Math.max(t,.01);t*=2,e*=t<=1?t:2-t,r*=n<=1?n:2-n;return [D,100*(0===t?2*r/(n+r):2*e/(t+e)),100*((t+e)/2)]},Q.hsv.rgb=function(u){const D=u[0]/60,e=u[1]/100;let t=u[2]/100;const r=Math.floor(D)%6,n=D-Math.floor(D),s=255*t*(1-e),o=255*t*(1-e*n),i=255*t*(1-e*(1-n));switch(t*=255,r){case 0:return [t,i,s];case 1:return [o,t,s];case 2:return [s,t,i];case 3:return [s,o,t];case 4:return [i,s,t];case 5:return [t,s,o]}},Q.hsv.hsl=function(u){const D=u[0],e=u[1]/100,t=u[2]/100,r=Math.max(t,.01);let n,s;s=(2-e)*t;const o=(2-e)*r;return n=e*r,n/=o<=1?o:2-o,n=n||0,s/=2,[D,100*n,100*s]},Q.hwb.rgb=function(u){const D=u[0]/360;let e=u[1]/100,t=u[2]/100;const r=e+t;let n;r>1&&(e/=r,t/=r);const s=Math.floor(6*D),o=1-t;n=6*D-s,0!=(1&s)&&(n=1-n);const i=e+n*(o-e);let a,l,c;switch(s){default:case 6:case 0:a=o,l=i,c=e;break;case 1:a=i,l=o,c=e;break;case 2:a=e,l=o,c=i;break;case 3:a=e,l=i,c=o;break;case 4:a=i,l=e,c=o;break;case 5:a=o,l=e,c=i;}return [255*a,255*l,255*c]},Q.cmyk.rgb=function(u){const D=u[0]/100,e=u[1]/100,t=u[2]/100,r=u[3]/100;return [255*(1-Math.min(1,D*(1-r)+r)),255*(1-Math.min(1,e*(1-r)+r)),255*(1-Math.min(1,t*(1-r)+r))]},Q.xyz.rgb=function(u){const D=u[0]/100,e=u[1]/100,t=u[2]/100;let r,n,s;return r=3.2406*D+-1.5372*e+-.4986*t,n=-.9689*D+1.8758*e+.0415*t,s=.0557*D+-.204*e+1.057*t,r=r>.0031308?1.055*r**(1/2.4)-.055:12.92*r,n=n>.0031308?1.055*n**(1/2.4)-.055:12.92*n,s=s>.0031308?1.055*s**(1/2.4)-.055:12.92*s,r=Math.min(Math.max(0,r),1),n=Math.min(Math.max(0,n),1),s=Math.min(Math.max(0,s),1),[255*r,255*n,255*s]},Q.xyz.lab=function(u){let D=u[0],e=u[1],t=u[2];D/=95.047,e/=100,t/=108.883,D=D>.008856?D**(1/3):7.787*D+16/116,e=e>.008856?e**(1/3):7.787*e+16/116,t=t>.008856?t**(1/3):7.787*t+16/116;return [116*e-16,500*(D-e),200*(e-t)]},Q.lab.xyz=function(u){let D,e,t;e=(u[0]+16)/116,D=u[1]/500+e,t=e-u[2]/200;const r=e**3,n=D**3,s=t**3;return e=r>.008856?r:(e-16/116)/7.787,D=n>.008856?n:(D-16/116)/7.787,t=s>.008856?s:(t-16/116)/7.787,D*=95.047,e*=100,t*=108.883,[D,e,t]},Q.lab.lch=function(u){const D=u[0],e=u[1],t=u[2];let r;r=360*Math.atan2(t,e)/2/Math.PI,r<0&&(r+=360);return [D,Math.sqrt(e*e+t*t),r]},Q.lch.lab=function(u){const D=u[0],e=u[1],t=u[2]/360*2*Math.PI;return [D,e*Math.cos(t),e*Math.sin(t)]},Q.rgb.ansi16=function(u,D=null){const[e,t,r]=u;let n=null===D?Q.rgb.hsv(u)[2]:D;if(n=Math.round(n/50),0===n)return 30;let s=30+(Math.round(r/255)<<2|Math.round(t/255)<<1|Math.round(e/255));return 2===n&&(s+=60),s},Q.hsv.ansi16=function(u){return Q.rgb.ansi16(Q.hsv.rgb(u),u[2])},Q.rgb.ansi256=function(u){const D=u[0],e=u[1],t=u[2];if(D===e&&e===t)return D<8?16:D>248?231:Math.round((D-8)/247*24)+232;return 16+36*Math.round(D/255*5)+6*Math.round(e/255*5)+Math.round(t/255*5)},Q.ansi16.rgb=function(u){let D=u%10;if(0===D||7===D)return u>50&&(D+=3.5),D=D/10.5*255,[D,D,D];const e=.5*(1+~~(u>50));return [(1&D)*e*255,(D>>1&1)*e*255,(D>>2&1)*e*255]},Q.ansi256.rgb=function(u){if(u>=232){const D=10*(u-232)+8;return [D,D,D]}let D;u-=16;return [Math.floor(u/36)/5*255,Math.floor((D=u%36)/6)/5*255,D%6/5*255]},Q.rgb.hex=function(u){const D=(((255&Math.round(u[0]))<<16)+((255&Math.round(u[1]))<<8)+(255&Math.round(u[2]))).toString(16).toUpperCase();return "000000".substring(D.length)+D},Q.hex.rgb=function(u){const D=u.toString(16).match(/[a-f0-9]{6}|[a-f0-9]{3}/i);if(!D)return [0,0,0];let e=D[0];3===D[0].length&&(e=e.split("").map(u=>u+u).join(""));const t=parseInt(e,16);return [t>>16&255,t>>8&255,255&t]},Q.rgb.hcg=function(u){const D=u[0]/255,e=u[1]/255,t=u[2]/255,r=Math.max(Math.max(D,e),t),n=Math.min(Math.min(D,e),t),s=r-n;let o,i;return o=s<1?n/(1-s):0,i=s<=0?0:r===D?(e-t)/s%6:r===e?2+(t-D)/s:4+(D-e)/s,i/=6,i%=1,[360*i,100*s,100*o]},Q.hsl.hcg=function(u){const D=u[1]/100,e=u[2]/100,t=e<.5?2*D*e:2*D*(1-e);let r=0;return t<1&&(r=(e-.5*t)/(1-t)),[u[0],100*t,100*r]},Q.hsv.hcg=function(u){const D=u[1]/100,e=u[2]/100,t=D*e;let r=0;return t<1&&(r=(e-t)/(1-t)),[u[0],100*t,100*r]},Q.hcg.rgb=function(u){const D=u[0]/360,e=u[1]/100,t=u[2]/100;if(0===e)return [255*t,255*t,255*t];const r=[0,0,0],n=D%1*6,s=n%1,o=1-s;let i=0;switch(Math.floor(n)){case 0:r[0]=1,r[1]=s,r[2]=0;break;case 1:r[0]=o,r[1]=1,r[2]=0;break;case 2:r[0]=0,r[1]=1,r[2]=s;break;case 3:r[0]=0,r[1]=o,r[2]=1;break;case 4:r[0]=s,r[1]=0,r[2]=1;break;default:r[0]=1,r[1]=0,r[2]=o;}return i=(1-e)*t,[255*(e*r[0]+i),255*(e*r[1]+i),255*(e*r[2]+i)]},Q.hcg.hsv=function(u){const D=u[1]/100,e=D+u[2]/100*(1-D);let t=0;return e>0&&(t=D/e),[u[0],100*t,100*e]},Q.hcg.hsl=function(u){const D=u[1]/100,e=u[2]/100*(1-D)+.5*D;let t=0;return e>0&&e<.5?t=D/(2*e):e>=.5&&e<1&&(t=D/(2*(1-e))),[u[0],100*t,100*e]},Q.hcg.hwb=function(u){const D=u[1]/100,e=D+u[2]/100*(1-D);return [u[0],100*(e-D),100*(1-e)]},Q.hwb.hcg=function(u){const D=u[1]/100,e=1-u[2]/100,t=e-D;let r=0;return t<1&&(r=(e-t)/(1-t)),[u[0],100*t,100*r]},Q.apple.rgb=function(u){return [u[0]/65535*255,u[1]/65535*255,u[2]/65535*255]},Q.rgb.apple=function(u){return [u[0]/255*65535,u[1]/255*65535,u[2]/255*65535]},Q.gray.rgb=function(u){return [u[0]/100*255,u[0]/100*255,u[0]/100*255]},Q.gray.hsl=function(u){return [0,0,u[0]]},Q.gray.hsv=Q.gray.hsl,Q.gray.hwb=function(u){return [0,100,u[0]]},Q.gray.cmyk=function(u){return [0,0,0,u[0]]},Q.gray.lab=function(u){return [u[0],0,0]},Q.gray.hex=function(u){const D=255&Math.round(u[0]/100*255),e=((D<<16)+(D<<8)+D).toString(16).toUpperCase();return "000000".substring(e.length)+e},Q.rgb.gray=function(u){return [(u[0]+u[1]+u[2])/3/255*100]};const uu={};Object.keys(J).forEach(u=>{uu[u]={},Object.defineProperty(uu[u],"channels",{value:J[u].channels}),Object.defineProperty(uu[u],"labels",{value:J[u].labels});const D=function(u){const D=K(u),e={},t=Object.keys(D);for(let u=t.length,r=0;r<u;r++){const u=t[r];null!==D[u].parent&&(e[u]=X(u,D));}return e}(u);Object.keys(D).forEach(e=>{const t=D[e];uu[u][e]=function(u){const D=function(...D){const e=D[0];if(null==e)return e;e.length>1&&(D=e);const t=u(D);if("object"==typeof t)for(let u=t.length,D=0;D<u;D++)t[D]=Math.round(t[D]);return t};return "conversion"in u&&(D.conversion=u.conversion),D}(t),uu[u][e].raw=function(u){const D=function(...D){const e=D[0];return null==e?e:(e.length>1&&(D=e),u(D))};return "conversion"in u&&(D.conversion=u.conversion),D}(t);});});var Du=uu,eu=s((function(u){const D=(u,D)=>(...e)=>`[${u(...e)+D}m`,e=(u,D)=>(...e)=>{const t=u(...e);return `[${38+D};5;${t}m`},t=(u,D)=>(...e)=>{const t=u(...e);return `[${38+D};2;${t[0]};${t[1]};${t[2]}m`},r=u=>u,n=(u,D,e)=>[u,D,e],s=(u,D,e)=>{Object.defineProperty(u,D,{get:()=>{const t=e();return Object.defineProperty(u,D,{value:t,enumerable:!0,configurable:!0}),t},enumerable:!0,configurable:!0});};let o;const i=(u,D,e,t)=>{void 0===o&&(o=Du);const r=t?10:0,n={};for(const[t,s]of Object.entries(o)){const o="ansi16"===t?"ansi":t;t===D?n[o]=u(e,r):"object"==typeof s&&(n[o]=u(s[D],r));}return n};Object.defineProperty(u,"exports",{enumerable:!0,get:function(){const u=new Map,o={modifier:{reset:[0,0],bold:[1,22],dim:[2,22],italic:[3,23],underline:[4,24],inverse:[7,27],hidden:[8,28],strikethrough:[9,29]},color:{black:[30,39],red:[31,39],green:[32,39],yellow:[33,39],blue:[34,39],magenta:[35,39],cyan:[36,39],white:[37,39],blackBright:[90,39],redBright:[91,39],greenBright:[92,39],yellowBright:[93,39],blueBright:[94,39],magentaBright:[95,39],cyanBright:[96,39],whiteBright:[97,39]},bgColor:{bgBlack:[40,49],bgRed:[41,49],bgGreen:[42,49],bgYellow:[43,49],bgBlue:[44,49],bgMagenta:[45,49],bgCyan:[46,49],bgWhite:[47,49],bgBlackBright:[100,49],bgRedBright:[101,49],bgGreenBright:[102,49],bgYellowBright:[103,49],bgBlueBright:[104,49],bgMagentaBright:[105,49],bgCyanBright:[106,49],bgWhiteBright:[107,49]}};o.color.gray=o.color.blackBright,o.bgColor.bgGray=o.bgColor.bgBlackBright,o.color.grey=o.color.blackBright,o.bgColor.bgGrey=o.bgColor.bgBlackBright;for(const[D,e]of Object.entries(o)){for(const[D,t]of Object.entries(e))o[D]={open:`[${t[0]}m`,close:`[${t[1]}m`},e[D]=o[D],u.set(t[0],t[1]);Object.defineProperty(o,D,{value:e,enumerable:!1});}return Object.defineProperty(o,"codes",{value:u,enumerable:!1}),o.color.close="[39m",o.bgColor.close="[49m",s(o.color,"ansi",()=>i(D,"ansi16",r,!1)),s(o.color,"ansi256",()=>i(e,"ansi256",r,!1)),s(o.color,"ansi16m",()=>i(t,"rgb",n,!1)),s(o.bgColor,"ansi",()=>i(D,"ansi16",r,!0)),s(o.bgColor,"ansi256",()=>i(e,"ansi256",r,!0)),s(o.bgColor,"ansi16m",()=>i(t,"rgb",n,!0)),o}});})),tu=(u,D=process.argv)=>{const e=u.startsWith("-")?"":1===u.length?"-":"--",t=D.indexOf(e+u),r=D.indexOf("--");return -1!==t&&(-1===r||t<r)};const{env:ru}=process;let nu;function su(u){return 0!==u&&{level:u,hasBasic:!0,has256:u>=2,has16m:u>=3}}function ou(u,D){if(0===nu)return 0;if(tu("color=16m")||tu("color=full")||tu("color=truecolor"))return 3;if(tu("color=256"))return 2;if(u&&!D&&void 0===nu)return 0;const e=nu||0;if("dumb"===ru.TERM)return e;if("win32"===process.platform){const u=r.release().split(".");return Number(u[0])>=10&&Number(u[2])>=10586?Number(u[2])>=14931?3:2:1}if("CI"in ru)return ["TRAVIS","CIRCLECI","APPVEYOR","GITLAB_CI"].some(u=>u in ru)||"codeship"===ru.CI_NAME?1:e;if("TEAMCITY_VERSION"in ru)return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(ru.TEAMCITY_VERSION)?1:0;if("GITHUB_ACTIONS"in ru)return 1;if("truecolor"===ru.COLORTERM)return 3;if("TERM_PROGRAM"in ru){const u=parseInt((ru.TERM_PROGRAM_VERSION||"").split(".")[0],10);switch(ru.TERM_PROGRAM){case"iTerm.app":return u>=3?3:2;case"Apple_Terminal":return 2}}return /-256(color)?$/i.test(ru.TERM)?2:/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(ru.TERM)||"COLORTERM"in ru?1:e}tu("no-color")||tu("no-colors")||tu("color=false")||tu("color=never")?nu=0:(tu("color")||tu("colors")||tu("color=true")||tu("color=always"))&&(nu=1),"FORCE_COLOR"in ru&&(nu="true"===ru.FORCE_COLOR?1:"false"===ru.FORCE_COLOR?0:0===ru.FORCE_COLOR.length?1:Math.min(parseInt(ru.FORCE_COLOR,10),3));var iu={supportsColor:function(u){return su(ou(u,u&&u.isTTY))},stdout:su(ou(!0,n.isatty(1))),stderr:su(ou(!0,n.isatty(2)))};var au={stringReplaceAll:(u,D,e)=>{let t=u.indexOf(D);if(-1===t)return u;const r=D.length;let n=0,s="";do{s+=u.substr(n,t-n)+D+e,n=t+r,t=u.indexOf(D,n);}while(-1!==t);return s+=u.substr(n),s},stringEncaseCRLFWithFirstIndex:(u,D,e,t)=>{let r=0,n="";do{const s="\r"===u[t-1];n+=u.substr(r,(s?t-1:t)-r)+D+(s?"\r\n":"\n")+e,r=t+1,t=u.indexOf("\n",r);}while(-1!==t);return n+=u.substr(r),n}};const lu=/(?:\\(u(?:[a-f\d]{4}|\{[a-f\d]{1,6}\})|x[a-f\d]{2}|.))|(?:\{(~)?(\w+(?:\([^)]*\))?(?:\.\w+(?:\([^)]*\))?)*)(?:[ \t]|(?=\r?\n)))|(\})|((?:.|[\r\n\f])+?)/gi,cu=/(?:^|\.)(\w+)(?:\(([^)]*)\))?/g,hu=/^(['"])((?:\\.|(?!\1)[^\\])*)\1$/,Fu=/\\(u(?:[a-f\d]{4}|{[a-f\d]{1,6}})|x[a-f\d]{2}|.)|([^\\])/gi,Cu=new Map([["n","\n"],["r","\r"],["t","\t"],["b","\b"],["f","\f"],["v","\v"],["0","\0"],["\\","\\"],["e",""],["a",""]]);function fu(u){const D="u"===u[0],e="{"===u[1];return D&&!e&&5===u.length||"x"===u[0]&&3===u.length?String.fromCharCode(parseInt(u.slice(1),16)):D&&e?String.fromCodePoint(parseInt(u.slice(2,-1),16)):Cu.get(u)||u}function Eu(u,D){const e=[],t=D.trim().split(/\s*,\s*/g);let r;for(const D of t){const t=Number(D);if(Number.isNaN(t)){if(!(r=D.match(hu)))throw new Error(`Invalid Chalk template style argument: ${D} (in style '${u}')`);e.push(r[2].replace(Fu,(u,D,e)=>D?fu(D):e));}else e.push(t);}return e}function gu(u){cu.lastIndex=0;const D=[];let e;for(;null!==(e=cu.exec(u));){const u=e[1];if(e[2]){const t=Eu(u,e[2]);D.push([u].concat(t));}else D.push([u]);}return D}function du(u,D){const e={};for(const u of D)for(const D of u.styles)e[D[0]]=u.inverse?null:D.slice(1);let t=u;for(const[u,D]of Object.entries(e))if(Array.isArray(D)){if(!(u in t))throw new Error("Unknown Chalk style: "+u);t=D.length>0?t[u](...D):t[u];}return t}var pu=(u,D)=>{const e=[],t=[];let r=[];if(D.replace(lu,(D,n,s,o,i,a)=>{if(n)r.push(fu(n));else if(o){const D=r.join("");r=[],t.push(0===e.length?D:du(u,e)(D)),e.push({inverse:s,styles:gu(o)});}else if(i){if(0===e.length)throw new Error("Found extraneous } in Chalk template literal");t.push(du(u,e)(r.join(""))),r=[],e.pop();}else r.push(a);}),t.push(r.join("")),e.length>0){const u=`Chalk template literal is missing ${e.length} closing bracket${1===e.length?"":"s"} (\`}\`)`;throw new Error(u)}return t.join("")};const{stdout:mu,stderr:bu}=iu,{stringReplaceAll:yu,stringEncaseCRLFWithFirstIndex:Bu}=au,vu=["ansi","ansi","ansi256","ansi16m"],_u=Object.create(null);class Au{constructor(u){return wu(u)}}const wu=u=>{const D={};return ((u,D={})=>{if(D.level&&!(Number.isInteger(D.level)&&D.level>=0&&D.level<=3))throw new Error("The `level` option should be an integer from 0 to 3");const e=mu?mu.level:0;u.level=void 0===D.level?e:D.level;})(D,u),D.template=(...u)=>Lu(D.template,...u),Object.setPrototypeOf(D,Ou.prototype),Object.setPrototypeOf(D.template,D),D.template.constructor=()=>{throw new Error("`chalk.constructor()` is deprecated. Use `new chalk.Instance()` instead.")},D.template.Instance=Au,D.template};function Ou(u){return wu(u)}for(const[u,D]of Object.entries(eu))_u[u]={get(){const e=ku(this,Iu(D.open,D.close,this._styler),this._isEmpty);return Object.defineProperty(this,u,{value:e}),e}};_u.visible={get(){const u=ku(this,this._styler,!0);return Object.defineProperty(this,"visible",{value:u}),u}};const Mu=["rgb","hex","keyword","hsl","hsv","hwb","ansi","ansi256"];for(const u of Mu)_u[u]={get(){const{level:D}=this;return function(...e){const t=Iu(eu.color[vu[D]][u](...e),eu.color.close,this._styler);return ku(this,t,this._isEmpty)}}};for(const u of Mu){_u["bg"+u[0].toUpperCase()+u.slice(1)]={get(){const{level:D}=this;return function(...e){const t=Iu(eu.bgColor[vu[D]][u](...e),eu.bgColor.close,this._styler);return ku(this,t,this._isEmpty)}}};}const Su=Object.defineProperties(()=>{},{..._u,level:{enumerable:!0,get(){return this._generator.level},set(u){this._generator.level=u;}}}),Iu=(u,D,e)=>{let t,r;return void 0===e?(t=u,r=D):(t=e.openAll+u,r=D+e.closeAll),{open:u,close:D,openAll:t,closeAll:r,parent:e}},ku=(u,D,e)=>{const t=(...u)=>Ru(t,1===u.length?""+u[0]:u.join(" "));return Object.setPrototypeOf(t,Su),t._generator=u,t._styler=D,t._isEmpty=e,t},Ru=(u,D)=>{if(u.level<=0||!D)return u._isEmpty?"":D;let e=u._styler;if(void 0===e)return D;const{openAll:t,closeAll:r}=e;if(-1!==D.indexOf(""))for(;void 0!==e;)D=yu(D,e.close,e.open),e=e.parent;const n=D.indexOf("\n");return -1!==n&&(D=Bu(D,r,t,n)),t+D+r};let Tu;const Lu=(u,...D)=>{const[e]=D;if(!Array.isArray(e))return D.join(" ");const t=D.slice(1),r=[e.raw[0]];for(let u=1;u<e.length;u++)r.push(String(t[u-1]).replace(/[{}\\]/g,"\\$&"),String(e.raw[u]));return void 0===Tu&&(Tu=pu),Tu(u,r.join(""))};Object.defineProperties(Ou.prototype,_u);const $u=Ou();$u.supportsColor=mu,$u.stderr=Ou({level:bu?bu.level:0}),$u.stderr.supportsColor=bu;var xu=$u;const Uu={};function ju(u){let D=Uu[u];return D||(D="#"===u[0]?xu.hex(u):xu[u]||xu.keyword(u),Uu[u]=D,D)}const Pu={};const Nu={info:"cyan"},qu={0:"red",1:"yellow",2:"white",3:"green"},Yu={secondaryColor:"grey",formatOptions:{date:!0,colors:!0,compact:!1}},Hu={info:H("ℹ"),success:H("✔"),debug:H("›"),trace:H("›"),log:""};class Vu extends S{constructor(u){super(Object.assign({},Yu,u));}formatStack(u){const D=ju("grey"),e=ju("cyan");return "\n"+A(u).map(u=>"  "+u.replace(/^at +/,u=>D(u)).replace(/\((.+)\)/,(u,D)=>`(${e(D)})`)).join("\n")}formatType(u,D){const e=Nu[u.type]||qu[u.level]||this.options.secondaryColor;if(D)return function(u){let D=Pu[u];return D||(D="#"===u[0]?xu.bgHex(u):xu["bg"+u[0].toUpperCase()+u.slice(1)]||xu.bgKeyword(u),Pu[u]=D,D)}(e).black(` ${u.type.toUpperCase()} `);const t="string"==typeof Hu[u.type]?Hu[u.type]:u.icon||u.type;return t?ju(e)(t):""}formatLogObj(u,{width:D}){const[e,...t]=this.formatArgs(u.args).split("\n"),r=void 0!==u.badge?Boolean(u.badge):u.level<2,n=ju(this.options.secondaryColor),s=this.formatDate(u.date),o=s&&n(s),i=this.formatType(u,r),a=u.tag?n(u.tag):"",l=e.replace(/`([^`]+)`/g,(u,D)=>xu.cyan(D));let c;const h=this.filterAndJoin([i,l]),F=this.filterAndJoin([a,o]),C=D-$(h)-$(F)-2;return c=C>0&&D>=80?h+" ".repeat(C)+F:h,c+=t.length?"\n"+t.join("\n"):"",r?"\n"+c+"\n":c}}class Wu{constructor({stream:u}={}){this.stream=u||process.stdout;}log(u){this.stream.write(JSON.stringify(u)+"\n");}}const Gu="undefined"!=typeof __non_webpack_require__?__non_webpack_require__:server$1.commonjsRequire;class zu{constructor(u){if(u&&u.log)this.logger=u;else {const D=Gu("winston");this.logger=D.createLogger(Object.assign({level:"info",format:D.format.simple(),transports:[new D.transports.Console]},u));}}log(u){const D=[].concat(u.args),e=D.shift();this.logger.log({level:Qu[u.level]||"info",label:u.tag,message:e,args:D,timestamp:u.date.getTime()/1e3});}}const Qu={0:"error",1:"warn",2:"info",3:"verbose",4:"debug",5:"silly"};server$1.commonjsGlobal.consola||(server$1.commonjsGlobal.consola=function(){let u=p.debug?4:3;process.env.CONSOLA_LEVEL&&(u=parseInt(process.env.CONSOLA_LEVEL)||u);const D=new _({level:u,reporters:[p.ci||p.test?new S:new Vu]});return D.Consola=_,D.BasicReporter=S,D.FancyReporter=Vu,D.JSONReporter=Wu,D.WinstonReporter=zu,D.LogLevel=m,D}());var Ju=server$1.commonjsGlobal.consola;var consola=Ju;

var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$';
var unsafeChars = /[<>\b\f\n\r\t\0\u2028\u2029]/g;
var reserved = /^(?:do|if|in|for|int|let|new|try|var|byte|case|char|else|enum|goto|long|this|void|with|await|break|catch|class|const|final|float|short|super|throw|while|yield|delete|double|export|import|native|return|switch|throws|typeof|boolean|default|extends|finally|package|private|abstract|continue|debugger|function|volatile|interface|protected|transient|implements|instanceof|synchronized)$/;
var escaped = {
    '<': '\\u003C',
    '>': '\\u003E',
    '/': '\\u002F',
    '\\': '\\\\',
    '\b': '\\b',
    '\f': '\\f',
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t',
    '\0': '\\0',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029'
};
var objectProtoOwnPropertyNames = Object.getOwnPropertyNames(Object.prototype).sort().join('\0');
// workaround to disable warnings, see https://github.com/nuxt/nuxt.js/issues/4026 for details
var defaultLogLevel = process.env.NUXT_ENV_DEVALUE_LOG_LEVEL || 'warn';
var logLimit = parseInt(process.env.NUXT_ENV_DEVALUE_LOG_LIMIT) || 99;
function devalue(value, level) {
    if (level === void 0) { level = defaultLogLevel; }
    var counts = new Map();
    var logNum = 0;
    function log(message) {
        if (logNum < logLimit) {
            consola[level](message);
            logNum += 1;
        }
    }
    function walk(thing) {
        if (typeof thing === 'function') {
            consola[level]("Cannot stringify a function " + thing.name);
            return;
        }
        if (counts.has(thing)) {
            counts.set(thing, counts.get(thing) + 1);
            return;
        }
        counts.set(thing, 1);
        if (!isPrimitive(thing)) {
            var type = getType(thing);
            switch (type) {
                case 'Number':
                case 'String':
                case 'Boolean':
                case 'Date':
                case 'RegExp':
                    return;
                case 'Array':
                    thing.forEach(walk);
                    break;
                case 'Set':
                case 'Map':
                    Array.from(thing).forEach(walk);
                    break;
                default:
                    var proto = Object.getPrototypeOf(thing);
                    if (proto !== Object.prototype &&
                        proto !== null &&
                        Object.getOwnPropertyNames(proto).sort().join('\0') !== objectProtoOwnPropertyNames) {
                        if (typeof thing.toJSON !== "function") {
                            log("Cannot stringify arbitrary non-POJOs " + thing.constructor.name);
                        }
                    }
                    else if (Object.getOwnPropertySymbols(thing).length > 0) {
                        log("Cannot stringify POJOs with symbolic keys " + Object.getOwnPropertySymbols(thing).map(function (symbol) { return symbol.toString(); }));
                    }
                    else {
                        Object.keys(thing).forEach(function (key) { return walk(thing[key]); });
                    }
            }
        }
    }
    walk(value);
    var names = new Map();
    Array.from(counts)
        .filter(function (entry) { return entry[1] > 1; })
        .sort(function (a, b) { return b[1] - a[1]; })
        .forEach(function (entry, i) {
        names.set(entry[0], getName(i));
    });
    function stringify(thing) {
        if (names.has(thing)) {
            return names.get(thing);
        }
        if (isPrimitive(thing)) {
            return stringifyPrimitive(thing);
        }
        var type = getType(thing);
        switch (type) {
            case 'Number':
            case 'String':
            case 'Boolean':
                return "Object(" + stringify(thing.valueOf()) + ")";
            case 'RegExp':
                return thing.toString();
            case 'Date':
                return "new Date(" + thing.getTime() + ")";
            case 'Array':
                var members = thing.map(function (v, i) { return i in thing ? stringify(v) : ''; });
                var tail = thing.length === 0 || (thing.length - 1 in thing) ? '' : ',';
                return "[" + members.join(',') + tail + "]";
            case 'Set':
            case 'Map':
                return "new " + type + "([" + Array.from(thing).map(stringify).join(',') + "])";
            default:
                if (thing.toJSON) {
                    var json = thing.toJSON();
                    if (getType(json) === 'String') {
                        // Try to parse the returned data
                        try {
                            json = JSON.parse(json);
                        }
                        catch (e) { }
                    }
                    return stringify(json);
                }
                if (Object.getPrototypeOf(thing) === null) {
                    if (Object.keys(thing).length === 0) {
                        return 'Object.create(null)';
                    }
                    return "Object.create(null,{" + Object.keys(thing).map(function (key) { return safeKey(key) + ":{writable:true,enumerable:true,value:" + stringify(thing[key]) + "}"; }).join(',') + "})";
                }
                return "{" + Object.keys(thing).map(function (key) { return safeKey(key) + ":" + stringify(thing[key]); }).join(',') + "}";
        }
    }
    var str = stringify(value);
    if (names.size) {
        var params_1 = [];
        var statements_1 = [];
        var values_1 = [];
        names.forEach(function (name, thing) {
            params_1.push(name);
            if (isPrimitive(thing)) {
                values_1.push(stringifyPrimitive(thing));
                return;
            }
            var type = getType(thing);
            switch (type) {
                case 'Number':
                case 'String':
                case 'Boolean':
                    values_1.push("Object(" + stringify(thing.valueOf()) + ")");
                    break;
                case 'RegExp':
                    values_1.push(thing.toString());
                    break;
                case 'Date':
                    values_1.push("new Date(" + thing.getTime() + ")");
                    break;
                case 'Array':
                    values_1.push("Array(" + thing.length + ")");
                    thing.forEach(function (v, i) {
                        statements_1.push(name + "[" + i + "]=" + stringify(v));
                    });
                    break;
                case 'Set':
                    values_1.push("new Set");
                    statements_1.push(name + "." + Array.from(thing).map(function (v) { return "add(" + stringify(v) + ")"; }).join('.'));
                    break;
                case 'Map':
                    values_1.push("new Map");
                    statements_1.push(name + "." + Array.from(thing).map(function (_a) {
                        var k = _a[0], v = _a[1];
                        return "set(" + stringify(k) + ", " + stringify(v) + ")";
                    }).join('.'));
                    break;
                default:
                    values_1.push(Object.getPrototypeOf(thing) === null ? 'Object.create(null)' : '{}');
                    Object.keys(thing).forEach(function (key) {
                        statements_1.push("" + name + safeProp(key) + "=" + stringify(thing[key]));
                    });
            }
        });
        statements_1.push("return " + str);
        return "(function(" + params_1.join(',') + "){" + statements_1.join(';') + "}(" + values_1.join(',') + "))";
    }
    else {
        return str;
    }
}
function getName(num) {
    var name = '';
    do {
        name = chars[num % chars.length] + name;
        num = ~~(num / chars.length) - 1;
    } while (num >= 0);
    return reserved.test(name) ? name + "0" : name;
}
function isPrimitive(thing) {
    return Object(thing) !== thing;
}
function stringifyPrimitive(thing) {
    if (typeof thing === 'string')
        return stringifyString(thing);
    if (thing === void 0)
        return 'void 0';
    if (thing === 0 && 1 / thing < 0)
        return '-0';
    var str = String(thing);
    if (typeof thing === 'number')
        return str.replace(/^(-)?0\./, '$1.');
    return str;
}
function getType(thing) {
    return Object.prototype.toString.call(thing).slice(8, -1);
}
function escapeUnsafeChar(c) {
    return escaped[c] || c;
}
function escapeUnsafeChars(str) {
    return str.replace(unsafeChars, escapeUnsafeChar);
}
function safeKey(key) {
    return /^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(key) ? key : escapeUnsafeChars(JSON.stringify((key)));
}
function safeProp(key) {
    return /^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(key) ? "." + key : "[" + escapeUnsafeChars(JSON.stringify(key)) + "]";
}
function stringifyString(str) {
    var result = '"';
    for (var i = 0; i < str.length; i += 1) {
        var char = str.charAt(i);
        var code = char.charCodeAt(0);
        if (char === '"') {
            result += '\\"';
        }
        else if (char in escaped) {
            result += escaped[char];
        }
        else if (code >= 0xd800 && code <= 0xdfff) {
            var next = str.charCodeAt(i + 1);
            // If this is the beginning of a [high, low] surrogate pair,
            // add the next two characters, otherwise escape
            if (code <= 0xdbff && (next >= 0xdc00 && next <= 0xdfff)) {
                result += char + str[++i];
            }
            else {
                result += "\\u" + code.toString(16).toUpperCase();
            }
        }
        else {
            result += char;
        }
    }
    result += '"';
    return result;
}

var devalue_cjs = devalue;

var build_prod = server$1.createCommonjsModule(function (module, exports) {
Object.defineProperty(exports,"__esModule",{value:!0});var e,t=(e=server$1.proxy)&&"object"==typeof e&&"default"in e?e.default:e,r=Object.freeze({});function n(e){return null==e}function i(e){return null!=e}function o(e){return !0===e}function a(e){return "string"==typeof e||"number"==typeof e||"symbol"==typeof e||"boolean"==typeof e}function s(e){return null!==e&&"object"==typeof e}var c=Object.prototype.toString;function u(e){return "[object Object]"===c.call(e)}function l(e){return i(e)&&"function"==typeof e.then&&"function"==typeof e.catch}function f(e){return null==e?"":Array.isArray(e)||u(e)&&e.toString===c?JSON.stringify(e,null,2):String(e)}function p(e){var t=parseFloat(e);return isNaN(t)?e:t}function d(e,t){for(var r=Object.create(null),n=e.split(","),i=0;i<n.length;i++)r[n[i]]=!0;return t?function(e){return r[e.toLowerCase()]}:function(e){return r[e]}}var v=d("slot,component",!0),h=d("key,ref,slot,slot-scope,is");function m(e,t){if(e.length){var r=e.indexOf(t);if(r>-1)return e.splice(r,1)}}var y=Object.prototype.hasOwnProperty;function g(e,t){return y.call(e,t)}function b(e){var t=Object.create(null);return function(r){return t[r]||(t[r]=e(r))}}var _=/-(\w)/g,w=b(function(e){return e.replace(_,function(e,t){return t?t.toUpperCase():""})}),x=b(function(e){return e.charAt(0).toUpperCase()+e.slice(1)}),S=/\B([A-Z])/g,$=b(function(e){return e.replace(S,"-$1").toLowerCase()});function A(e,t){for(var r in t)e[r]=t[r];return e}function O(e){for(var t={},r=0;r<e.length;r++)e[r]&&A(t,e[r]);return t}function k(e,t,r){}var C=function(e,t,r){return !1},T=function(e){return e};function F(e,t){if(e===t)return !0;var r=s(e),n=s(t);if(!r||!n)return !r&&!n&&String(e)===String(t);try{var i=Array.isArray(e),o=Array.isArray(t);if(i&&o)return e.length===t.length&&e.every(function(e,r){return F(e,t[r])});if(e instanceof Date&&t instanceof Date)return e.getTime()===t.getTime();if(i||o)return !1;var a=Object.keys(e),c=Object.keys(t);return a.length===c.length&&a.every(function(r){return F(e[r],t[r])})}catch(e){return !1}}function j(e,t){for(var r=0;r<e.length;r++)if(F(e[r],t))return r;return -1}var E=d("accept,accept-charset,accesskey,action,align,alt,async,autocomplete,autofocus,autoplay,autosave,bgcolor,border,buffered,challenge,charset,checked,cite,class,code,codebase,color,cols,colspan,content,contenteditable,contextmenu,controls,coords,data,datetime,default,defer,dir,dirname,disabled,download,draggable,dropzone,enctype,for,form,formaction,headers,height,hidden,high,href,hreflang,http-equiv,icon,id,ismap,itemprop,keytype,kind,label,lang,language,list,loop,low,manifest,max,maxlength,media,method,GET,POST,min,multiple,email,file,muted,name,novalidate,open,optimum,pattern,ping,placeholder,poster,preload,radiogroup,readonly,rel,required,reversed,rows,rowspan,sandbox,scope,scoped,seamless,selected,shape,size,type,text,password,sizes,span,spellcheck,src,srcdoc,srclang,srcset,start,step,style,summary,tabindex,target,title,usemap,value,width,wrap"),N=/[>/="'\u0009\u000a\u000c\u0020]/,L=function(e){return N.test(e)},I=function(e){return E(e)||0===e.indexOf("data-")||0===e.indexOf("aria-")},M={acceptCharset:"accept-charset",className:"class",htmlFor:"for",httpEquiv:"http-equiv"},R={"<":"&lt;",">":"&gt;",'"':"&quot;","&":"&amp;"};function D(e){return e.replace(/[<>"&]/g,U)}function U(e){return R[e]||e}var z={"animation-iteration-count":!0,"border-image-outset":!0,"border-image-slice":!0,"border-image-width":!0,"box-flex":!0,"box-flex-group":!0,"box-ordinal-group":!0,"column-count":!0,columns:!0,flex:!0,"flex-grow":!0,"flex-positive":!0,"flex-shrink":!0,"flex-negative":!0,"flex-order":!0,"grid-row":!0,"grid-row-end":!0,"grid-row-span":!0,"grid-row-start":!0,"grid-column":!0,"grid-column-end":!0,"grid-column-span":!0,"grid-column-start":!0,"font-weight":!0,"line-clamp":!0,"line-height":!0,opacity:!0,order:!0,orphans:!0,"tab-size":!0,widows:!0,"z-index":!0,zoom:!0,"fill-opacity":!0,"flood-opacity":!0,"stop-opacity":!0,"stroke-dasharray":!0,"stroke-dashoffset":!0,"stroke-miterlimit":!0,"stroke-opacity":!0,"stroke-width":!0},B=d("input,textarea,option,select,progress"),q=d("contenteditable,draggable,spellcheck"),J=d("events,caret,typing,plaintext-only"),H=function(e,t){return V(t)||"false"===t?"false":"contenteditable"===e&&J(t)?t:"true"},K=d("allowfullscreen,async,autofocus,autoplay,checked,compact,controls,declare,default,defaultchecked,defaultmuted,defaultselected,defer,disabled,enabled,formnovalidate,hidden,indeterminate,inert,ismap,itemscope,loop,multiple,muted,nohref,noresize,noshade,novalidate,nowrap,open,pauseonexit,readonly,required,reversed,scoped,seamless,selected,sortable,translate,truespeed,typemustmatch,visible"),V=function(e){return null==e||!1===e};function W(e,t){if(K(e)){if(!V(t))return " "+e+'="'+e+'"'}else {if(q(e))return " "+e+'="'+D(H(e,t))+'"';if(!V(t))return " "+e+'="'+D(String(t))+'"'}return ""}var Z=function(e,t,r,n,i,o,a,s){this.tag=e,this.data=t,this.children=r,this.text=n,this.elm=i,this.ns=void 0,this.context=o,this.fnContext=void 0,this.fnOptions=void 0,this.fnScopeId=void 0,this.key=t&&t.key,this.componentOptions=a,this.componentInstance=void 0,this.parent=void 0,this.raw=!1,this.isStatic=!1,this.isRootInsert=!0,this.isComment=!1,this.isCloned=!1,this.isOnce=!1,this.asyncFactory=s,this.asyncMeta=void 0,this.isAsyncPlaceholder=!1;},X={child:{configurable:!0}};X.child.get=function(){return this.componentInstance},Object.defineProperties(Z.prototype,X);var G=function(e){void 0===e&&(e="");var t=new Z;return t.text=e,t.isComment=!0,t};function Q(e){return new Z(void 0,void 0,void 0,String(e))}function Y(e,t,r){var n=new Z(void 0,void 0,void 0,t);n.raw=r,e.children=[n];}function ee(e,t,r,n){Object.defineProperty(e,t,{value:r,enumerable:!!n,writable:!0,configurable:!0});}var te,re="__proto__"in{},ne="undefined"!="undefined",ie="undefined"!=typeof WXEnvironment&&!!WXEnvironment.platform;ie&&WXEnvironment.platform.toLowerCase();var ae=ne,se=ae,ue=({}.watch);var fe=function(){return void 0===te&&(te=!ie&&"undefined"!=typeof server$1.commonjsGlobal&&(server$1.commonjsGlobal.process&&"server"===server$1.commonjsGlobal.process.env.VUE_ENV)),te};function pe(e){return "function"==typeof e&&/native code/.test(e.toString())}var de,ve="undefined"!=typeof Symbol&&pe(Symbol)&&"undefined"!=typeof Reflect&&pe(Reflect.ownKeys);de="undefined"!=typeof Set&&pe(Set)?Set:function(){function e(){this.set=Object.create(null);}return e.prototype.has=function(e){return !0===this.set[e]},e.prototype.add=function(e){this.set[e]=!0;},e.prototype.clear=function(){this.set=Object.create(null);},e}();var he="data-server-rendered",me=["beforeCreate","created","beforeMount","mounted","beforeUpdate","updated","beforeDestroy","destroyed","activated","deactivated","errorCaptured","serverPrefetch"],ye={optionMergeStrategies:Object.create(null),silent:!1,productionTip:!1,devtools:!1,performance:!1,errorHandler:null,warnHandler:null,ignoredElements:[],keyCodes:Object.create(null),isReservedTag:C,isReservedAttr:C,isUnknownElement:C,getTagNamespace:k,parsePlatformTagName:T,mustUseProp:C,async:!0,_lifecycleHooks:me},ge=k,be=0,_e=function(){this.id=be++,this.subs=[];};_e.prototype.addSub=function(e){this.subs.push(e);},_e.prototype.removeSub=function(e){m(this.subs,e);},_e.prototype.depend=function(){_e.target&&_e.target.addDep(this);},_e.prototype.notify=function(){for(var e=this.subs.slice(),t=0,r=e.length;t<r;t++)e[t].update();},_e.target=null;var we=[];function xe(e){we.push(e),_e.target=e;}function Se(){we.pop(),_e.target=we[we.length-1];}var $e=Array.prototype,Ae=Object.create($e);["push","pop","shift","unshift","splice","sort","reverse"].forEach(function(e){var t=$e[e];ee(Ae,e,function(){for(var r=[],n=arguments.length;n--;)r[n]=arguments[n];var i,o=t.apply(this,r),a=this.__ob__;switch(e){case"push":case"unshift":i=r;break;case"splice":i=r.slice(2);}return i&&a.observeArray(i),a.dep.notify(),o});});var Oe=Object.getOwnPropertyNames(Ae),ke=!0;function Ce(e){ke=e;}var Te=function(e){var t;this.value=e,this.dep=new _e,this.vmCount=0,ee(e,"__ob__",this),Array.isArray(e)?(re?(t=Ae,e.__proto__=t):function(e,t,r){for(var n=0,i=r.length;n<i;n++){var o=r[n];ee(e,o,t[o]);}}(e,Ae,Oe),this.observeArray(e)):this.walk(e);};function Fe(e,t){var r;if(s(e)&&!(e instanceof Z))return g(e,"__ob__")&&e.__ob__ instanceof Te?r=e.__ob__:ke&&!fe()&&(Array.isArray(e)||u(e))&&Object.isExtensible(e)&&!e._isVue&&(r=new Te(e)),t&&r&&r.vmCount++,r}function je(e,t,r,n,i){var o=new _e,a=Object.getOwnPropertyDescriptor(e,t);if(!a||!1!==a.configurable){var s=a&&a.get,c=a&&a.set;s&&!c||2!==arguments.length||(r=e[t]);var u=!i&&Fe(r);Object.defineProperty(e,t,{enumerable:!0,configurable:!0,get:function(){var t=s?s.call(e):r;return _e.target&&(o.depend(),u&&(u.dep.depend(),Array.isArray(t)&&function e(t){for(var r=void 0,n=0,i=t.length;n<i;n++)(r=t[n])&&r.__ob__&&r.__ob__.dep.depend(),Array.isArray(r)&&e(r);}(t))),t},set:function(t){var n=s?s.call(e):r;t===n||t!=t&&n!=n||s&&!c||(c?c.call(e,t):r=t,u=!i&&Fe(t),o.notify());}});}}function Pe(e,t,r){if(Array.isArray(e)&&function(e){var t=parseFloat(String(e));return t>=0&&Math.floor(t)===t&&isFinite(e)}(t))return e.length=Math.max(e.length,t),e.splice(t,1,r),r;if(t in e&&!(t in Object.prototype))return e[t]=r,r;var n=e.__ob__;return e._isVue||n&&n.vmCount?r:n?(je(n.value,t,r),n.dep.notify(),r):(e[t]=r,r)}Te.prototype.walk=function(e){for(var t=Object.keys(e),r=0;r<t.length;r++)je(e,t[r]);},Te.prototype.observeArray=function(e){for(var t=0,r=e.length;t<r;t++)Fe(e[t]);};var Ee=ye.optionMergeStrategies;function Ne(e,t){if(!t)return e;for(var r,n,i,o=ve?Reflect.ownKeys(t):Object.keys(t),a=0;a<o.length;a++)"__ob__"!==(r=o[a])&&(n=e[r],i=t[r],g(e,r)?n!==i&&u(n)&&u(i)&&Ne(n,i):Pe(e,r,i));return e}function Le(e,t,r){return r?function(){var n="function"==typeof t?t.call(r,r):t,i="function"==typeof e?e.call(r,r):e;return n?Ne(n,i):i}:t?e?function(){return Ne("function"==typeof t?t.call(this,this):t,"function"==typeof e?e.call(this,this):e)}:t:e}function Ie(e,t){var r=t?e?e.concat(t):Array.isArray(t)?t:[t]:e;return r?function(e){for(var t=[],r=0;r<e.length;r++)-1===t.indexOf(e[r])&&t.push(e[r]);return t}(r):r}function Me(e,t,r,n){var i=Object.create(e||null);return t?A(i,t):i}Ee.data=function(e,t,r){return r?Le(e,t,r):t&&"function"!=typeof t?e:Le(e,t)},me.forEach(function(e){Ee[e]=Ie;}),["component","directive","filter"].forEach(function(e){Ee[e+"s"]=Me;}),Ee.watch=function(e,t,r,n){if(e===ue&&(e=void 0),t===ue&&(t=void 0),!t)return Object.create(e||null);if(!e)return t;var i={};for(var o in A(i,e),t){var a=i[o],s=t[o];a&&!Array.isArray(a)&&(a=[a]),i[o]=a?a.concat(s):Array.isArray(s)?s:[s];}return i},Ee.props=Ee.methods=Ee.inject=Ee.computed=function(e,t,r,n){if(!e)return t;var i=Object.create(null);return A(i,e),t&&A(i,t),i},Ee.provide=Le;var Re=function(e,t){return void 0===t?e:t};function De(e,t,r){if("function"==typeof t&&(t=t.options),function(e,t){var r=e.props;if(r){var n,i,o={};if(Array.isArray(r))for(n=r.length;n--;)"string"==typeof(i=r[n])&&(o[w(i)]={type:null});else if(u(r))for(var a in r)i=r[a],o[w(a)]=u(i)?i:{type:i};e.props=o;}}(t),function(e,t){var r=e.inject;if(r){var n=e.inject={};if(Array.isArray(r))for(var i=0;i<r.length;i++)n[r[i]]={from:r[i]};else if(u(r))for(var o in r){var a=r[o];n[o]=u(a)?A({from:o},a):{from:a};}}}(t),function(e){var t=e.directives;if(t)for(var r in t){var n=t[r];"function"==typeof n&&(t[r]={bind:n,update:n});}}(t),!t._base&&(t.extends&&(e=De(e,t.extends,r)),t.mixins))for(var n=0,i=t.mixins.length;n<i;n++)e=De(e,t.mixins[n],r);var o,a={};for(o in e)s(o);for(o in t)g(e,o)||s(o);function s(n){var i=Ee[n]||Re;a[n]=i(e[n],t[n],r,n);}return a}function Ue(e,t,r,n){if("string"==typeof r){var i=e[t];if(g(i,r))return i[r];var o=w(r);if(g(i,o))return i[o];var a=x(o);return g(i,a)?i[a]:i[r]||i[o]||i[a]}}function ze(e,t,r,n){var i=t[e],o=!g(r,e),a=r[e],s=Je(Boolean,i.type);if(s>-1)if(o&&!g(i,"default"))a=!1;else if(""===a||a===$(e)){var c=Je(String,i.type);(c<0||s<c)&&(a=!0);}if(void 0===a){a=function(e,t,r){if(!g(t,"default"))return;var n=t.default;if(e&&e.$options.propsData&&void 0===e.$options.propsData[r]&&void 0!==e._props[r])return e._props[r];return "function"==typeof n&&"Function"!==Be(t.type)?n.call(e):n}(n,i,e);var u=ke;Ce(!0),Fe(a),Ce(u);}return a}function Be(e){var t=e&&e.toString().match(/^\s*function (\w+)/);return t?t[1]:""}function qe(e,t){return Be(e)===Be(t)}function Je(e,t){if(!Array.isArray(t))return qe(t,e)?0:-1;for(var r=0,n=t.length;r<n;r++)if(qe(t[r],e))return r;return -1}function He(e,t,r){xe();try{if(t)for(var n=t;n=n.$parent;){var i=n.$options.errorCaptured;if(i)for(var o=0;o<i.length;o++)try{if(!1===i[o].call(n,e,t,r))return}catch(e){Ve(e,n,"errorCaptured hook");}}Ve(e,t,r);}finally{Se();}}function Ke(e,t,r,n,i){var o;try{(o=r?e.apply(t,r):e.call(t))&&!o._isVue&&l(o)&&!o._handled&&(o.catch(function(e){return He(e,n,i+" (Promise/async)")}),o._handled=!0);}catch(e){He(e,n,i);}return o}function Ve(e,t,r){!function(e,t,r){if(!ie||"undefined"==typeof console)throw e;console.error(e);}(e);}var We=[];if("undefined"!=typeof Promise&&pe(Promise));else if("undefined"==typeof MutationObserver||!pe(MutationObserver)&&"[object MutationObserverConstructor]"!==MutationObserver.toString())"undefined"!=typeof setImmediate&&pe(setImmediate);else {var Ze=new MutationObserver(function(){var e=We.slice(0);We.length=0;for(var t=0;t<e.length;t++)e[t]();}),Xe=document.createTextNode(String(1));Ze.observe(Xe,{characterData:!0});}function Ge(e,t){return {staticClass:Ye(e.staticClass,t.staticClass),class:i(e.class)?[e.class,t.class]:t.class}}function Qe(e,t){return i(e)||i(t)?Ye(e,et(t)):""}function Ye(e,t){return e?t?e+" "+t:e:t||""}function et(e){return Array.isArray(e)?function(e){for(var t,r="",n=0,o=e.length;n<o;n++)i(t=et(e[n]))&&""!==t&&(r&&(r+=" "),r+=t);return r}(e):s(e)?function(e){var t="";for(var r in e)e[r]&&(t&&(t+=" "),t+=r);return t}(e):"string"==typeof e?e:""}var tt=d("html,body,base,head,link,meta,style,title,address,article,aside,footer,header,h1,h2,h3,h4,h5,h6,hgroup,nav,section,div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby,s,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,output,progress,select,textarea,details,dialog,menu,menuitem,summary,content,element,shadow,template,blockquote,iframe,tfoot"),rt=d("svg,animate,circle,clippath,cursor,defs,desc,ellipse,filter,font-face,foreignObject,g,glyph,image,line,marker,mask,missing-glyph,path,pattern,polygon,polyline,rect,switch,symbol,text,textpath,tspan,use,view",!0);var nt=b(function(e){var t={},r=/:(.+)/;return e.split(/;(?![^(]*\))/g).forEach(function(e){if(e){var n=e.split(r);n.length>1&&(t[n[0].trim()]=n[1].trim());}}),t});function it(e){var t=ot(e.style);return e.staticStyle?A(e.staticStyle,t):t}function ot(e){return Array.isArray(e)?O(e):"string"==typeof e?nt(e):e}function at(e){var t="";for(var r in e){var n=e[r],i=$(r);if(Array.isArray(n))for(var o=0,a=n.length;o<a;o++)t+=st(i,n[o]);else t+=st(i,n);}return t}function st(e,t){return "string"==typeof t||"number"==typeof t&&z[e]||0===t?e+":"+t+";":""}var ct=[function(e){var t=e.data.attrs,r="",o=e.parent&&e.parent.componentOptions;if(n(o)||!1!==o.Ctor.options.inheritAttrs)for(var a=e.parent;i(a);)i(a.data)&&i(a.data.attrs)&&(t=A(A({},t),a.data.attrs)),a=a.parent;if(n(t))return r;for(var s in t)L(s)||"style"!==s&&(r+=W(s,t[s]));return r},function(e){for(var t=e.data.domProps,r="",o=e.parent;i(o);)o.data&&o.data.domProps&&(t=A(A({},t),o.data.domProps)),o=o.parent;if(n(t))return r;var a=e.data.attrs;for(var s in t)if("innerHTML"===s)Y(e,t[s],!0);else if("textContent"===s)Y(e,t[s],!1);else if("value"===s&&"textarea"===e.tag)Y(e,t[s],!1);else {var c=M[s]||s.toLowerCase();!I(c)||i(a)&&i(a[c])||(r+=W(c,t[s]));}return r},function(e){var t=function(e){for(var t=e.data,r=e,n=e;i(n.componentInstance);)(n=n.componentInstance._vnode)&&n.data&&(t=Ge(n.data,t));for(;i(r=r.parent);)r&&r.data&&(t=Ge(t,r.data));return Qe(t.staticClass,t.class)}(e);if(""!==t)return ' class="'+D(t)+'"'},function(e){var t=at(function(e,t){var r,n={};if(t)for(var i=e;i.componentInstance;)(i=i.componentInstance._vnode)&&i.data&&(r=it(i.data))&&A(n,r);(r=it(e.data))&&A(n,r);for(var o=e;o=o.parent;)o.data&&(r=it(o.data))&&A(n,r);return n}(e,!1));if(""!==t)return " style="+JSON.stringify(D(t))}];function ut(e){var t=e.data||{};return t.attrs&&t.attrs.value||t.domProps&&t.domProps.value||e.children&&e.children[0]&&e.children[0].text}function lt(e){var t=e.data||(e.data={});(t.attrs||(t.attrs={})).selected="";}var ft={show:function(e,t){if(!t.value){var r=e.data.style||(e.data.style={});Array.isArray(r)?r.push({display:"none"}):r.display="none";}},model:function(e,t){if(e.children)for(var r=t.value,n=e.data.attrs&&e.data.attrs.multiple,i=0,o=e.children.length;i<o;i++){var a=e.children[i];if("option"===a.tag)if(n)Array.isArray(r)&&j(r,ut(a))>-1&&lt(a);else if(F(r,ut(a)))return void lt(a)}}},pt=d("area,base,br,col,embed,frame,hr,img,input,isindex,keygen,link,meta,param,source,track,wbr"),dt=d("colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source"),vt=d("address,article,aside,base,blockquote,body,caption,col,colgroup,dd,details,dialog,div,dl,dt,fieldset,figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,head,header,hgroup,hr,html,legend,li,menuitem,meta,optgroup,option,param,rp,rt,source,style,summary,tbody,td,tfoot,th,thead,title,tr,track"),ht=800,mt=function(e){return e},yt="undefined"!=typeof process&&process.nextTick?process.nextTick:"undefined"!=typeof Promise?function(e){return Promise.resolve().then(e)}:"undefined"!=typeof setTimeout?setTimeout:mt;if(yt===mt)throw new Error("Your JavaScript runtime does not support any asynchronous primitives that are required by vue-server-renderer. Please use a polyfill for either Promise or setTimeout.");function gt(e,t){var r=0,n=function(i,o){i&&n.caching&&(n.cacheBuffer[n.cacheBuffer.length-1]+=i),!0!==e(i,o)&&(r>=ht?yt(function(){try{o();}catch(e){t(e);}}):(r++,o(),r--));};return n.caching=!1,n.cacheBuffer=[],n.componentBuffer=[],n}var bt=function(e){function t(t){var r=this;e.call(this),this.buffer="",this.render=t,this.expectedSize=0,this.write=gt(function(e,t){var n=r.expectedSize;return r.buffer+=e,r.buffer.length>=n&&(r.next=t,r.pushBySize(n),!0)},function(e){r.emit("error",e);}),this.end=function(){r.emit("beforeEnd"),r.done=!0,r.push(r.buffer);};}return e&&(t.__proto__=e),t.prototype=Object.create(e&&e.prototype),t.prototype.constructor=t,t.prototype.pushBySize=function(e){var t=this.buffer.substring(0,e);this.buffer=this.buffer.substring(e),this.push(t);},t.prototype.tryRender=function(){try{this.render(this.write,this.end);}catch(e){this.emit("error",e);}},t.prototype.tryNext=function(){try{this.next();}catch(e){this.emit("error",e);}},t.prototype._read=function(e){this.expectedSize=e,o(this.done)?this.push(null):this.buffer.length>=e?this.pushBySize(e):n(this.next)?this.tryRender():this.tryNext();},t}(Stream__default['default'].Readable),_t=function(e){this.userContext=e.userContext,this.activeInstance=e.activeInstance,this.renderStates=[],this.write=e.write,this.done=e.done,this.renderNode=e.renderNode,this.isUnaryTag=e.isUnaryTag,this.modules=e.modules,this.directives=e.directives;var t=e.cache;if(t&&(!t.get||!t.set))throw new Error("renderer cache must implement at least get & set.");this.cache=t,this.get=t&&wt(t,"get"),this.has=t&&wt(t,"has"),this.next=this.next.bind(this);};function wt(e,t){var r=e[t];return n(r)?void 0:r.length>1?function(t,n){return r.call(e,t,n)}:function(t,n){return n(r.call(e,t))}}_t.prototype.next=function(){for(;;){var e=this.renderStates[this.renderStates.length-1];if(n(e))return this.done();switch(e.type){case"Element":case"Fragment":var t=e.children,r=e.total,i=e.rendered++;if(i<r)return this.renderNode(t[i],!1,this);if(this.renderStates.pop(),"Element"===e.type)return this.write(e.endTag,this.next);break;case"Component":this.renderStates.pop(),this.activeInstance=e.prevActive;break;case"ComponentWithCache":this.renderStates.pop();var o=e.buffer,a=e.bufferIndex,s=e.componentBuffer,c=e.key,u={html:o[a],components:s[a]};if(this.cache.set(c,u),0===a)this.write.caching=!1;else {o[a-1]+=u.html;var l=s[a-1];u.components.forEach(function(e){return l.add(e)});}o.length=a,s.length=a;}}};var xt=/[\w).+\-_$\]]/;function St(e){var t,r,n,i,o,a=!1,s=!1,c=!1,u=!1,l=0,f=0,p=0,d=0;for(n=0;n<e.length;n++)if(r=t,t=e.charCodeAt(n),a)39===t&&92!==r&&(a=!1);else if(s)34===t&&92!==r&&(s=!1);else if(c)96===t&&92!==r&&(c=!1);else if(u)47===t&&92!==r&&(u=!1);else if(124!==t||124===e.charCodeAt(n+1)||124===e.charCodeAt(n-1)||l||f||p){switch(t){case 34:s=!0;break;case 39:a=!0;break;case 96:c=!0;break;case 40:p++;break;case 41:p--;break;case 91:f++;break;case 93:f--;break;case 123:l++;break;case 125:l--;}if(47===t){for(var v=n-1,h=void 0;v>=0&&" "===(h=e.charAt(v));v--);h&&xt.test(h)||(u=!0);}}else void 0===i?(d=n+1,i=e.slice(0,n).trim()):m();function m(){(o||(o=[])).push(e.slice(d,n).trim()),d=n+1;}if(void 0===i?i=e.slice(0,n).trim():0!==d&&m(),o)for(n=0;n<o.length;n++)i=$t(i,o[n]);return i}function $t(e,t){var r=t.indexOf("(");if(r<0)return '_f("'+t+'")('+e+")";var n=t.slice(0,r),i=t.slice(r+1);return '_f("'+n+'")('+e+(")"!==i?","+i:i)}var At=/\{\{((?:.|\r?\n)+?)\}\}/g,Ot=/[-.*+?^${}()|[\]\/\\]/g,kt=b(function(e){var t=e[0].replace(Ot,"\\$&"),r=e[1].replace(Ot,"\\$&");return new RegExp(t+"((?:.|\\n)+?)"+r,"g")});function Ct(e,t){console.error("[Vue compiler]: "+e);}function Tt(e,t){return e?e.map(function(e){return e[t]}).filter(function(e){return e}):[]}function Ft(e,t,r,n,i){(e.props||(e.props=[])).push(Dt({name:t,value:r,dynamic:i},n)),e.plain=!1;}function jt(e,t,r,n,i){(i?e.dynamicAttrs||(e.dynamicAttrs=[]):e.attrs||(e.attrs=[])).push(Dt({name:t,value:r,dynamic:i},n)),e.plain=!1;}function Pt(e,t,r,n){e.attrsMap[t]=r,e.attrsList.push(Dt({name:t,value:r},n));}function Et(e,t,r,n,i,o,a,s){(e.directives||(e.directives=[])).push(Dt({name:t,rawName:r,value:n,arg:i,isDynamicArg:o,modifiers:a},s)),e.plain=!1;}function Nt(e,t,r){return r?"_p("+t+',"'+e+'")':e+t}function Lt(e,t,n,i,o,a,s,c){var u;(i=i||r).right?c?t="("+t+")==='click'?'contextmenu':("+t+")":"click"===t&&(t="contextmenu",delete i.right):i.middle&&(c?t="("+t+")==='click'?'mouseup':("+t+")":"click"===t&&(t="mouseup")),i.capture&&(delete i.capture,t=Nt("!",t,c)),i.once&&(delete i.once,t=Nt("~",t,c)),i.passive&&(delete i.passive,t=Nt("&",t,c)),i.native?(delete i.native,u=e.nativeEvents||(e.nativeEvents={})):u=e.events||(e.events={});var l=Dt({value:n.trim(),dynamic:c},s);i!==r&&(l.modifiers=i);var f=u[t];Array.isArray(f)?o?f.unshift(l):f.push(l):u[t]=f?o?[l,f]:[f,l]:l,e.plain=!1;}function It(e,t,r){var n=Mt(e,":"+t)||Mt(e,"v-bind:"+t);if(null!=n)return St(n);if(!1!==r){var i=Mt(e,t);if(null!=i)return JSON.stringify(i)}}function Mt(e,t,r){var n;if(null!=(n=e.attrsMap[t]))for(var i=e.attrsList,o=0,a=i.length;o<a;o++)if(i[o].name===t){i.splice(o,1);break}return r&&delete e.attrsMap[t],n}function Rt(e,t){for(var r=e.attrsList,n=0,i=r.length;n<i;n++){var o=r[n];if(t.test(o.name))return r.splice(n,1),o}}function Dt(e,t){return t&&(null!=t.start&&(e.start=t.start),null!=t.end&&(e.end=t.end)),e}var Ut={staticKeys:["staticClass"],transformNode:function(e,t){t.warn;var r=Mt(e,"class");r&&(e.staticClass=JSON.stringify(r));var n=It(e,"class",!1);n&&(e.classBinding=n);},genData:function(e){var t="";return e.staticClass&&(t+="staticClass:"+e.staticClass+","),e.classBinding&&(t+="class:"+e.classBinding+","),t}};var zt,Bt,qt,Jt,Ht,Kt,Vt={staticKeys:["staticStyle"],transformNode:function(e,t){t.warn;var r=Mt(e,"style");r&&(e.staticStyle=JSON.stringify(nt(r)));var n=It(e,"style",!1);n&&(e.styleBinding=n);},genData:function(e){var t="";return e.staticStyle&&(t+="staticStyle:"+e.staticStyle+","),e.styleBinding&&(t+="style:("+e.styleBinding+"),"),t}},Wt=/^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/,Zt=/^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/,Xt="[a-zA-Z_][\\-\\.0-9_a-zA-Z"+/a-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD/.source+"]*",Gt="((?:"+Xt+"\\:)?"+Xt+")",Qt=new RegExp("^<"+Gt),Yt=/^\s*(\/?)>/,er=new RegExp("^<\\/"+Gt+"[^>]*>"),tr=/^<!DOCTYPE [^>]+>/i,rr=/^<!\--/,nr=/^<!\[/,ir=d("script,style,textarea",!0),or={},ar={"&lt;":"<","&gt;":">","&quot;":'"',"&amp;":"&","&#10;":"\n","&#9;":"\t","&#39;":"'"},sr=/&(?:lt|gt|quot|amp|#39);/g,cr=/&(?:lt|gt|quot|amp|#39|#10|#9);/g,ur=d("pre,textarea",!0),lr=function(e,t){return e&&ur(e)&&"\n"===t[0]};function fr(e,t){var r=t?cr:sr;return e.replace(r,function(e){return ar[e]})}function pr(e,t,r){var n=r||{},i=n.number,o="$$v";n.trim&&(o="(typeof $$v === 'string'? $$v.trim(): $$v)"),i&&(o="_n("+o+")");var a=dr(t,o);e.model={value:"("+t+")",expression:JSON.stringify(t),callback:"function ($$v) {"+a+"}"};}function dr(e,t){var r=function(e){if(e=e.trim(),zt=e.length,e.indexOf("[")<0||e.lastIndexOf("]")<zt-1)return (Jt=e.lastIndexOf("."))>-1?{exp:e.slice(0,Jt),key:'"'+e.slice(Jt+1)+'"'}:{exp:e,key:null};Bt=e,Jt=Ht=Kt=0;for(;!hr();)mr(qt=vr())?gr(qt):91===qt&&yr(qt);return {exp:e.slice(0,Ht),key:e.slice(Ht+1,Kt)}}(e);return null===r.key?e+"="+t:"$set("+r.exp+", "+r.key+", "+t+")"}function vr(){return Bt.charCodeAt(++Jt)}function hr(){return Jt>=zt}function mr(e){return 34===e||39===e}function yr(e){var t=1;for(Ht=Jt;!hr();)if(mr(e=vr()))gr(e);else if(91===e&&t++,93===e&&t--,0===t){Kt=Jt;break}}function gr(e){for(var t=e;!hr()&&(e=vr())!==t;);}var br,_r,wr,xr,Sr,$r,Ar,Or,kr=/^@|^v-on:/,Cr=/^v-|^@|^:|^#/,Tr=/([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/,Fr=/,([^,\}\]]*)(?:,([^,\}\]]*))?$/,jr=/^\(|\)$/g,Pr=/^\[.*\]$/,Er=/:(.*)$/,Nr=/^:|^\.|^v-bind:/,Lr=/\.[^.\]]+(?=[^\]]*$)/g,Ir=/^v-slot(:|$)|^#/,Mr=/[\r\n]/,Rr=/\s+/g,Dr=b(t.decode),Ur="_empty_";function zr(e,t,r){return {type:1,tag:e,attrsList:t,attrsMap:Wr(t),rawAttrsMap:{},parent:r,children:[]}}function Br(e,t){br=t.warn||Ct,$r=t.isPreTag||C,Ar=t.mustUseProp||C,Or=t.getTagNamespace||C;t.isReservedTag;wr=Tt(t.modules,"transformNode"),xr=Tt(t.modules,"preTransformNode"),Sr=Tt(t.modules,"postTransformNode"),_r=t.delimiters;var r,n,i=[],o=!1!==t.preserveWhitespace,a=t.whitespace,s=!1,c=!1;function u(e){if(l(e),s||e.processed||(e=qr(e,t)),i.length||e===r||r.if&&(e.elseif||e.else)&&Hr(r,{exp:e.elseif,block:e}),n&&!e.forbidden)if(e.elseif||e.else)a=e,(u=function(e){var t=e.length;for(;t--;){if(1===e[t].type)return e[t];e.pop();}}(n.children))&&u.if&&Hr(u,{exp:a.elseif,block:a});else {if(e.slotScope){var o=e.slotTarget||'"default"';(n.scopedSlots||(n.scopedSlots={}))[o]=e;}n.children.push(e),e.parent=n;}var a,u;e.children=e.children.filter(function(e){return !e.slotScope}),l(e),e.pre&&(s=!1),$r(e.tag)&&(c=!1);for(var f=0;f<Sr.length;f++)Sr[f](e,t);}function l(e){if(!c)for(var t;(t=e.children[e.children.length-1])&&3===t.type&&" "===t.text;)e.children.pop();}return function(e,t){for(var r,n,i=[],o=t.expectHTML,a=t.isUnaryTag||C,s=t.canBeLeftOpenTag||C,c=0;e;){if(r=e,n&&ir(n)){var u=0,l=n.toLowerCase(),f=or[l]||(or[l]=new RegExp("([\\s\\S]*?)(</"+l+"[^>]*>)","i")),p=e.replace(f,function(e,r,n){return u=n.length,ir(l)||"noscript"===l||(r=r.replace(/<!\--([\s\S]*?)-->/g,"$1").replace(/<!\[CDATA\[([\s\S]*?)]]>/g,"$1")),lr(l,r)&&(r=r.slice(1)),t.chars&&t.chars(r),""});c+=e.length-p.length,e=p,O(l,c-u,c);}else {var d=e.indexOf("<");if(0===d){if(rr.test(e)){var v=e.indexOf("--\x3e");if(v>=0){t.shouldKeepComment&&t.comment(e.substring(4,v),c,c+v+3),S(v+3);continue}}if(nr.test(e)){var h=e.indexOf("]>");if(h>=0){S(h+2);continue}}var m=e.match(tr);if(m){S(m[0].length);continue}var y=e.match(er);if(y){var g=c;S(y[0].length),O(y[1],g,c);continue}var b=$();if(b){A(b),lr(b.tagName,e)&&S(1);continue}}var _=void 0,w=void 0,x=void 0;if(d>=0){for(w=e.slice(d);!(er.test(w)||Qt.test(w)||rr.test(w)||nr.test(w)||(x=w.indexOf("<",1))<0);)d+=x,w=e.slice(d);_=e.substring(0,d);}d<0&&(_=e),_&&S(_.length),t.chars&&_&&t.chars(_,c-_.length,c);}if(e===r){t.chars&&t.chars(e);break}}function S(t){c+=t,e=e.substring(t);}function $(){var t=e.match(Qt);if(t){var r,n,i={tagName:t[1],attrs:[],start:c};for(S(t[0].length);!(r=e.match(Yt))&&(n=e.match(Zt)||e.match(Wt));)n.start=c,S(n[0].length),n.end=c,i.attrs.push(n);if(r)return i.unarySlash=r[1],S(r[0].length),i.end=c,i}}function A(e){var r=e.tagName,c=e.unarySlash;o&&("p"===n&&vt(r)&&O(n),s(r)&&n===r&&O(r));for(var u=a(r)||!!c,l=e.attrs.length,f=new Array(l),p=0;p<l;p++){var d=e.attrs[p],v=d[3]||d[4]||d[5]||"",h="a"===r&&"href"===d[1]?t.shouldDecodeNewlinesForHref:t.shouldDecodeNewlines;f[p]={name:d[1],value:fr(v,h)};}u||(i.push({tag:r,lowerCasedTag:r.toLowerCase(),attrs:f,start:e.start,end:e.end}),n=r),t.start&&t.start(r,f,u,e.start,e.end);}function O(e,r,o){var a,s;if(null==r&&(r=c),null==o&&(o=c),e)for(s=e.toLowerCase(),a=i.length-1;a>=0&&i[a].lowerCasedTag!==s;a--);else a=0;if(a>=0){for(var u=i.length-1;u>=a;u--)t.end&&t.end(i[u].tag,r,o);i.length=a,n=a&&i[a-1].tag;}else "br"===s?t.start&&t.start(e,[],!0,r,o):"p"===s&&(t.start&&t.start(e,[],!1,r,o),t.end&&t.end(e,r,o));}O();}(e,{warn:br,expectHTML:t.expectHTML,isUnaryTag:t.isUnaryTag,canBeLeftOpenTag:t.canBeLeftOpenTag,shouldDecodeNewlines:t.shouldDecodeNewlines,shouldDecodeNewlinesForHref:t.shouldDecodeNewlinesForHref,shouldKeepComment:t.comments,outputSourceRange:t.outputSourceRange,start:function(e,o,a,l,f){var p=n&&n.ns||Or(e);var d,v=zr(e,o,n);p&&(v.ns=p),"style"!==(d=v).tag&&("script"!==d.tag||d.attrsMap.type&&"text/javascript"!==d.attrsMap.type)||fe()||(v.forbidden=!0);for(var h=0;h<xr.length;h++)v=xr[h](v,t)||v;s||(!function(e){null!=Mt(e,"v-pre")&&(e.pre=!0);}(v),v.pre&&(s=!0)),$r(v.tag)&&(c=!0),s?function(e){var t=e.attrsList,r=t.length;if(r)for(var n=e.attrs=new Array(r),i=0;i<r;i++)n[i]={name:t[i].name,value:JSON.stringify(t[i].value)},null!=t[i].start&&(n[i].start=t[i].start,n[i].end=t[i].end);else e.pre||(e.plain=!0);}(v):v.processed||(Jr(v),function(e){var t=Mt(e,"v-if");if(t)e.if=t,Hr(e,{exp:t,block:e});else {null!=Mt(e,"v-else")&&(e.else=!0);var r=Mt(e,"v-else-if");r&&(e.elseif=r);}}(v),function(e){null!=Mt(e,"v-once")&&(e.once=!0);}(v)),r||(r=v),a?u(v):(n=v,i.push(v));},end:function(e,t,r){var o=i[i.length-1];i.length-=1,n=i[i.length-1],u(o);},chars:function(e,t,r){if(n&&(!se)){var i,u,l,f=n.children;if(e=c||e.trim()?"script"===(i=n).tag||"style"===i.tag?e:Dr(e):f.length?a?"condense"===a&&Mr.test(e)?"":" ":o?" ":"":"")c||"condense"!==a||(e=e.replace(Rr," ")),!s&&" "!==e&&(u=function(e,t){var r=t?kt(t):At;if(r.test(e)){for(var n,i,o,a=[],s=[],c=r.lastIndex=0;n=r.exec(e);){(i=n.index)>c&&(s.push(o=e.slice(c,i)),a.push(JSON.stringify(o)));var u=St(n[1].trim());a.push("_s("+u+")"),s.push({"@binding":u}),c=i+n[0].length;}return c<e.length&&(s.push(o=e.slice(c)),a.push(JSON.stringify(o))),{expression:a.join("+"),tokens:s}}}(e,_r))?l={type:2,expression:u.expression,tokens:u.tokens,text:e}:" "===e&&f.length&&" "===f[f.length-1].text||(l={type:3,text:e}),l&&f.push(l);}},comment:function(e,t,r){if(n){var i={type:3,text:e,isComment:!0};n.children.push(i);}}}),r}function qr(e,t){var r,n;(n=It(r=e,"key"))&&(r.key=n),e.plain=!e.key&&!e.scopedSlots&&!e.attrsList.length,function(e){var t=It(e,"ref");t&&(e.ref=t,e.refInFor=function(e){var t=e;for(;t;){if(void 0!==t.for)return !0;t=t.parent;}return !1}(e));}(e),function(e){var t;"template"===e.tag?(t=Mt(e,"scope"),e.slotScope=t||Mt(e,"slot-scope")):(t=Mt(e,"slot-scope"))&&(e.slotScope=t);var r=It(e,"slot");r&&(e.slotTarget='""'===r?'"default"':r,e.slotTargetDynamic=!(!e.attrsMap[":slot"]&&!e.attrsMap["v-bind:slot"]),"template"===e.tag||e.slotScope||jt(e,"slot",r,function(e,t){return e.rawAttrsMap[":"+t]||e.rawAttrsMap["v-bind:"+t]||e.rawAttrsMap[t]}(e,"slot")));if("template"===e.tag){var n=Rt(e,Ir);if(n){var i=Kr(n),o=i.name,a=i.dynamic;e.slotTarget=o,e.slotTargetDynamic=a,e.slotScope=n.value||Ur;}}else {var s=Rt(e,Ir);if(s){var c=e.scopedSlots||(e.scopedSlots={}),u=Kr(s),l=u.name,f=u.dynamic,p=c[l]=zr("template",[],e);p.slotTarget=l,p.slotTargetDynamic=f,p.children=e.children.filter(function(e){if(!e.slotScope)return e.parent=p,!0}),p.slotScope=s.value||Ur,e.children=[],e.plain=!1;}}}(e),function(e){"slot"===e.tag&&(e.slotName=It(e,"name"));}(e),function(e){var t;(t=It(e,"is"))&&(e.component=t);null!=Mt(e,"inline-template")&&(e.inlineTemplate=!0);}(e);for(var i=0;i<wr.length;i++)e=wr[i](e,t)||e;return function(e){var t,r,n,i,o,a,s,c,u=e.attrsList;for(t=0,r=u.length;t<r;t++)if(n=i=u[t].name,o=u[t].value,Cr.test(n))if(e.hasBindings=!0,(a=Vr(n.replace(Cr,"")))&&(n=n.replace(Lr,"")),Nr.test(n))n=n.replace(Nr,""),o=St(o),(c=Pr.test(n))&&(n=n.slice(1,-1)),a&&(a.prop&&!c&&"innerHtml"===(n=w(n))&&(n="innerHTML"),a.camel&&!c&&(n=w(n)),a.sync&&(s=dr(o,"$event"),c?Lt(e,'"update:"+('+n+")",s,null,!1,0,u[t],!0):(Lt(e,"update:"+w(n),s,null,!1,0,u[t]),$(n)!==w(n)&&Lt(e,"update:"+$(n),s,null,!1,0,u[t])))),a&&a.prop||!e.component&&Ar(e.tag,e.attrsMap.type,n)?Ft(e,n,o,u[t],c):jt(e,n,o,u[t],c);else if(kr.test(n))n=n.replace(kr,""),(c=Pr.test(n))&&(n=n.slice(1,-1)),Lt(e,n,o,a,!1,0,u[t],c);else {var l=(n=n.replace(Cr,"")).match(Er),f=l&&l[1];c=!1,f&&(n=n.slice(0,-(f.length+1)),Pr.test(f)&&(f=f.slice(1,-1),c=!0)),Et(e,n,i,o,f,c,a,u[t]);}else jt(e,n,JSON.stringify(o),u[t]),!e.component&&"muted"===n&&Ar(e.tag,e.attrsMap.type,n)&&Ft(e,n,"true",u[t]);}(e),e}function Jr(e){var t;if(t=Mt(e,"v-for")){var r=function(e){var t=e.match(Tr);if(!t)return;var r={};r.for=t[2].trim();var n=t[1].trim().replace(jr,""),i=n.match(Fr);i?(r.alias=n.replace(Fr,"").trim(),r.iterator1=i[1].trim(),i[2]&&(r.iterator2=i[2].trim())):r.alias=n;return r}(t);r&&A(e,r);}}function Hr(e,t){e.ifConditions||(e.ifConditions=[]),e.ifConditions.push(t);}function Kr(e){var t=e.name.replace(Ir,"");return t||"#"!==e.name[0]&&(t="default"),Pr.test(t)?{name:t.slice(1,-1),dynamic:!0}:{name:'"'+t+'"',dynamic:!1}}function Vr(e){var t=e.match(Lr);if(t){var r={};return t.forEach(function(e){r[e.slice(1)]=!0;}),r}}function Wr(e){for(var t={},r=0,n=e.length;r<n;r++)t[e[r].name]=e[r].value;return t}function Gr(e){return zr(e.tag,e.attrsList.slice(),e.parent)}var Qr=[Ut,Vt,{preTransformNode:function(e,t){if("input"===e.tag){var r,n=e.attrsMap;if(!n["v-model"])return;if((n[":type"]||n["v-bind:type"])&&(r=It(e,"type")),n.type||r||!n["v-bind"]||(r="("+n["v-bind"]+").type"),r){var i=Mt(e,"v-if",!0),o=i?"&&("+i+")":"",a=null!=Mt(e,"v-else",!0),s=Mt(e,"v-else-if",!0),c=Gr(e);Jr(c),Pt(c,"type","checkbox"),qr(c,t),c.processed=!0,c.if="("+r+")==='checkbox'"+o,Hr(c,{exp:c.if,block:c});var u=Gr(e);Mt(u,"v-for",!0),Pt(u,"type","radio"),qr(u,t),Hr(c,{exp:"("+r+")==='radio'"+o,block:u});var l=Gr(e);return Mt(l,"v-for",!0),Pt(l,":type",r),qr(l,t),Hr(c,{exp:i,block:l}),a?c.else=!0:s&&(c.elseif=s),c}}}}],Yr="__r";var en={expectHTML:!0,modules:Qr,directives:{model:function(e,t,r){var n=t.value,i=t.modifiers,o=e.tag,a=e.attrsMap.type;if(e.component)return pr(e,n,i),!1;if("select"===o)!function(e,t,r){var n='var $$selectedVal = Array.prototype.filter.call($event.target.options,function(o){return o.selected}).map(function(o){var val = "_value" in o ? o._value : o.value;return '+(r&&r.number?"_n(val)":"val")+"});";n=n+" "+dr(t,"$event.target.multiple ? $$selectedVal : $$selectedVal[0]"),Lt(e,"change",n,null,!0);}(e,n,i);else if("input"===o&&"checkbox"===a)!function(e,t,r){var n=r&&r.number,i=It(e,"value")||"null",o=It(e,"true-value")||"true",a=It(e,"false-value")||"false";Ft(e,"checked","Array.isArray("+t+")?_i("+t+","+i+")>-1"+("true"===o?":("+t+")":":_q("+t+","+o+")")),Lt(e,"change","var $$a="+t+",$$el=$event.target,$$c=$$el.checked?("+o+"):("+a+");if(Array.isArray($$a)){var $$v="+(n?"_n("+i+")":i)+",$$i=_i($$a,$$v);if($$el.checked){$$i<0&&("+dr(t,"$$a.concat([$$v])")+")}else{$$i>-1&&("+dr(t,"$$a.slice(0,$$i).concat($$a.slice($$i+1))")+")}}else{"+dr(t,"$$c")+"}",null,!0);}(e,n,i);else if("input"===o&&"radio"===a)!function(e,t,r){var n=r&&r.number,i=It(e,"value")||"null";Ft(e,"checked","_q("+t+","+(i=n?"_n("+i+")":i)+")"),Lt(e,"change",dr(t,i),null,!0);}(e,n,i);else {if("input"!==o&&"textarea"!==o)return pr(e,n,i),!1;!function(e,t,r){var n=e.attrsMap.type,i=r||{},o=i.lazy,a=i.number,s=i.trim,c=!o&&"range"!==n,u=o?"change":"range"===n?Yr:"input",l="$event.target.value";s&&(l="$event.target.value.trim()"),a&&(l="_n("+l+")");var f=dr(t,l);c&&(f="if($event.target.composing)return;"+f),Ft(e,"value","("+t+")"),Lt(e,u,f,null,!0),(s||a)&&Lt(e,"blur","$forceUpdate()");}(e,n,i);}return !0},text:function(e,t){t.value&&Ft(e,"textContent","_s("+t.value+")",t);},html:function(e,t){t.value&&Ft(e,"innerHTML","_s("+t.value+")",t);}},isPreTag:function(e){return "pre"===e},isUnaryTag:pt,mustUseProp:function(e,t,r){return "value"===r&&B(e)&&"button"!==t||"selected"===r&&"option"===e||"checked"===r&&"input"===e||"muted"===r&&"video"===e},canBeLeftOpenTag:dt,isReservedTag:function(e){return tt(e)||rt(e)},getTagNamespace:function(e){return rt(e)?"svg":"math"===e?"math":void 0},staticKeys:function(e){return e.reduce(function(e,t){return e.concat(t.staticKeys||[])},[]).join(",")}(Qr)},tn=/^([\w$_]+|\([^)]*?\))\s*=>|^function(?:\s+[\w$]+)?\s*\(/,rn=/\([^)]*?\);*$/,nn=/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['[^']*?']|\["[^"]*?"]|\[\d+]|\[[A-Za-z_$][\w$]*])*$/,on={esc:27,tab:9,enter:13,space:32,up:38,left:37,right:39,down:40,delete:[8,46]},an={esc:["Esc","Escape"],tab:"Tab",enter:"Enter",space:[" ","Spacebar"],up:["Up","ArrowUp"],left:["Left","ArrowLeft"],right:["Right","ArrowRight"],down:["Down","ArrowDown"],delete:["Backspace","Delete","Del"]},sn=function(e){return "if("+e+")return null;"},cn={stop:"$event.stopPropagation();",prevent:"$event.preventDefault();",self:sn("$event.target !== $event.currentTarget"),ctrl:sn("!$event.ctrlKey"),shift:sn("!$event.shiftKey"),alt:sn("!$event.altKey"),meta:sn("!$event.metaKey"),left:sn("'button' in $event && $event.button !== 0"),middle:sn("'button' in $event && $event.button !== 1"),right:sn("'button' in $event && $event.button !== 2")};function un(e,t){var r=t?"nativeOn:":"on:",n="",i="";for(var o in e){var a=ln(e[o]);e[o]&&e[o].dynamic?i+=o+","+a+",":n+='"'+o+'":'+a+",";}return n="{"+n.slice(0,-1)+"}",i?r+"_d("+n+",["+i.slice(0,-1)+"])":r+n}function ln(e){if(!e)return "function(){}";if(Array.isArray(e))return "["+e.map(function(e){return ln(e)}).join(",")+"]";var t=nn.test(e.value),r=tn.test(e.value),n=nn.test(e.value.replace(rn,""));if(e.modifiers){var i="",o="",a=[];for(var s in e.modifiers)if(cn[s])o+=cn[s],on[s]&&a.push(s);else if("exact"===s){var c=e.modifiers;o+=sn(["ctrl","shift","alt","meta"].filter(function(e){return !c[e]}).map(function(e){return "$event."+e+"Key"}).join("||"));}else a.push(s);return a.length&&(i+=function(e){return "if(!$event.type.indexOf('key')&&"+e.map(fn).join("&&")+")return null;"}(a)),o&&(i+=o),"function($event){"+i+(t?"return "+e.value+"($event)":r?"return ("+e.value+")($event)":n?"return "+e.value:e.value)+"}"}return t||r?e.value:"function($event){"+(n?"return "+e.value:e.value)+"}"}function fn(e){var t=parseInt(e,10);if(t)return "$event.keyCode!=="+t;var r=on[e],n=an[e];return "_k($event.keyCode,"+JSON.stringify(e)+","+JSON.stringify(r)+",$event.key,"+JSON.stringify(n)+")"}var pn={on:function(e,t){e.wrapListeners=function(e){return "_g("+e+","+t.value+")"};},bind:function(e,t){e.wrapData=function(r){return "_b("+r+",'"+e.tag+"',"+t.value+","+(t.modifiers&&t.modifiers.prop?"true":"false")+(t.modifiers&&t.modifiers.sync?",true":"")+")"};},cloak:k},dn=function(e){this.options=e,this.warn=e.warn||Ct,this.transforms=Tt(e.modules,"transformCode"),this.dataGenFns=Tt(e.modules,"genData"),this.directives=A(A({},pn),e.directives);var t=e.isReservedTag||C;this.maybeComponent=function(e){return !!e.component||!t(e.tag)},this.onceId=0,this.staticRenderFns=[],this.pre=!1;};function vn(e,t){if(e.parent&&(e.pre=e.pre||e.parent.pre),e.staticRoot&&!e.staticProcessed)return hn(e,t);if(e.once&&!e.onceProcessed)return mn(e,t);if(e.for&&!e.forProcessed)return gn(e,t);if(e.if&&!e.ifProcessed)return yn(e,t);if("template"!==e.tag||e.slotTarget||t.pre){if("slot"===e.tag)return function(e,t){var r=e.slotName||'"default"',n=xn(e,t),i="_t("+r+(n?","+n:""),o=e.attrs||e.dynamicAttrs?On((e.attrs||[]).concat(e.dynamicAttrs||[]).map(function(e){return {name:w(e.name),value:e.value,dynamic:e.dynamic}})):null,a=e.attrsMap["v-bind"];!o&&!a||n||(i+=",null");o&&(i+=","+o);a&&(i+=(o?"":",null")+","+a);return i+")"}(e,t);var r;if(e.component)r=function(e,t,r){var n=t.inlineTemplate?null:xn(t,r,!0);return "_c("+e+","+bn(t,r)+(n?","+n:"")+")"}(e.component,e,t);else {var n;(!e.plain||e.pre&&t.maybeComponent(e))&&(n=bn(e,t));var i=e.inlineTemplate?null:xn(e,t,!0);r="_c('"+e.tag+"'"+(n?","+n:"")+(i?","+i:"")+")";}for(var o=0;o<t.transforms.length;o++)r=t.transforms[o](e,r);return r}return xn(e,t)||"void 0"}function hn(e,t){e.staticProcessed=!0;var r=t.pre;return e.pre&&(t.pre=e.pre),t.staticRenderFns.push("with(this){return "+vn(e,t)+"}"),t.pre=r,"_m("+(t.staticRenderFns.length-1)+(e.staticInFor?",true":"")+")"}function mn(e,t){if(e.onceProcessed=!0,e.if&&!e.ifProcessed)return yn(e,t);if(e.staticInFor){for(var r="",n=e.parent;n;){if(n.for){r=n.key;break}n=n.parent;}return r?"_o("+vn(e,t)+","+t.onceId+++","+r+")":vn(e,t)}return hn(e,t)}function yn(e,t,r,n){return e.ifProcessed=!0,function e(t,r,n,i){if(!t.length)return i||"_e()";var o=t.shift();return o.exp?"("+o.exp+")?"+a(o.block)+":"+e(t,r,n,i):""+a(o.block);function a(e){return n?n(e,r):e.once?mn(e,r):vn(e,r)}}(e.ifConditions.slice(),t,r,n)}function gn(e,t,r,n){var i=e.for,o=e.alias,a=e.iterator1?","+e.iterator1:"",s=e.iterator2?","+e.iterator2:"";return e.forProcessed=!0,(n||"_l")+"(("+i+"),function("+o+a+s+"){return "+(r||vn)(e,t)+"})"}function bn(e,t){var r="{",n=function(e,t){var r=e.directives;if(!r)return;var n,i,o,a,s="directives:[",c=!1;for(n=0,i=r.length;n<i;n++){o=r[n],a=!0;var u=t.directives[o.name];u&&(a=!!u(e,o,t.warn)),a&&(c=!0,s+='{name:"'+o.name+'",rawName:"'+o.rawName+'"'+(o.value?",value:("+o.value+"),expression:"+JSON.stringify(o.value):"")+(o.arg?",arg:"+(o.isDynamicArg?o.arg:'"'+o.arg+'"'):"")+(o.modifiers?",modifiers:"+JSON.stringify(o.modifiers):"")+"},");}if(c)return s.slice(0,-1)+"]"}(e,t);n&&(r+=n+","),e.key&&(r+="key:"+e.key+","),e.ref&&(r+="ref:"+e.ref+","),e.refInFor&&(r+="refInFor:true,"),e.pre&&(r+="pre:true,"),e.component&&(r+='tag:"'+e.tag+'",');for(var i=0;i<t.dataGenFns.length;i++)r+=t.dataGenFns[i](e);if(e.attrs&&(r+="attrs:"+On(e.attrs)+","),e.props&&(r+="domProps:"+On(e.props)+","),e.events&&(r+=un(e.events,!1)+","),e.nativeEvents&&(r+=un(e.nativeEvents,!0)+","),e.slotTarget&&!e.slotScope&&(r+="slot:"+e.slotTarget+","),e.scopedSlots&&(r+=function(e,t,r){var n=e.for||Object.keys(t).some(function(e){var r=t[e];return r.slotTargetDynamic||r.if||r.for||_n(r)}),i=!!e.if;if(!n)for(var o=e.parent;o;){if(o.slotScope&&o.slotScope!==Ur||o.for){n=!0;break}o.if&&(i=!0),o=o.parent;}var a=Object.keys(t).map(function(e){return wn(t[e],r)}).join(",");return "scopedSlots:_u(["+a+"]"+(n?",null,true":"")+(!n&&i?",null,false,"+function(e){var t=5381,r=e.length;for(;r;)t=33*t^e.charCodeAt(--r);return t>>>0}(a):"")+")"}(e,e.scopedSlots,t)+","),e.model&&(r+="model:{value:"+e.model.value+",callback:"+e.model.callback+",expression:"+e.model.expression+"},"),e.inlineTemplate){var o=function(e,t){var r=e.children[0];if(r&&1===r.type){var n=function(e,t){var r=new dn(t);return {render:"with(this){return "+(e?vn(e,r):'_c("div")')+"}",staticRenderFns:r.staticRenderFns}}(r,t.options);return "inlineTemplate:{render:function(){"+n.render+"},staticRenderFns:["+n.staticRenderFns.map(function(e){return "function(){"+e+"}"}).join(",")+"]}"}}(e,t);o&&(r+=o+",");}return r=r.replace(/,$/,"")+"}",e.dynamicAttrs&&(r="_b("+r+',"'+e.tag+'",'+On(e.dynamicAttrs)+")"),e.wrapData&&(r=e.wrapData(r)),e.wrapListeners&&(r=e.wrapListeners(r)),r}function _n(e){return 1===e.type&&("slot"===e.tag||e.children.some(_n))}function wn(e,t){var r=e.attrsMap["slot-scope"];if(e.if&&!e.ifProcessed&&!r)return yn(e,t,wn,"null");if(e.for&&!e.forProcessed)return gn(e,t,wn);var n=e.slotScope===Ur?"":String(e.slotScope),i="function("+n+"){return "+("template"===e.tag?e.if&&r?"("+e.if+")?"+(xn(e,t)||"undefined")+":undefined":xn(e,t)||"undefined":vn(e,t))+"}",o=n?"":",proxy:true";return "{key:"+(e.slotTarget||'"default"')+",fn:"+i+o+"}"}function xn(e,t,r,n,i){var o=e.children;if(o.length){var a=o[0];if(1===o.length&&a.for&&"template"!==a.tag&&"slot"!==a.tag){var s=r?t.maybeComponent(a)?",1":",0":"";return ""+(n||vn)(a,t)+s}var c=r?function(e,t){for(var r=0,n=0;n<e.length;n++){var i=e[n];if(1===i.type){if(Sn(i)||i.ifConditions&&i.ifConditions.some(function(e){return Sn(e.block)})){r=2;break}(t(i)||i.ifConditions&&i.ifConditions.some(function(e){return t(e.block)}))&&(r=1);}}return r}(o,t.maybeComponent):0,u=i||$n;return "["+o.map(function(e){return u(e,t)}).join(",")+"]"+(c?","+c:"")}}function Sn(e){return void 0!==e.for||"template"===e.tag||"slot"===e.tag}function $n(e,t){return 1===e.type?vn(e,t):3===e.type&&e.isComment?(r=e,"_e("+JSON.stringify(r.text)+")"):An(e);var r;}function An(e){return "_v("+(2===e.type?e.expression:kn(JSON.stringify(e.text)))+")"}function On(e){for(var t="",r="",n=0;n<e.length;n++){var i=e[n],o=kn(i.value);i.dynamic?r+=i.name+","+o+",":t+='"'+i.name+'":'+o+",";}return t="{"+t.slice(0,-1)+"}",r?"_d("+t+",["+r.slice(0,-1)+"])":t}function kn(e){return e.replace(/\u2028/g,"\\u2028").replace(/\u2029/g,"\\u2029")}var Cn=/^"(?:[^"\\]|\\.)*"$|^'(?:[^'\\]|\\.)*'$/;function Tn(e,t){return Cn.test(t)?(t=t.replace(/^'|'$/g,'"'),q(e)&&'"false"'!==t&&(t='"true"'),{type:Nn,value:K(e)?" "+e+'="'+e+'"':'""'===t?" "+e:" "+e+'="'+JSON.parse(t)+'"'}):{type:In,value:"_ssrAttr("+JSON.stringify(e)+","+t+")"}}var Fn,jn={FALSE:0,FULL:1,SELF:2,CHILDREN:3,PARTIAL:4};function Pn(e,t){e&&(Fn=t.isReservedTag||C,function e(t,r){if(function(e){if(2===e.type||3===e.type)return !1;return v(e.tag)||!Fn(e.tag)||!!e.component||function(e){return 1===e.type&&"select"===e.tag&&null!=e.directives&&e.directives.some(function(e){return "model"===e.name})}(e)}(t))return void(t.ssrOptimizability=jn.FALSE);var n=r||function(e){return 1===e.type&&e.directives&&e.directives.some(function(e){return !En(e.name)})}(t);var i=function(e){e.ssrOptimizability!==jn.FULL&&(t.ssrOptimizability=n?jn.PARTIAL:jn.SELF);};n&&(t.ssrOptimizability=jn.CHILDREN);if(1===t.type){for(var o=0,a=t.children.length;o<a;o++){var s=t.children[o];e(s),i(s);}if(t.ifConditions)for(var c=1,u=t.ifConditions.length;c<u;c++){var l=t.ifConditions[c].block;e(l,r),i(l);}null==t.ssrOptimizability||!r&&(t.attrsMap["v-html"]||t.attrsMap["v-text"])?t.ssrOptimizability=jn.FULL:t.children=function(e){for(var t=e.children,r=[],n=[],i=function(){n.length&&r.push({type:1,parent:e,tag:"template",attrsList:[],attrsMap:{},rawAttrsMap:{},children:n,ssrOptimizability:jn.FULL}),n=[];},o=0;o<t.length;o++){var a=t[o];a.ssrOptimizability===jn.FULL?n.push(a):(i(),r.push(a));}return i(),r}(t);}else t.ssrOptimizability=jn.FULL;}(e,!0));}var En=d("text,html,show,on,bind,model,pre,cloak,once");var Nn=0,Ln=1,In=2;function Mn(e,t){if(e.for&&!e.forProcessed)return gn(e,t,Mn);if(e.if&&!e.ifProcessed)return yn(e,t,Mn);if("template"===e.tag&&!e.slotTarget)return e.ssrOptimizability===jn.FULL?zn(e,t):Dn(e,t)||"void 0";switch(e.ssrOptimizability){case jn.FULL:return function(e,t){return "_ssrNode("+Bn(e,t)+")"}(e,t);case jn.SELF:return function(e,t){var r=Dn(e,t,!0);return "_ssrNode("+Kn(Jn(e,t))+',"</'+e.tag+'>"'+(r?","+r:"")+")"}(e,t);case jn.CHILDREN:return Rn(e,t,!0);case jn.PARTIAL:return Rn(e,t,!1);default:return vn(e,t)}}function Rn(e,t,r){var n=e.plain?void 0:bn(e,t),i=r?"["+zn(e,t)+"]":Dn(e,t,!0);return "_c('"+e.tag+"'"+(n?","+n:"")+(i?","+i:"")+")"}function Dn(e,t,r){return xn(e,t,r,Mn,Un)}function Un(e,t){return 1===e.type?Mn(e,t):An(e)}function zn(e,t){return e.children.length?"_ssrNode("+Kn(Hn(e,t))+")":""}function Bn(e,t){return "("+Kn(qn(e,t))+")"}function qn(e,t){if(e.for&&!e.forProcessed)return e.forProcessed=!0,[{type:In,value:gn(e,t,Bn,"_ssrList")}];if(e.if&&!e.ifProcessed)return e.ifProcessed=!0,[{type:In,value:yn(e,t,Bn,'"\x3c!----\x3e"')}];if("template"===e.tag)return Hn(e,t);var r=Jn(e,t),n=Hn(e,t),i=t.options.isUnaryTag,o=i&&i(e.tag)?[]:[{type:Nn,value:"</"+e.tag+">"}];return r.concat(n,o)}function Jn(e,t){var r;!function(e,t){if(e.directives)for(var r=0;r<e.directives.length;r++){var n=e.directives[r];if("model"===n.name){t.directives.model(e,n,t.warn),"textarea"===e.tag&&e.props&&(e.props=e.props.filter(function(e){return "value"!==e.name}));break}}}(e,t);var n,i,o,a,s,c,u=[{type:Nn,value:"<"+e.tag}];return e.attrs&&u.push.apply(u,e.attrs.map(function(e){return Tn(e.name,e.value)})),e.props&&u.push.apply(u,function(e,t){var r=[];return e.forEach(function(e){var n=e.name,i=e.value;n=M[n]||n.toLowerCase(),!I(n)||t&&t.some(function(e){return e.name===n})||r.push(Tn(n,i));}),r}(e.props,e.attrs)),(r=e.attrsMap["v-bind"])&&u.push({type:In,value:"_ssrAttrs("+r+")"}),(r=e.attrsMap["v-bind.prop"])&&u.push({type:In,value:"_ssrDOMProps("+r+")"}),(e.staticClass||e.classBinding)&&u.push.apply(u,(n=e.staticClass,i=e.classBinding,n&&!i?[{type:Nn,value:' class="'+JSON.parse(n)+'"'}]:[{type:In,value:"_ssrClass("+(n||"null")+","+(i||"null")+")"}])),(e.staticStyle||e.styleBinding||e.attrsMap["v-show"])&&u.push.apply(u,(o=e.attrsMap.style,a=e.staticStyle,s=e.styleBinding,c=e.attrsMap["v-show"],!o||s||c?[{type:In,value:"_ssrStyle("+(a||"null")+","+(s||"null")+", "+(c?"{ display: ("+c+") ? '' : 'none' }":"null")+")"}]:[{type:Nn,value:" style="+JSON.stringify(o)}])),t.options.scopeId&&u.push({type:Nn,value:" "+t.options.scopeId}),u.push({type:Nn,value:">"}),u}function Hn(e,t){var r;return (r=e.attrsMap["v-html"])?[{type:In,value:"_s("+r+")"}]:(r=e.attrsMap["v-text"])?[{type:Ln,value:"_s("+r+")"}]:"textarea"===e.tag&&(r=e.attrsMap["v-model"])?[{type:Ln,value:"_s("+r+")"}]:e.children?function(e,t){for(var r=[],n=0;n<e.length;n++){var i=e[n];if(1===i.type)r.push.apply(r,qn(i,t));else if(2===i.type)r.push({type:Ln,value:i.expression});else if(3===i.type){var o=D(i.text);i.isComment&&(o="\x3c!--"+o+"--\x3e"),r.push({type:Nn,value:o});}}return r}(e.children,t):[]}function Kn(e){for(var t=[],r="",n=function(){r&&(t.push(JSON.stringify(r)),r="");},i=0;i<e.length;i++){var o=e[i];o.type===Nn?r+=o.value:o.type===Ln?(n(),t.push("_ssrEscape("+o.value+")")):o.type===In&&(n(),t.push("("+o.value+")"));}return n(),t.join("+")}function Vn(e,t){try{return new Function(e)}catch(r){return t.push({err:r,code:e}),k}}function Wn(e){var t=Object.create(null);return function(r,n,i){(n=A({},n)).warn;delete n.warn;var o=n.delimiters?String(n.delimiters)+r:r;if(t[o])return t[o];var a=e(r,n),s={},c=[];return s.render=Vn(a.render,c),s.staticRenderFns=a.staticRenderFns.map(function(e){return Vn(e,c)}),t[o]=s}}var Zn,Xn=(Zn=function(e,t){var r=Br(e.trim(),t);Pn(r,t);var n=function(e,t){var r=new dn(t);return {render:"with(this){return "+(e?Mn(e,r):'_c("div")')+"}",staticRenderFns:r.staticRenderFns}}(r,t);return {ast:r,render:n.render,staticRenderFns:n.staticRenderFns}},function(e){function t(t,r){var n=Object.create(e),i=[],o=[];if(r)for(var a in r.modules&&(n.modules=(e.modules||[]).concat(r.modules)),r.directives&&(n.directives=A(Object.create(e.directives||null),r.directives)),r)"modules"!==a&&"directives"!==a&&(n[a]=r[a]);n.warn=function(e,t,r){(r?o:i).push(e);};var s=Zn(t.trim(),n);return s.errors=i,s.tips=o,s}return {compile:t,compileToFunctions:Wn(t)}})(en),Gn=(Xn.compile,Xn.compileToFunctions);function Qn(e){for(var t=0;t<e.length;t++)if(Array.isArray(e[t]))return Array.prototype.concat.apply([],e);return e}function Yn(e){return a(e)?[Q(e)]:Array.isArray(e)?function e(t,r){var s=[];var c,u,l,f;for(c=0;c<t.length;c++)n(u=t[c])||"boolean"==typeof u||(l=s.length-1,f=s[l],Array.isArray(u)?u.length>0&&(ei((u=e(u,(r||"")+"_"+c))[0])&&ei(f)&&(s[l]=Q(f.text+u[0].text),u.shift()),s.push.apply(s,u)):a(u)?ei(f)?s[l]=Q(f.text+u):""!==u&&s.push(Q(u)):ei(u)&&ei(f)?s[l]=Q(f.text+u.text):(o(t._isVList)&&i(u.tag)&&n(u.key)&&i(r)&&(u.key="__vlist"+r+"_"+c+"__"),s.push(u)));return s}(e):void 0}function ei(e){return i(e)&&i(e.text)&&!1===e.isComment}var ti={_ssrEscape:D,_ssrNode:function(e,t,r,n){return new ri(e,t,r,n)},_ssrList:function(e,t){var r,n,i,o,a="";if(Array.isArray(e)||"string"==typeof e)for(r=0,n=e.length;r<n;r++)a+=t(e[r],r);else if("number"==typeof e)for(r=0;r<e;r++)a+=t(r+1,r);else if(s(e))for(i=Object.keys(e),r=0,n=i.length;r<n;r++)o=i[r],a+=t(e[o],o,r);return a},_ssrAttr:W,_ssrAttrs:function(e){var t="";for(var r in e)L(r)||(t+=W(r,e[r]));return t},_ssrDOMProps:function(e){var t="";for(var r in e){var n=M[r]||r.toLowerCase();I(n)&&(t+=W(n,e[r]));}return t},_ssrClass:function(e,t){var r=Qe(e,t);return ""===r?r:' class="'+D(r)+'"'},_ssrStyle:function(e,t,r){var n={};e&&A(n,e);t&&A(n,ot(t));r&&A(n,r);var i=at(n);return ""===i?i:" style="+JSON.stringify(D(i))}};var ri=function(e,t,r,n){this.isString=!0,this.open=e,this.close=t,this.children=r?1===n?Qn(r):2===n?Yn(r):r:void 0;};var ni=new de;function ii(e){!function e(t,r){var n,i;var o=Array.isArray(t);if(!o&&!s(t)||Object.isFrozen(t)||t instanceof Z)return;if(t.__ob__){var a=t.__ob__.dep.id;if(r.has(a))return;r.add(a);}if(o)for(n=t.length;n--;)e(t[n],r);else for(i=Object.keys(t),n=i.length;n--;)e(t[i[n]],r);}(e,ni),ni.clear();}var oi=b(function(e){var t="&"===e.charAt(0),r="~"===(e=t?e.slice(1):e).charAt(0),n="!"===(e=r?e.slice(1):e).charAt(0);return {name:e=n?e.slice(1):e,once:r,capture:n,passive:t}});function ai(e,t){function r(){var e=arguments,n=r.fns;if(!Array.isArray(n))return Ke(n,null,arguments,t,"v-on handler");for(var i=n.slice(),o=0;o<i.length;o++)Ke(i[o],null,e,t,"v-on handler");}return r.fns=e,r}function si(e,t,r,n,o){if(i(t)){if(g(t,r))return e[r]=t[r],o||delete t[r],!0;if(g(t,n))return e[r]=t[n],o||delete t[n],!0}return !1}var ci=1,ui=2;function li(e,t,r,c,u,l){return (Array.isArray(r)||a(r))&&(u=c,c=r,r=void 0),o(l)&&(u=ui),function(e,t,r,a,c){if(i(r)&&i(r.__ob__))return G();i(r)&&i(r.is)&&(t=r.is);if(!t)return G();Array.isArray(a)&&"function"==typeof a[0]&&((r=r||{}).scopedSlots={default:a[0]},a.length=0);c===ui?a=Yn(a):c===ci&&(a=Qn(a));var u,l;if("string"==typeof t){var f;l=e.$vnode&&e.$vnode.ns||ye.getTagNamespace(t),u=r&&r.pre||!i(f=Ue(e.$options,"components",t))?new Z(t,r,a,void 0,void 0,e):Ki(f,r,e,a,t);}else u=Ki(t,r,e,a);return Array.isArray(u)?u:i(u)?(i(l)&&function e(t,r,a){t.ns=r;"foreignObject"===t.tag&&(r=void 0,a=!0);if(i(t.children))for(var s=0,c=t.children.length;s<c;s++){var u=t.children[s];i(u.tag)&&(n(u.ns)||o(a)&&"svg"!==u.tag)&&e(u,r,a);}}(u,l),i(r)&&function(e){s(e.style)&&ii(e.style);s(e.class)&&ii(e.class);}(r),u):G()}(e,t,r,c,u)}function fi(e,t){var r,n,o,a,c;if(Array.isArray(e)||"string"==typeof e)for(r=new Array(e.length),n=0,o=e.length;n<o;n++)r[n]=t(e[n],n);else if("number"==typeof e)for(r=new Array(e),n=0;n<e;n++)r[n]=t(n+1,n);else if(s(e))if(ve&&e[Symbol.iterator]){r=[];for(var u=e[Symbol.iterator](),l=u.next();!l.done;)r.push(t(l.value,r.length)),l=u.next();}else for(a=Object.keys(e),r=new Array(a.length),n=0,o=a.length;n<o;n++)c=a[n],r[n]=t(e[c],c,n);return i(r)||(r=[]),r._isVList=!0,r}function pi(e,t,r,n){var i,o=this.$scopedSlots[e];o?(r=r||{},n&&(r=A(A({},n),r)),i=o(r)||t):i=this.$slots[e]||t;var a=r&&r.slot;return a?this.$createElement("template",{slot:a},i):i}function di(e){return Ue(this.$options,"filters",e)||T}function vi(e,t){return Array.isArray(e)?-1===e.indexOf(t):e!==t}function hi(e,t,r,n,i){var o=ye.keyCodes[t]||r;return i&&n&&!ye.keyCodes[t]?vi(i,n):o?vi(o,e):n?$(n)!==t:void 0}function mi(e,t,r,n,i){if(r)if(s(r)){var o;Array.isArray(r)&&(r=O(r));var a=function(a){if("class"===a||"style"===a||h(a))o=e;else {var s=e.attrs&&e.attrs.type;o=n||ye.mustUseProp(t,s,a)?e.domProps||(e.domProps={}):e.attrs||(e.attrs={});}var c=w(a),u=$(a);c in o||u in o||(o[a]=r[a],i&&((e.on||(e.on={}))["update:"+a]=function(e){r[a]=e;}));};for(var c in r)a(c);}return e}function yi(e,t){var r=this._staticTrees||(this._staticTrees=[]),n=r[e];return n&&!t?n:(bi(n=r[e]=this.$options.staticRenderFns[e].call(this._renderProxy,null,this),"__static__"+e,!1),n)}function gi(e,t,r){return bi(e,"__once__"+t+(r?"_"+r:""),!0),e}function bi(e,t,r){if(Array.isArray(e))for(var n=0;n<e.length;n++)e[n]&&"string"!=typeof e[n]&&_i(e[n],t+"_"+n,r);else _i(e,t,r);}function _i(e,t,r){e.isStatic=!0,e.key=t,e.isOnce=r;}function wi(e,t){if(t)if(u(t)){var r=e.on=e.on?A({},e.on):{};for(var n in t){var i=r[n],o=t[n];r[n]=i?[].concat(i,o):o;}}return e}function xi(e,t,r,n){t=t||{$stable:!r};for(var i=0;i<e.length;i++){var o=e[i];Array.isArray(o)?xi(o,t,r):o&&(o.proxy&&(o.fn.proxy=!0),t[o.key]=o.fn);}return n&&(t.$key=n),t}function Si(e,t){for(var r=0;r<t.length;r+=2){var n=t[r];"string"==typeof n&&n&&(e[t[r]]=t[r+1]);}return e}function $i(e,t){return "string"==typeof e?t+e:e}function Ai(e,t){if(!e||!e.length)return {};for(var r={},n=0,i=e.length;n<i;n++){var o=e[n],a=o.data;if(a&&a.attrs&&a.attrs.slot&&delete a.attrs.slot,o.context!==t&&o.fnContext!==t||!a||null==a.slot)(r.default||(r.default=[])).push(o);else {var s=a.slot,c=r[s]||(r[s]=[]);"template"===o.tag?c.push.apply(c,o.children||[]):c.push(o);}}for(var u in r)r[u].every(Oi)&&delete r[u];return r}function Oi(e){return e.isComment&&!e.asyncFactory||" "===e.text}function ki(e,t,n){var i,o=Object.keys(t).length>0,a=e?!!e.$stable:!o,s=e&&e.$key;if(e){if(e._normalized)return e._normalized;if(a&&n&&n!==r&&s===n.$key&&!o&&!n.$hasNormal)return n;for(var c in i={},e)e[c]&&"$"!==c[0]&&(i[c]=Ci(t,c,e[c]));}else i={};for(var u in t)u in i||(i[u]=Ti(t,u));return e&&Object.isExtensible(e)&&(e._normalized=i),ee(i,"$stable",a),ee(i,"$key",s),ee(i,"$hasNormal",o),i}function Ci(e,t,r){var n=function(){var e=arguments.length?r.apply(null,arguments):r({});return (e=e&&"object"==typeof e&&!Array.isArray(e)?[e]:Yn(e))&&(0===e.length||1===e.length&&e[0].isComment)?void 0:e};return r.proxy&&Object.defineProperty(e,t,{get:n,enumerable:!0,configurable:!0}),n}function Ti(e,t){return function(){return e[t]}}var Fi;function Ei(e,t){Fi.$on(e,t);}function Ni(e,t){Fi.$off(e,t);}function Li(e,t){var r=Fi;return function n(){null!==t.apply(null,arguments)&&r.$off(e,n);}}function Ii(e,t,r){Fi=e,function(e,t,r,i,a,s){var c,u,l,f;for(c in e)u=e[c],l=t[c],f=oi(c),n(u)||(n(l)?(n(u.fns)&&(u=e[c]=ai(u,s)),o(f.once)&&(u=e[c]=a(f.name,u,f.capture)),r(f.name,u,f.capture,f.passive,f.params)):u!==l&&(l.fns=u,e[c]=l));for(c in t)n(e[c])&&i((f=oi(c)).name,t[c],f.capture);}(t,r||{},Ei,Ni,Li,e),Fi=void 0;}function Mi(e){for(;e&&(e=e.$parent);)if(e._inactive)return !0;return !1}function Ri(e,t){xe();var r=e.$options[t],n=t+" hook";if(r)for(var i=0,o=r.length;i<o;i++)Ke(r[i],e,null,e,n);e._hasHookEvent&&e.$emit("hook:"+t),Se();}function zi(e,t,n,i,a){var s,c=this,u=a.options;g(i,"_uid")?(s=Object.create(i))._original=i:(s=i,i=i._original);var l=o(u._compiled),f=!l;this.data=e,this.props=t,this.children=n,this.parent=i,this.listeners=e.on||r,this.injections=function(e,t){if(e){for(var r=Object.create(null),n=ve?Reflect.ownKeys(e):Object.keys(e),i=0;i<n.length;i++){var o=n[i];if("__ob__"!==o){for(var a=e[o].from,s=t;s;){if(s._provided&&g(s._provided,a)){r[o]=s._provided[a];break}s=s.$parent;}if(!s&&"default"in e[o]){var c=e[o].default;r[o]="function"==typeof c?c.call(t):c;}}}return r}}(u.inject,i),this.slots=function(){return c.$slots||ki(e.scopedSlots,c.$slots=Ai(n,i)),c.$slots},Object.defineProperty(this,"scopedSlots",{enumerable:!0,get:function(){return ki(e.scopedSlots,this.slots())}}),l&&(this.$options=u,this.$slots=this.slots(),this.$scopedSlots=ki(e.scopedSlots,this.$slots)),u._scopeId?this._c=function(e,t,r,n){var o=li(s,e,t,r,n,f);return o&&!Array.isArray(o)&&(o.fnScopeId=u._scopeId,o.fnContext=i),o}:this._c=function(e,t,r,n){return li(s,e,t,r,n,f)};}function Bi(e,t,r,n,i){var o=function(e){var t=new Z(e.tag,e.data,e.children&&e.children.slice(),e.text,e.elm,e.context,e.componentOptions,e.asyncFactory);return t.ns=e.ns,t.isStatic=e.isStatic,t.key=e.key,t.isComment=e.isComment,t.fnContext=e.fnContext,t.fnOptions=e.fnOptions,t.fnScopeId=e.fnScopeId,t.asyncMeta=e.asyncMeta,t.isCloned=!0,t}(e);return o.fnContext=r,o.fnOptions=n,t.slot&&((o.data||(o.data={})).slot=t.slot),o}function qi(e,t){for(var r in t)e[w(r)]=t[r];}!function(e){e._o=gi,e._n=p,e._s=f,e._l=fi,e._t=pi,e._q=F,e._i=j,e._m=yi,e._f=di,e._k=hi,e._b=mi,e._v=Q,e._e=G,e._u=xi,e._g=wi,e._d=Si,e._p=$i;}(zi.prototype);var Ji={init:function(e,t){if(e.componentInstance&&!e.componentInstance._isDestroyed&&e.data.keepAlive){var r=e;Ji.prepatch(r,r);}else {(e.componentInstance=Vi(e,null)).$mount(t?e.elm:void 0,t);}},prepatch:function(e,t){var n=t.componentOptions;!function(e,t,n,i,o){var a=i.data.scopedSlots,s=e.$scopedSlots,c=!!(a&&!a.$stable||s!==r&&!s.$stable||a&&e.$scopedSlots.$key!==a.$key),u=!!(o||e.$options._renderChildren||c);if(e.$options._parentVnode=i,e.$vnode=i,e._vnode&&(e._vnode.parent=i),e.$options._renderChildren=o,e.$attrs=i.data.attrs||r,e.$listeners=n||r,t&&e.$options.props){Ce(!1);for(var l=e._props,f=e.$options._propKeys||[],p=0;p<f.length;p++){var d=f[p],v=e.$options.props;l[d]=ze(d,v,t,e);}Ce(!0),e.$options.propsData=t;}n=n||r;var h=e.$options._parentListeners;e.$options._parentListeners=n,Ii(e,n,h),u&&(e.$slots=Ai(o,i.context),e.$forceUpdate());}(t.componentInstance=e.componentInstance,n.propsData,n.listeners,t,n.children);},insert:function(e){var t=e.context,r=e.componentInstance;r._isMounted||(r._isMounted=!0,Ri(r,"mounted")),e.data.keepAlive&&(t._isMounted?r._inactive=!1:function e(t,r){if(r){if(t._directInactive=!1,Mi(t))return}else if(t._directInactive)return;if(t._inactive||null===t._inactive){t._inactive=!1;for(var n=0;n<t.$children.length;n++)e(t.$children[n]);Ri(t,"activated");}}(r,!0));},destroy:function(e){var t=e.componentInstance;t._isDestroyed||(e.data.keepAlive?function e(t,r){if(!(r&&(t._directInactive=!0,Mi(t))||t._inactive)){t._inactive=!0;for(var n=0;n<t.$children.length;n++)e(t.$children[n]);Ri(t,"deactivated");}}(t,!0):t.$destroy());}},Hi=Object.keys(Ji);function Ki(e,t,a,c,u){if(!n(e)){var f=a.$options._base;if(s(e)&&(e=f.extend(e)),"function"==typeof e){var p;if(n(e.cid)&&void 0===(e=function(e,t){if(o(e.error)&&i(e.errorComp))return e.errorComp;if(i(e.resolved))return e.resolved;if(o(e.loading)&&i(e.loadingComp))return e.loadingComp;}(p=e)))return function(e,t,r,n,i){var o=G();return o.asyncFactory=e,o.asyncMeta={data:t,context:r,children:n,tag:i},o}(p,t,a,c,u);t=t||{},function e(t){var r=t.options;if(t.super){var n=e(t.super);if(n!==t.superOptions){t.superOptions=n;var i=function(e){var t,r=e.options,n=e.sealedOptions;for(var i in r)r[i]!==n[i]&&(t||(t={}),t[i]=r[i]);return t}(t);i&&A(t.extendOptions,i),(r=t.options=De(n,t.extendOptions)).name&&(r.components[r.name]=t);}}return r}(e),i(t.model)&&function(e,t){var r=e.model&&e.model.prop||"value",n=e.model&&e.model.event||"input";(t.attrs||(t.attrs={}))[r]=t.model.value;var o=t.on||(t.on={}),a=o[n],s=t.model.callback;i(a)?(Array.isArray(a)?-1===a.indexOf(s):a!==s)&&(o[n]=[s].concat(a)):o[n]=s;}(e.options,t);var d=function(e,t,r){var o=t.options.props;if(!n(o)){var a={},s=e.attrs,c=e.props;if(i(s)||i(c))for(var u in o){var l=$(u);si(a,c,u,l,!0)||si(a,s,u,l,!1);}return a}}(t,e);if(o(e.options.functional))return function(e,t,n,o,a){var s=e.options,c={},u=s.props;if(i(u))for(var l in u)c[l]=ze(l,u,t||r);else i(n.attrs)&&qi(c,n.attrs),i(n.props)&&qi(c,n.props);var f=new zi(n,c,a,o,e),p=s.render.call(null,f._c,f);if(p instanceof Z)return Bi(p,n,f.parent,s);if(Array.isArray(p)){for(var d=Yn(p)||[],v=new Array(d.length),h=0;h<d.length;h++)v[h]=Bi(d[h],n,f.parent,s);return v}}(e,d,t,a,c);var v=t.on;if(t.on=t.nativeOn,o(e.options.abstract)){var h=t.slot;t={},h&&(t.slot=h);}!function(e){for(var t=e.hook||(e.hook={}),r=0;r<Hi.length;r++){var n=Hi[r],i=t[n],o=Ji[n];i===o||i&&i._merged||(t[n]=i?Wi(o,i):o);}}(t);var y=e.options.name||u;return new Z("vue-component-"+e.cid+(y?"-"+y:""),t,void 0,void 0,void 0,a,{Ctor:e,propsData:d,listeners:v,tag:u,children:c},p)}}}function Vi(e,t){var r={_isComponent:!0,_parentVnode:e,parent:t},n=e.data.inlineTemplate;return i(n)&&(r.render=n.render,r.staticRenderFns=n.staticRenderFns),new e.componentOptions.Ctor(r)}function Wi(e,t){var r=function(r,n){e(r,n),t(r,n);};return r._merged=!0,r}var Zi=Object.create(null),Xi=function(e){Zi[e]||(Zi[e]=!0,console.warn("\n\x1b[31m"+e+"\x1b[39m\n"));},Gi=function(e,t){var r=t?ge():"";throw new Error("\n\x1b[31m"+e+r+"\x1b[39m\n")},Qi=function(e){var t=e.$options,r=t.render,i=t.template,o=t._scopeId;if(n(r)){if(!i)throw new Error("render function or template not defined in component: "+(e.$options.name||e.$options._componentTag||"anonymous"));var a=Gn(i,{scopeId:o,warn:Gi},e);e.$options.render=a.render,e.$options.staticRenderFns=a.staticRenderFns;}};function Yi(e,t,r){var n=e.$options.serverPrefetch;if(i(n)){Array.isArray(n)||(n=[n]);try{for(var o=[],a=0,s=n.length;a<s;a++){var c=n[a].call(e,e);c&&"function"==typeof c.then&&o.push(c);}return void Promise.all(o).then(t).catch(r)}catch(e){r(e);}}t();}function eo(e,t,r){e.isString?function(e,t){var r=t.write,i=t.next;if(n(e.children)||0===e.children.length)r(e.open+(e.close||""),i);else {var o=e.children;t.renderStates.push({type:"Element",children:o,rendered:0,total:o.length,endTag:e.close}),r(e.open,i);}}(e,r):i(e.componentOptions)?ro(e,t,r):i(e.tag)?function(e,t,r){var a=r.write,s=r.next;o(t)&&(e.data||(e.data={}),e.data.attrs||(e.data.attrs={}),e.data.attrs[he]="true");e.fnOptions&&to(e.fnOptions,a);var c=function(e,t){var r,o="<"+e.tag,a=t.directives,s=t.modules;n(e.data)&&function e(t){var r=t.parent;return i(r)&&(i(r.data)||e(r))}(e)&&(e.data={});if(i(e.data)){var c=e.data.directives;if(c)for(var u=0;u<c.length;u++){var l=c[u].name;if("show"!==l){var f=Ue(t,"directives",l);f&&f(e,c[u]);}}var p=function(e){var t,r;for(;i(e);)e.data&&e.data.directives&&(r=e.data.directives.find(function(e){return "show"===e.name}))&&(t=r),e=e.parent;return t}(e);p&&a.show(e,p);for(var d=0;d<s.length;d++){var v=s[d](e);v&&(o+=v);}}var h=t.activeInstance;i(h)&&h!==e.context&&i(r=h.$options._scopeId)&&(o+=" "+r);if(i(e.fnScopeId))o+=" "+e.fnScopeId;else for(;i(e);)i(r=e.context.$options._scopeId)&&(o+=" "+r),e=e.parent;return o+">"}(e,r),u="</"+e.tag+">";if(r.isUnaryTag(e.tag))a(c,s);else if(n(e.children)||0===e.children.length)a(c+u,s);else {var l=e.children;r.renderStates.push({type:"Element",children:l,rendered:0,total:l.length,endTag:u}),a(c,s);}}(e,t,r):o(e.isComment)?i(e.asyncFactory)?function(e,t,r){var n=e.asyncFactory,i=function(n){n.__esModule&&n.default&&(n=n.default);var i=e.asyncMeta,o=i.data,a=i.children,s=i.tag,c=e.asyncMeta.context,u=Ki(n,o,c,a,s);u?u.componentOptions?ro(u,t,r):Array.isArray(u)?(r.renderStates.push({type:"Fragment",children:u,rendered:0,total:u.length}),r.next()):eo(u,t,r):r.write("\x3c!----\x3e",r.next);};if(n.resolved)return void i(n.resolved);var o,a=r.done;try{o=n(i,a);}catch(e){a(e);}if(o)if("function"==typeof o.then)o.then(i,a).catch(a);else {var s=o.component;s&&"function"==typeof s.then&&s.then(i,a).catch(a);}}(e,t,r):r.write("\x3c!--"+e.text+"--\x3e",r.next):r.write(e.raw?e.text:D(String(e.text)),r.next);}function to(e,t){var r=e._ssrRegister;return t.caching&&i(r)&&t.componentBuffer[t.componentBuffer.length-1].add(r),r}function ro(e,t,r){var o=r.write,a=r.next,s=r.userContext,c=e.componentOptions.Ctor,u=c.options.serverCacheKey,l=c.options.name,f=r.cache,p=to(c.options,o);if(i(u)&&i(f)&&i(l)){var d=u(e.componentOptions.propsData);if(!1===d)return void io(e,t,r);var v=l+"::"+d,h=r.has,m=r.get;i(h)?h(v,function(n){!0===n&&i(m)?m(v,function(e){i(p)&&p(s),e.components.forEach(function(e){return e(s)}),o(e.html,a);}):no(e,t,v,r);}):i(m)&&m(v,function(n){i(n)?(i(p)&&p(s),n.components.forEach(function(e){return e(s)}),o(n.html,a)):no(e,t,v,r);});}else i(u)&&n(f)&&Xi("[vue-server-renderer] Component "+(c.options.name||"(anonymous)")+" implemented serverCacheKey, but no cache was provided to the renderer."),i(u)&&n(l)&&Xi('[vue-server-renderer] Components that implement "serverCacheKey" must also define a unique "name" option.'),io(e,t,r);}function no(e,t,r,n){var i=n.write;i.caching=!0;var o=i.cacheBuffer,a=o.push("")-1,s=i.componentBuffer;s.push(new Set),n.renderStates.push({type:"ComponentWithCache",key:r,buffer:o,bufferIndex:a,componentBuffer:s}),io(e,t,n);}function io(e,t,r){var n=r.activeInstance;e.ssrContext=r.userContext;var i=r.activeInstance=Vi(e,r.activeInstance);Qi(i);var o=r.done;Yi(i,function(){var o=i._render();o.parent=e,r.renderStates.push({type:"Component",prevActive:n}),eo(o,t,r);},o);}function oo(e,t,r,n){return function(i,o,a,s){Zi=Object.create(null);var c=new _t({activeInstance:i,userContext:a,write:o,done:s,renderNode:eo,isUnaryTag:r,modules:e,directives:t,cache:n});!function(e){if(!e._ssrNode){for(var t=e.constructor;t.super;)t=t.super;A(t.prototype,ti),t.FunctionalRenderContext&&A(t.FunctionalRenderContext.prototype,ti);}}(i),Qi(i);Yi(i,function(){eo(i._render(),!0,c);},s);}}var ao=function(e){return /\.js(\?[^.]+)?$/.test(e)};function so(){var e,t;return {promise:new Promise(function(r,n){e=r,t=n;}),cb:function(r,n){if(r)return t(r);e(n||"");}}}var co=function(e){function t(t,r,n){e.call(this),this.started=!1,this.renderer=t,this.template=r,this.context=n||{},this.inject=t.inject;}return e&&(t.__proto__=e),t.prototype=Object.create(e&&e.prototype),t.prototype.constructor=t,t.prototype._transform=function(e,t,r){this.started||(this.emit("beforeStart"),this.start()),this.push(e),r();},t.prototype.start=function(){if(this.started=!0,this.push(this.template.head(this.context)),this.inject){this.context.head&&this.push(this.context.head);var e=this.renderer.renderResourceHints(this.context);e&&this.push(e);var t=this.renderer.renderStyles(this.context);t&&this.push(t);}this.push(this.template.neck(this.context));},t.prototype._flush=function(e){if(this.emit("beforeEnd"),this.inject){var t=this.renderer.renderState(this.context);t&&this.push(t);var r=this.renderer.renderScripts(this.context);r&&this.push(r);}this.push(this.template.tail(this.context)),e();},t}(Stream__default['default'].Transform),lo={escape:/{{([^{][\s\S]+?[^}])}}/g,interpolate:/{{{([\s\S]+?)}}}/g};function fo(e){var t=function(e){var t=new Map;return Object.keys(e.modules).forEach(function(r){t.set(r,function(e,t){var r=[],n=t.modules[e];return n&&n.forEach(function(e){var n=t.all[e];(t.async.indexOf(n)>-1||!/\.(js|css)($|\?)/.test(n))&&r.push(n);}),r}(r,e));}),t}(e);return function(e){for(var r=new Set,n=0;n<e.length;n++){var i=t.get(e[n]);if(i)for(var o=0;o<i.length;o++)r.add(i[o]);}return Array.from(r)}}var ho=function(e){this.options=e,this.inject=!1!==e.inject;var t=e.template;if(this.parsedTemplate=t?"string"==typeof t?function(e,t){if(void 0===t&&(t="\x3c!--vue-ssr-outlet--\x3e"),"object"==typeof e)return e;var r=e.indexOf("</head>"),n=e.indexOf(t);if(n<0)throw new Error("Content placeholder not found in template.");return r<0&&(r=e.indexOf("<body>"))<0&&(r=n),{head:server$1.proxy(e.slice(0,r),lo),neck:server$1.proxy(e.slice(r,n),lo),tail:server$1.proxy(e.slice(n+t.length),lo)}}(t):t:null,this.serialize=e.serializer||function(e){return server$1.proxy(e,{isJSON:!0})},e.clientManifest){var r=this.clientManifest=e.clientManifest;this.publicPath=""===r.publicPath?"":r.publicPath.replace(/([^\/])$/,"$1/"),this.preloadFiles=(r.initial||[]).map(mo),this.prefetchFiles=(r.async||[]).map(mo),this.mapFiles=fo(r);}};function mo(e){var t=e.replace(/\?.*/,""),r=po__default['default'].extname(t).slice(1);return {file:e,extension:r,fileWithoutQuery:t,asType:yo(r)}}function yo(e){return "js"===e?"script":"css"===e?"style":/jpe?g|png|svg|gif|webp|ico/.test(e)?"image":/woff2?|ttf|otf|eot/.test(e)?"font":""}ho.prototype.bindRenderFns=function(e){var t=this;["ResourceHints","State","Scripts","Styles"].forEach(function(r){e["render"+r]=t["render"+r].bind(t,e);}),e.getPreloadFiles=t.getPreloadFiles.bind(t,e);},ho.prototype.render=function(e,t){var r=this.parsedTemplate;if(!r)throw new Error("render cannot be called without a template.");return t=t||{},"function"==typeof r?r(e,t):this.inject?r.head(t)+(t.head||"")+this.renderResourceHints(t)+this.renderStyles(t)+r.neck(t)+e+this.renderState(t)+this.renderScripts(t)+r.tail(t):r.head(t)+r.neck(t)+e+r.tail(t)},ho.prototype.renderStyles=function(e){var t=this,r=this.preloadFiles||[],n=this.getUsedAsyncFiles(e)||[],i=r.concat(n).filter(function(e){return function(e){return /\.css(\?[^.]+)?$/.test(e)}(e.file)});return (i.length?i.map(function(e){var r=e.file;return '<link rel="stylesheet" href="'+t.publicPath+r+'">'}).join(""):"")+(e.styles||"")},ho.prototype.renderResourceHints=function(e){return this.renderPreloadLinks(e)+this.renderPrefetchLinks(e)},ho.prototype.getPreloadFiles=function(e){var t=this.getUsedAsyncFiles(e);return this.preloadFiles||t?(this.preloadFiles||[]).concat(t||[]):[]},ho.prototype.renderPreloadLinks=function(e){var t=this,r=this.getPreloadFiles(e),n=this.options.shouldPreload;return r.length?r.map(function(e){var r=e.file,i=e.extension,o=e.fileWithoutQuery,a=e.asType,s="";return n||"script"===a||"style"===a?n&&!n(o,a)?"":("font"===a&&(s=' type="font/'+i+'" crossorigin'),'<link rel="preload" href="'+t.publicPath+r+'"'+(""!==a?' as="'+a+'"':"")+s+">"):""}).join(""):""},ho.prototype.renderPrefetchLinks=function(e){var t=this,r=this.options.shouldPrefetch;if(this.prefetchFiles){var n=this.getUsedAsyncFiles(e);return this.prefetchFiles.map(function(e){var i=e.file,o=e.fileWithoutQuery,a=e.asType;return r&&!r(o,a)?"":function(e){return n&&n.some(function(t){return t.file===e})}(i)?"":'<link rel="prefetch" href="'+t.publicPath+i+'">'}).join("")}return ""},ho.prototype.renderState=function(e,t){var r=t||{},n=r.contextKey;void 0===n&&(n="state");var i=r.windowKey;void 0===i&&(i="__INITIAL_STATE__");var o=this.serialize(e[n]),a=e.nonce?' nonce="'+e.nonce+'"':"";return e[n]?"<script"+a+">window."+i+"="+o+";(function(){var s;(s=document.currentScript||document.scripts[document.scripts.length-1]).parentNode.removeChild(s);}());<\/script>":""},ho.prototype.renderScripts=function(e){var t=this;if(this.clientManifest){var r=this.preloadFiles.filter(function(e){var t=e.file;return ao(t)}),n=(this.getUsedAsyncFiles(e)||[]).filter(function(e){var t=e.file;return ao(t)});return [r[0]].concat(n,r.slice(1)).map(function(e){var r=e.file;return '<script src="'+t.publicPath+r+'" defer><\/script>'}).join("")}return ""},ho.prototype.getUsedAsyncFiles=function(e){if(!e._mappedFiles&&e._registeredComponents&&this.mapFiles){var t=Array.from(e._registeredComponents);e._mappedFiles=this.mapFiles(t).map(mo);}return e._mappedFiles},ho.prototype.createStream=function(e){if(!this.parsedTemplate)throw new Error("createStream cannot be called without a template.");return new co(this,this.parsedTemplate,e||{})};var bo=po__default['default'];function xo(e){var t={Buffer:Buffer,console:console,process:process,setTimeout:setTimeout,setInterval:setInterval,setImmediate:setImmediate,clearTimeout:clearTimeout,clearInterval:clearInterval,clearImmediate:clearImmediate,__VUE_SSR_CONTEXT__:e};return t.global=t,t}function So(e,t,r){var n={},i={};return function o(a,s,c){if(void 0===c&&(c={}),c[a])return c[a];var u=function(t){if(n[t])return n[t];var r=e[t],i=wo__default['default'].wrap(r),o=new go__default['default'].Script(i,{filename:t,displayErrors:!0});return n[t]=o,o}(a),l={exports:{}};(!1===r?u.runInThisContext():u.runInNewContext(s)).call(l.exports,l.exports,function(r){return r=bo.posix.join(".",r),e[r]?o(r,s,c):t?server$1.commonjsRequire(i[r]||(i[r]=server$1.proxy.sync(r,{basedir:t}))):server$1.commonjsRequire(r)},l);var f=Object.prototype.hasOwnProperty.call(l.exports,"default")?l.exports.default:l.exports;return c[a]=f,f}}function $o(e,t,r,n){var i,o,a=So(t,r,n);return !1!==n&&"once"!==n?function(t){return void 0===t&&(t={}),new Promise(function(r){t._registeredComponents=new Set;var n=a(e,xo(t));r("function"==typeof n?n(t):n);})}:function(t){return void 0===t&&(t={}),new Promise(function(r){if(!i){var s="once"===n?xo():server$1.commonjsGlobal;if(o=s.__VUE_SSR_CONTEXT__={},i=a(e,s),delete s.__VUE_SSR_CONTEXT__,"function"!=typeof i)throw new Error("bundle export should be a function when using { runInNewContext: false }.")}if(t._registeredComponents=new Set,o._styles){t._styles=function e(t){if(u(t)){var r={};for(var n in t)r[n]=e(t[n]);return r}return Array.isArray(t)?t.slice():t}(o._styles);var c=o._renderStyles;c&&Object.defineProperty(t,"styles",{enumerable:!0,get:function(){return c(t._styles)}});}r(i(t));})}}var Ao=server$1.proxy.SourceMapConsumer,Oo=/\(([^)]+\.js):(\d+):(\d+)\)$/;function ko(e,t){e&&"string"==typeof e.stack&&(e.stack=e.stack.split("\n").map(function(e){return function(e,t){var r=e.match(Oo),n=r&&t[r[1]];if(null!=r&&n){var i=n.originalPositionFor({line:Number(r[2]),column:Number(r[3])});if(null!=i.source){var o=i.source,a=i.line,s=i.column,c="("+o.replace(/^webpack:\/\/\//,"")+":"+String(a)+":"+String(s)+")";return e.replace(Oo,c)}return e}return e}(e,t)}).join("\n"));}var To=po__default['default'],Fo=Stream__default['default'].PassThrough,jo="Invalid server-rendering bundle format. Should be a string or a bundle Object of type:\n\n{\n  entry: string;\n  files: { [filename: string]: string; };\n  maps: { [filename: string]: string; };\n}\n";function Po(e){return void 0===e&&(e={}),function(e){void 0===e&&(e={});var t=e.modules;void 0===t&&(t=[]);var r=e.directives;void 0===r&&(r={});var n=e.isUnaryTag;void 0===n&&(n=function(){return !1});var i=e.template,o=e.inject,a=e.cache,s=e.shouldPreload,c=e.shouldPrefetch,u=e.clientManifest,l=e.serializer,f=oo(t,r,n,a),p=new ho({template:i,inject:o,shouldPreload:s,shouldPrefetch:c,clientManifest:u,serializer:l});return {renderToString:function(e,t,r){var n,o;"function"==typeof t&&(r=t,t={}),t&&p.bindRenderFns(t),r||(o=(n=so()).promise,r=n.cb);var a="",s=gt(function(e){return a+=e,!1},r);try{f(e,s,t,function(e){if(e)return r(e);if(t&&t.rendered&&t.rendered(t),i)try{var n=p.render(a,t);"string"!=typeof n?n.then(function(e){return r(null,e)}).catch(r):r(null,n);}catch(e){r(e);}else r(null,a);});}catch(e){r(e);}return o},renderToStream:function(e,t){t&&p.bindRenderFns(t);var r=new bt(function(r,n){f(e,r,t,n);});if(i){if("function"==typeof i)throw new Error("function template is only supported in renderToString.");var n=p.createStream(t);if(r.on("error",function(e){n.emit("error",e);}),r.pipe(n),t&&t.rendered){var o=t.rendered;r.once("beforeEnd",function(){o(t);});}return n}if(t&&t.rendered){var a=t.rendered;r.once("beforeEnd",function(){a(t);});}return r}}}(A(A({},e),{isUnaryTag:pt,canBeLeftOpenTag:dt,modules:ct,directives:A(ft,e.directives)}))}process.env.VUE_ENV="server";var Eo=function(e){return function(t,r){var n,i,o;void 0===r&&(r={});var a=r.basedir;if("string"==typeof t&&/\.js(on)?$/.test(t)&&To.isAbsolute(t)){if(!Co__default['default'].existsSync(t))throw new Error("Cannot locate bundle file: "+t);var s=/\.json$/.test(t);if(a=a||To.dirname(t),t=Co__default['default'].readFileSync(t,"utf-8"),s)try{t=JSON.parse(t);}catch(e){throw new Error("Invalid JSON bundle file: "+t)}}if("object"==typeof t){if(i=t.entry,n=t.files,a=a||t.basedir,o=function(e){var t={};return Object.keys(e).forEach(function(r){t[r]=new Ao(e[r]);}),t}(t.maps),"string"!=typeof i||"object"!=typeof n)throw new Error(jo)}else {if("string"!=typeof t)throw new Error(jo);i="__vue_ssr_bundle__",n={__vue_ssr_bundle__:t},o={};}var c=e(r),u=$o(i,n,a,r.runInNewContext);return {renderToString:function(e,t){var r,n;return "function"==typeof e&&(t=e,e={}),t||(n=(r=so()).promise,t=r.cb),u(e).catch(function(e){ko(e,o),t(e);}).then(function(r){r&&c.renderToString(r,e,function(e,r){ko(e,o),t(e,r);});}),n},renderToStream:function(e){var t=new Fo;return u(e).catch(function(e){ko(e,o),process.nextTick(function(){t.emit("error",e);});}).then(function(n){if(n){var i=c.renderToStream(n,e);i.on("error",function(e){ko(e,o),t.emit("error",e);}),r&&r.template&&(i.on("beforeStart",function(){t.emit("beforeStart");}),i.on("beforeEnd",function(){t.emit("beforeEnd");})),i.pipe(t);}}),t}}}}(Po);exports.createRenderer=Po,exports.createBundleRenderer=Eo;
});

/*@__PURE__*/server$1.getDefaultExportFromCjs(build_prod);

const _renderer = build_prod.createRenderer({});
function renderToString(component, context) {
  return new Promise((resolve, reject) => {
    _renderer.renderToString(component, context, (err, result) => {
      if (err) {
        return reject(err);
      }
      return resolve(result);
    });
  });
}

/*!
 * Vue.js v2.6.12
 * (c) 2014-2020 Evan You
 * Released under the MIT License.
 */

var vue_runtime_common_prod = server$1.createCommonjsModule(function (module) {
var t=Object.freeze({});function e(t){return null==t}function n(t){return null!=t}function r(t){return !0===t}function o(t){return "string"==typeof t||"number"==typeof t||"symbol"==typeof t||"boolean"==typeof t}function i(t){return null!==t&&"object"==typeof t}var a=Object.prototype.toString;function s(t){return "[object Object]"===a.call(t)}function c(t){var e=parseFloat(String(t));return e>=0&&Math.floor(e)===e&&isFinite(t)}function u(t){return n(t)&&"function"==typeof t.then&&"function"==typeof t.catch}function l(t){return null==t?"":Array.isArray(t)||s(t)&&t.toString===a?JSON.stringify(t,null,2):String(t)}function f(t){var e=parseFloat(t);return isNaN(e)?t:e}function p(t,e){for(var n=Object.create(null),r=t.split(","),o=0;o<r.length;o++)n[r[o]]=!0;return e?function(t){return n[t.toLowerCase()]}:function(t){return n[t]}}var d=p("key,ref,slot,slot-scope,is");function v(t,e){if(t.length){var n=t.indexOf(e);if(n>-1)return t.splice(n,1)}}var h=Object.prototype.hasOwnProperty;function m(t,e){return h.call(t,e)}function y(t){var e=Object.create(null);return function(n){return e[n]||(e[n]=t(n))}}var g=/-(\w)/g,_=y(function(t){return t.replace(g,function(t,e){return e?e.toUpperCase():""})}),b=y(function(t){return t.charAt(0).toUpperCase()+t.slice(1)}),C=/\B([A-Z])/g,$=y(function(t){return t.replace(C,"-$1").toLowerCase()});var w=Function.prototype.bind?function(t,e){return t.bind(e)}:function(t,e){function n(n){var r=arguments.length;return r?r>1?t.apply(e,arguments):t.call(e,n):t.call(e)}return n._length=t.length,n};function A(t,e){e=e||0;for(var n=t.length-e,r=new Array(n);n--;)r[n]=t[n+e];return r}function x(t,e){for(var n in e)t[n]=e[n];return t}function O(t){for(var e={},n=0;n<t.length;n++)t[n]&&x(e,t[n]);return e}function k(t,e,n){}var S=function(t,e,n){return !1},E=function(t){return t};function j(t,e){if(t===e)return !0;var n=i(t),r=i(e);if(!n||!r)return !n&&!r&&String(t)===String(e);try{var o=Array.isArray(t),a=Array.isArray(e);if(o&&a)return t.length===e.length&&t.every(function(t,n){return j(t,e[n])});if(t instanceof Date&&e instanceof Date)return t.getTime()===e.getTime();if(o||a)return !1;var s=Object.keys(t),c=Object.keys(e);return s.length===c.length&&s.every(function(n){return j(t[n],e[n])})}catch(t){return !1}}function T(t,e){for(var n=0;n<t.length;n++)if(j(t[n],e))return n;return -1}function I(t){var e=!1;return function(){e||(e=!0,t.apply(this,arguments));}}var D="data-server-rendered",N=["component","directive","filter"],P=["beforeCreate","created","beforeMount","mounted","beforeUpdate","updated","beforeDestroy","destroyed","activated","deactivated","errorCaptured","serverPrefetch"],L={optionMergeStrategies:Object.create(null),silent:!1,productionTip:!1,devtools:!1,performance:!1,errorHandler:null,warnHandler:null,ignoredElements:[],keyCodes:Object.create(null),isReservedTag:S,isReservedAttr:S,isUnknownElement:S,getTagNamespace:k,parsePlatformTagName:E,mustUseProp:S,async:!0,_lifecycleHooks:P};function M(t,e,n,r){Object.defineProperty(t,e,{value:n,enumerable:!!r,writable:!0,configurable:!0});}var F=new RegExp("[^"+/a-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD/.source+".$_\\d]");var R,U="__proto__"in{},H="undefined"!="undefined",B="undefined"!=typeof WXEnvironment&&!!WXEnvironment.platform,V=B&&WXEnvironment.platform.toLowerCase(),z=H,q=z,K=z,X=("ios"===V),G=(z),Z={}.watch;var Y=function(){return void 0===R&&(R=!B&&"undefined"!=typeof server$1.commonjsGlobal&&(server$1.commonjsGlobal.process&&"server"===server$1.commonjsGlobal.process.env.VUE_ENV)),R},tt=H;function et(t){return "function"==typeof t&&/native code/.test(t.toString())}var nt,rt="undefined"!=typeof Symbol&&et(Symbol)&&"undefined"!=typeof Reflect&&et(Reflect.ownKeys);nt="undefined"!=typeof Set&&et(Set)?Set:function(){function t(){this.set=Object.create(null);}return t.prototype.has=function(t){return !0===this.set[t]},t.prototype.add=function(t){this.set[t]=!0;},t.prototype.clear=function(){this.set=Object.create(null);},t}();var ot=k,it=0,at=function(){this.id=it++,this.subs=[];};at.prototype.addSub=function(t){this.subs.push(t);},at.prototype.removeSub=function(t){v(this.subs,t);},at.prototype.depend=function(){at.target&&at.target.addDep(this);},at.prototype.notify=function(){for(var t=this.subs.slice(),e=0,n=t.length;e<n;e++)t[e].update();},at.target=null;var st=[];function ct(t){st.push(t),at.target=t;}function ut(){st.pop(),at.target=st[st.length-1];}var lt=function(t,e,n,r,o,i,a,s){this.tag=t,this.data=e,this.children=n,this.text=r,this.elm=o,this.ns=void 0,this.context=i,this.fnContext=void 0,this.fnOptions=void 0,this.fnScopeId=void 0,this.key=e&&e.key,this.componentOptions=a,this.componentInstance=void 0,this.parent=void 0,this.raw=!1,this.isStatic=!1,this.isRootInsert=!0,this.isComment=!1,this.isCloned=!1,this.isOnce=!1,this.asyncFactory=s,this.asyncMeta=void 0,this.isAsyncPlaceholder=!1;},ft={child:{configurable:!0}};ft.child.get=function(){return this.componentInstance},Object.defineProperties(lt.prototype,ft);var pt=function(t){void 0===t&&(t="");var e=new lt;return e.text=t,e.isComment=!0,e};function dt(t){return new lt(void 0,void 0,void 0,String(t))}function vt(t){var e=new lt(t.tag,t.data,t.children&&t.children.slice(),t.text,t.elm,t.context,t.componentOptions,t.asyncFactory);return e.ns=t.ns,e.isStatic=t.isStatic,e.key=t.key,e.isComment=t.isComment,e.fnContext=t.fnContext,e.fnOptions=t.fnOptions,e.fnScopeId=t.fnScopeId,e.asyncMeta=t.asyncMeta,e.isCloned=!0,e}var ht=Array.prototype,mt=Object.create(ht);["push","pop","shift","unshift","splice","sort","reverse"].forEach(function(t){var e=ht[t];M(mt,t,function(){for(var n=[],r=arguments.length;r--;)n[r]=arguments[r];var o,i=e.apply(this,n),a=this.__ob__;switch(t){case"push":case"unshift":o=n;break;case"splice":o=n.slice(2);}return o&&a.observeArray(o),a.dep.notify(),i});});var yt=Object.getOwnPropertyNames(mt),gt=!0;function _t(t){gt=t;}var bt=function(t){var e;this.value=t,this.dep=new at,this.vmCount=0,M(t,"__ob__",this),Array.isArray(t)?(U?(e=mt,t.__proto__=e):function(t,e,n){for(var r=0,o=n.length;r<o;r++){var i=n[r];M(t,i,e[i]);}}(t,mt,yt),this.observeArray(t)):this.walk(t);};function Ct(t,e){var n;if(i(t)&&!(t instanceof lt))return m(t,"__ob__")&&t.__ob__ instanceof bt?n=t.__ob__:gt&&!Y()&&(Array.isArray(t)||s(t))&&Object.isExtensible(t)&&!t._isVue&&(n=new bt(t)),e&&n&&n.vmCount++,n}function $t(t,e,n,r,o){var i=new at,a=Object.getOwnPropertyDescriptor(t,e);if(!a||!1!==a.configurable){var s=a&&a.get,c=a&&a.set;s&&!c||2!==arguments.length||(n=t[e]);var u=!o&&Ct(n);Object.defineProperty(t,e,{enumerable:!0,configurable:!0,get:function(){var e=s?s.call(t):n;return at.target&&(i.depend(),u&&(u.dep.depend(),Array.isArray(e)&&function t(e){for(var n=void 0,r=0,o=e.length;r<o;r++)(n=e[r])&&n.__ob__&&n.__ob__.dep.depend(),Array.isArray(n)&&t(n);}(e))),e},set:function(e){var r=s?s.call(t):n;e===r||e!=e&&r!=r||s&&!c||(c?c.call(t,e):n=e,u=!o&&Ct(e),i.notify());}});}}function wt(t,e,n){if(Array.isArray(t)&&c(e))return t.length=Math.max(t.length,e),t.splice(e,1,n),n;if(e in t&&!(e in Object.prototype))return t[e]=n,n;var r=t.__ob__;return t._isVue||r&&r.vmCount?n:r?($t(r.value,e,n),r.dep.notify(),n):(t[e]=n,n)}function At(t,e){if(Array.isArray(t)&&c(e))t.splice(e,1);else {var n=t.__ob__;t._isVue||n&&n.vmCount||m(t,e)&&(delete t[e],n&&n.dep.notify());}}bt.prototype.walk=function(t){for(var e=Object.keys(t),n=0;n<e.length;n++)$t(t,e[n]);},bt.prototype.observeArray=function(t){for(var e=0,n=t.length;e<n;e++)Ct(t[e]);};var xt=L.optionMergeStrategies;function Ot(t,e){if(!e)return t;for(var n,r,o,i=rt?Reflect.ownKeys(e):Object.keys(e),a=0;a<i.length;a++)"__ob__"!==(n=i[a])&&(r=t[n],o=e[n],m(t,n)?r!==o&&s(r)&&s(o)&&Ot(r,o):wt(t,n,o));return t}function kt(t,e,n){return n?function(){var r="function"==typeof e?e.call(n,n):e,o="function"==typeof t?t.call(n,n):t;return r?Ot(r,o):o}:e?t?function(){return Ot("function"==typeof e?e.call(this,this):e,"function"==typeof t?t.call(this,this):t)}:e:t}function St(t,e){var n=e?t?t.concat(e):Array.isArray(e)?e:[e]:t;return n?function(t){for(var e=[],n=0;n<t.length;n++)-1===e.indexOf(t[n])&&e.push(t[n]);return e}(n):n}function Et(t,e,n,r){var o=Object.create(t||null);return e?x(o,e):o}xt.data=function(t,e,n){return n?kt(t,e,n):e&&"function"!=typeof e?t:kt(t,e)},P.forEach(function(t){xt[t]=St;}),N.forEach(function(t){xt[t+"s"]=Et;}),xt.watch=function(t,e,n,r){if(t===Z&&(t=void 0),e===Z&&(e=void 0),!e)return Object.create(t||null);if(!t)return e;var o={};for(var i in x(o,t),e){var a=o[i],s=e[i];a&&!Array.isArray(a)&&(a=[a]),o[i]=a?a.concat(s):Array.isArray(s)?s:[s];}return o},xt.props=xt.methods=xt.inject=xt.computed=function(t,e,n,r){if(!t)return e;var o=Object.create(null);return x(o,t),e&&x(o,e),o},xt.provide=kt;var jt=function(t,e){return void 0===e?t:e};function Tt(t,e,n){if("function"==typeof e&&(e=e.options),function(t,e){var n=t.props;if(n){var r,o,i={};if(Array.isArray(n))for(r=n.length;r--;)"string"==typeof(o=n[r])&&(i[_(o)]={type:null});else if(s(n))for(var a in n)o=n[a],i[_(a)]=s(o)?o:{type:o};t.props=i;}}(e),function(t,e){var n=t.inject;if(n){var r=t.inject={};if(Array.isArray(n))for(var o=0;o<n.length;o++)r[n[o]]={from:n[o]};else if(s(n))for(var i in n){var a=n[i];r[i]=s(a)?x({from:i},a):{from:a};}}}(e),function(t){var e=t.directives;if(e)for(var n in e){var r=e[n];"function"==typeof r&&(e[n]={bind:r,update:r});}}(e),!e._base&&(e.extends&&(t=Tt(t,e.extends,n)),e.mixins))for(var r=0,o=e.mixins.length;r<o;r++)t=Tt(t,e.mixins[r],n);var i,a={};for(i in t)c(i);for(i in e)m(t,i)||c(i);function c(r){var o=xt[r]||jt;a[r]=o(t[r],e[r],n,r);}return a}function It(t,e,n,r){if("string"==typeof n){var o=t[e];if(m(o,n))return o[n];var i=_(n);if(m(o,i))return o[i];var a=b(i);return m(o,a)?o[a]:o[n]||o[i]||o[a]}}function Dt(t,e,n,r){var o=e[t],i=!m(n,t),a=n[t],s=Lt(Boolean,o.type);if(s>-1)if(i&&!m(o,"default"))a=!1;else if(""===a||a===$(t)){var c=Lt(String,o.type);(c<0||s<c)&&(a=!0);}if(void 0===a){a=function(t,e,n){if(!m(e,"default"))return;var r=e.default;if(t&&t.$options.propsData&&void 0===t.$options.propsData[n]&&void 0!==t._props[n])return t._props[n];return "function"==typeof r&&"Function"!==Nt(e.type)?r.call(t):r}(r,o,t);var u=gt;_t(!0),Ct(a),_t(u);}return a}function Nt(t){var e=t&&t.toString().match(/^\s*function (\w+)/);return e?e[1]:""}function Pt(t,e){return Nt(t)===Nt(e)}function Lt(t,e){if(!Array.isArray(e))return Pt(e,t)?0:-1;for(var n=0,r=e.length;n<r;n++)if(Pt(e[n],t))return n;return -1}function Mt(t,e,n){ct();try{if(e)for(var r=e;r=r.$parent;){var o=r.$options.errorCaptured;if(o)for(var i=0;i<o.length;i++)try{if(!1===o[i].call(r,t,e,n))return}catch(t){Rt(t,r,"errorCaptured hook");}}Rt(t,e,n);}finally{ut();}}function Ft(t,e,n,r,o){var i;try{(i=n?t.apply(e,n):t.call(e))&&!i._isVue&&u(i)&&!i._handled&&(i.catch(function(t){return Mt(t,r,o+" (Promise/async)")}),i._handled=!0);}catch(t){Mt(t,r,o);}return i}function Rt(t,e,n){if(L.errorHandler)try{return L.errorHandler.call(null,t,e,n)}catch(e){e!==t&&Ut(e);}Ut(t);}function Ut(t,e,n){if(!B||"undefined"==typeof console)throw t;console.error(t);}var Ht,Bt=!1,Vt=[],zt=!1;function Wt(){zt=!1;var t=Vt.slice(0);Vt.length=0;for(var e=0;e<t.length;e++)t[e]();}if("undefined"!=typeof Promise&&et(Promise)){var qt=Promise.resolve();Ht=function(){qt.then(Wt),X&&setTimeout(k);},Bt=!0;}else if("undefined"==typeof MutationObserver||!et(MutationObserver)&&"[object MutationObserverConstructor]"!==MutationObserver.toString())Ht="undefined"!=typeof setImmediate&&et(setImmediate)?function(){setImmediate(Wt);}:function(){setTimeout(Wt,0);};else {var Kt=1,Xt=new MutationObserver(Wt),Gt=document.createTextNode(String(Kt));Xt.observe(Gt,{characterData:!0}),Ht=function(){Kt=(Kt+1)%2,Gt.data=String(Kt);},Bt=!0;}function Zt(t,e){var n;if(Vt.push(function(){if(t)try{t.call(e);}catch(t){Mt(t,e,"nextTick");}else n&&n(e);}),zt||(zt=!0,Ht()),!t&&"undefined"!=typeof Promise)return new Promise(function(t){n=t;})}var Jt=new nt;function Qt(t){!function t(e,n){var r,o;var a=Array.isArray(e);if(!a&&!i(e)||Object.isFrozen(e)||e instanceof lt)return;if(e.__ob__){var s=e.__ob__.dep.id;if(n.has(s))return;n.add(s);}if(a)for(r=e.length;r--;)t(e[r],n);else for(o=Object.keys(e),r=o.length;r--;)t(e[o[r]],n);}(t,Jt),Jt.clear();}var Yt=y(function(t){var e="&"===t.charAt(0),n="~"===(t=e?t.slice(1):t).charAt(0),r="!"===(t=n?t.slice(1):t).charAt(0);return {name:t=r?t.slice(1):t,once:n,capture:r,passive:e}});function te(t,e){function n(){var t=arguments,r=n.fns;if(!Array.isArray(r))return Ft(r,null,arguments,e,"v-on handler");for(var o=r.slice(),i=0;i<o.length;i++)Ft(o[i],null,t,e,"v-on handler");}return n.fns=t,n}function ee(t,n,o,i,a,s){var c,u,l,f;for(c in t)u=t[c],l=n[c],f=Yt(c),e(u)||(e(l)?(e(u.fns)&&(u=t[c]=te(u,s)),r(f.once)&&(u=t[c]=a(f.name,u,f.capture)),o(f.name,u,f.capture,f.passive,f.params)):u!==l&&(l.fns=u,t[c]=l));for(c in n)e(t[c])&&i((f=Yt(c)).name,n[c],f.capture);}function ne(t,o,i){var a;t instanceof lt&&(t=t.data.hook||(t.data.hook={}));var s=t[o];function c(){i.apply(this,arguments),v(a.fns,c);}e(s)?a=te([c]):n(s.fns)&&r(s.merged)?(a=s).fns.push(c):a=te([s,c]),a.merged=!0,t[o]=a;}function re(t,e,r,o,i){if(n(e)){if(m(e,r))return t[r]=e[r],i||delete e[r],!0;if(m(e,o))return t[r]=e[o],i||delete e[o],!0}return !1}function oe(t){return o(t)?[dt(t)]:Array.isArray(t)?function t(i,a){var s=[];var c,u,l,f;for(c=0;c<i.length;c++)e(u=i[c])||"boolean"==typeof u||(l=s.length-1,f=s[l],Array.isArray(u)?u.length>0&&(ie((u=t(u,(a||"")+"_"+c))[0])&&ie(f)&&(s[l]=dt(f.text+u[0].text),u.shift()),s.push.apply(s,u)):o(u)?ie(f)?s[l]=dt(f.text+u):""!==u&&s.push(dt(u)):ie(u)&&ie(f)?s[l]=dt(f.text+u.text):(r(i._isVList)&&n(u.tag)&&e(u.key)&&n(a)&&(u.key="__vlist"+a+"_"+c+"__"),s.push(u)));return s}(t):void 0}function ie(t){return n(t)&&n(t.text)&&!1===t.isComment}function ae(t,e){if(t){for(var n=Object.create(null),r=rt?Reflect.ownKeys(t):Object.keys(t),o=0;o<r.length;o++){var i=r[o];if("__ob__"!==i){for(var a=t[i].from,s=e;s;){if(s._provided&&m(s._provided,a)){n[i]=s._provided[a];break}s=s.$parent;}if(!s&&"default"in t[i]){var c=t[i].default;n[i]="function"==typeof c?c.call(e):c;}}}return n}}function se(t,e){if(!t||!t.length)return {};for(var n={},r=0,o=t.length;r<o;r++){var i=t[r],a=i.data;if(a&&a.attrs&&a.attrs.slot&&delete a.attrs.slot,i.context!==e&&i.fnContext!==e||!a||null==a.slot)(n.default||(n.default=[])).push(i);else {var s=a.slot,c=n[s]||(n[s]=[]);"template"===i.tag?c.push.apply(c,i.children||[]):c.push(i);}}for(var u in n)n[u].every(ce)&&delete n[u];return n}function ce(t){return t.isComment&&!t.asyncFactory||" "===t.text}function ue(e,n,r){var o,i=Object.keys(n).length>0,a=e?!!e.$stable:!i,s=e&&e.$key;if(e){if(e._normalized)return e._normalized;if(a&&r&&r!==t&&s===r.$key&&!i&&!r.$hasNormal)return r;for(var c in o={},e)e[c]&&"$"!==c[0]&&(o[c]=le(n,c,e[c]));}else o={};for(var u in n)u in o||(o[u]=fe(n,u));return e&&Object.isExtensible(e)&&(e._normalized=o),M(o,"$stable",a),M(o,"$key",s),M(o,"$hasNormal",i),o}function le(t,e,n){var r=function(){var t=arguments.length?n.apply(null,arguments):n({});return (t=t&&"object"==typeof t&&!Array.isArray(t)?[t]:oe(t))&&(0===t.length||1===t.length&&t[0].isComment)?void 0:t};return n.proxy&&Object.defineProperty(t,e,{get:r,enumerable:!0,configurable:!0}),r}function fe(t,e){return function(){return t[e]}}function pe(t,e){var r,o,a,s,c;if(Array.isArray(t)||"string"==typeof t)for(r=new Array(t.length),o=0,a=t.length;o<a;o++)r[o]=e(t[o],o);else if("number"==typeof t)for(r=new Array(t),o=0;o<t;o++)r[o]=e(o+1,o);else if(i(t))if(rt&&t[Symbol.iterator]){r=[];for(var u=t[Symbol.iterator](),l=u.next();!l.done;)r.push(e(l.value,r.length)),l=u.next();}else for(s=Object.keys(t),r=new Array(s.length),o=0,a=s.length;o<a;o++)c=s[o],r[o]=e(t[c],c,o);return n(r)||(r=[]),r._isVList=!0,r}function de(t,e,n,r){var o,i=this.$scopedSlots[t];i?(n=n||{},r&&(n=x(x({},r),n)),o=i(n)||e):o=this.$slots[t]||e;var a=n&&n.slot;return a?this.$createElement("template",{slot:a},o):o}function ve(t){return It(this.$options,"filters",t)||E}function he(t,e){return Array.isArray(t)?-1===t.indexOf(e):t!==e}function me(t,e,n,r,o){var i=L.keyCodes[e]||n;return o&&r&&!L.keyCodes[e]?he(o,r):i?he(i,t):r?$(r)!==e:void 0}function ye(t,e,n,r,o){if(n)if(i(n)){var a;Array.isArray(n)&&(n=O(n));var s=function(i){if("class"===i||"style"===i||d(i))a=t;else {var s=t.attrs&&t.attrs.type;a=r||L.mustUseProp(e,s,i)?t.domProps||(t.domProps={}):t.attrs||(t.attrs={});}var c=_(i),u=$(i);c in a||u in a||(a[i]=n[i],o&&((t.on||(t.on={}))["update:"+i]=function(t){n[i]=t;}));};for(var c in n)s(c);}return t}function ge(t,e){var n=this._staticTrees||(this._staticTrees=[]),r=n[t];return r&&!e?r:(be(r=n[t]=this.$options.staticRenderFns[t].call(this._renderProxy,null,this),"__static__"+t,!1),r)}function _e(t,e,n){return be(t,"__once__"+e+(n?"_"+n:""),!0),t}function be(t,e,n){if(Array.isArray(t))for(var r=0;r<t.length;r++)t[r]&&"string"!=typeof t[r]&&Ce(t[r],e+"_"+r,n);else Ce(t,e,n);}function Ce(t,e,n){t.isStatic=!0,t.key=e,t.isOnce=n;}function $e(t,e){if(e)if(s(e)){var n=t.on=t.on?x({},t.on):{};for(var r in e){var o=n[r],i=e[r];n[r]=o?[].concat(o,i):i;}}return t}function we(t,e,n,r){e=e||{$stable:!n};for(var o=0;o<t.length;o++){var i=t[o];Array.isArray(i)?we(i,e,n):i&&(i.proxy&&(i.fn.proxy=!0),e[i.key]=i.fn);}return r&&(e.$key=r),e}function Ae(t,e){for(var n=0;n<e.length;n+=2){var r=e[n];"string"==typeof r&&r&&(t[e[n]]=e[n+1]);}return t}function xe(t,e){return "string"==typeof t?e+t:t}function Oe(t){t._o=_e,t._n=f,t._s=l,t._l=pe,t._t=de,t._q=j,t._i=T,t._m=ge,t._f=ve,t._k=me,t._b=ye,t._v=dt,t._e=pt,t._u=we,t._g=$e,t._d=Ae,t._p=xe;}function ke(e,n,o,i,a){var s,c=this,u=a.options;m(i,"_uid")?(s=Object.create(i))._original=i:(s=i,i=i._original);var l=r(u._compiled),f=!l;this.data=e,this.props=n,this.children=o,this.parent=i,this.listeners=e.on||t,this.injections=ae(u.inject,i),this.slots=function(){return c.$slots||ue(e.scopedSlots,c.$slots=se(o,i)),c.$slots},Object.defineProperty(this,"scopedSlots",{enumerable:!0,get:function(){return ue(e.scopedSlots,this.slots())}}),l&&(this.$options=u,this.$slots=this.slots(),this.$scopedSlots=ue(e.scopedSlots,this.$slots)),u._scopeId?this._c=function(t,e,n,r){var o=Le(s,t,e,n,r,f);return o&&!Array.isArray(o)&&(o.fnScopeId=u._scopeId,o.fnContext=i),o}:this._c=function(t,e,n,r){return Le(s,t,e,n,r,f)};}function Se(t,e,n,r,o){var i=vt(t);return i.fnContext=n,i.fnOptions=r,e.slot&&((i.data||(i.data={})).slot=e.slot),i}function Ee(t,e){for(var n in e)t[_(n)]=e[n];}Oe(ke.prototype);var je={init:function(t,e){if(t.componentInstance&&!t.componentInstance._isDestroyed&&t.data.keepAlive){var r=t;je.prepatch(r,r);}else {(t.componentInstance=function(t,e){var r={_isComponent:!0,_parentVnode:t,parent:e},o=t.data.inlineTemplate;n(o)&&(r.render=o.render,r.staticRenderFns=o.staticRenderFns);return new t.componentOptions.Ctor(r)}(t,qe)).$mount(e?t.elm:void 0,e);}},prepatch:function(e,n){var r=n.componentOptions;!function(e,n,r,o,i){var a=o.data.scopedSlots,s=e.$scopedSlots,c=!!(a&&!a.$stable||s!==t&&!s.$stable||a&&e.$scopedSlots.$key!==a.$key),u=!!(i||e.$options._renderChildren||c);e.$options._parentVnode=o,e.$vnode=o,e._vnode&&(e._vnode.parent=o);if(e.$options._renderChildren=i,e.$attrs=o.data.attrs||t,e.$listeners=r||t,n&&e.$options.props){_t(!1);for(var l=e._props,f=e.$options._propKeys||[],p=0;p<f.length;p++){var d=f[p],v=e.$options.props;l[d]=Dt(d,v,n,e);}_t(!0),e.$options.propsData=n;}r=r||t;var h=e.$options._parentListeners;e.$options._parentListeners=r,We(e,r,h),u&&(e.$slots=se(i,o.context),e.$forceUpdate());}(n.componentInstance=e.componentInstance,r.propsData,r.listeners,n,r.children);},insert:function(t){var e,n=t.context,r=t.componentInstance;r._isMounted||(r._isMounted=!0,Ze(r,"mounted")),t.data.keepAlive&&(n._isMounted?((e=r)._inactive=!1,Qe.push(e)):Ge(r,!0));},destroy:function(t){var e=t.componentInstance;e._isDestroyed||(t.data.keepAlive?function t(e,n){if(n&&(e._directInactive=!0,Xe(e)))return;if(!e._inactive){e._inactive=!0;for(var r=0;r<e.$children.length;r++)t(e.$children[r]);Ze(e,"deactivated");}}(e,!0):e.$destroy());}},Te=Object.keys(je);function Ie(o,a,s,c,l){if(!e(o)){var f=s.$options._base;if(i(o)&&(o=f.extend(o)),"function"==typeof o){var p;if(e(o.cid)&&void 0===(o=function(t,o){if(r(t.error)&&n(t.errorComp))return t.errorComp;if(n(t.resolved))return t.resolved;var a=Fe;a&&n(t.owners)&&-1===t.owners.indexOf(a)&&t.owners.push(a);if(r(t.loading)&&n(t.loadingComp))return t.loadingComp;if(a&&!n(t.owners)){var s=t.owners=[a],c=!0,l=null,f=null;a.$on("hook:destroyed",function(){return v(s,a)});var p=function(t){for(var e=0,n=s.length;e<n;e++)s[e].$forceUpdate();t&&(s.length=0,null!==l&&(clearTimeout(l),l=null),null!==f&&(clearTimeout(f),f=null));},d=I(function(e){t.resolved=Re(e,o),c?s.length=0:p(!0);}),h=I(function(e){n(t.errorComp)&&(t.error=!0,p(!0));}),m=t(d,h);return i(m)&&(u(m)?e(t.resolved)&&m.then(d,h):u(m.component)&&(m.component.then(d,h),n(m.error)&&(t.errorComp=Re(m.error,o)),n(m.loading)&&(t.loadingComp=Re(m.loading,o),0===m.delay?t.loading=!0:l=setTimeout(function(){l=null,e(t.resolved)&&e(t.error)&&(t.loading=!0,p(!1));},m.delay||200)),n(m.timeout)&&(f=setTimeout(function(){f=null,e(t.resolved)&&h(null);},m.timeout)))),c=!1,t.loading?t.loadingComp:t.resolved}}(p=o,f)))return function(t,e,n,r,o){var i=pt();return i.asyncFactory=t,i.asyncMeta={data:e,context:n,children:r,tag:o},i}(p,a,s,c,l);a=a||{},_n(o),n(a.model)&&function(t,e){var r=t.model&&t.model.prop||"value",o=t.model&&t.model.event||"input";(e.attrs||(e.attrs={}))[r]=e.model.value;var i=e.on||(e.on={}),a=i[o],s=e.model.callback;n(a)?(Array.isArray(a)?-1===a.indexOf(s):a!==s)&&(i[o]=[s].concat(a)):i[o]=s;}(o.options,a);var d=function(t,r,o){var i=r.options.props;if(!e(i)){var a={},s=t.attrs,c=t.props;if(n(s)||n(c))for(var u in i){var l=$(u);re(a,c,u,l,!0)||re(a,s,u,l,!1);}return a}}(a,o);if(r(o.options.functional))return function(e,r,o,i,a){var s=e.options,c={},u=s.props;if(n(u))for(var l in u)c[l]=Dt(l,u,r||t);else n(o.attrs)&&Ee(c,o.attrs),n(o.props)&&Ee(c,o.props);var f=new ke(o,c,a,i,e),p=s.render.call(null,f._c,f);if(p instanceof lt)return Se(p,o,f.parent,s);if(Array.isArray(p)){for(var d=oe(p)||[],v=new Array(d.length),h=0;h<d.length;h++)v[h]=Se(d[h],o,f.parent,s);return v}}(o,d,a,s,c);var h=a.on;if(a.on=a.nativeOn,r(o.options.abstract)){var m=a.slot;a={},m&&(a.slot=m);}!function(t){for(var e=t.hook||(t.hook={}),n=0;n<Te.length;n++){var r=Te[n],o=e[r],i=je[r];o===i||o&&o._merged||(e[r]=o?De(i,o):i);}}(a);var y=o.options.name||l;return new lt("vue-component-"+o.cid+(y?"-"+y:""),a,void 0,void 0,void 0,s,{Ctor:o,propsData:d,listeners:h,tag:l,children:c},p)}}}function De(t,e){var n=function(n,r){t(n,r),e(n,r);};return n._merged=!0,n}var Ne=1,Pe=2;function Le(t,a,s,c,u,l){return (Array.isArray(s)||o(s))&&(u=c,c=s,s=void 0),r(l)&&(u=Pe),function(t,o,a,s,c){if(n(a)&&n(a.__ob__))return pt();n(a)&&n(a.is)&&(o=a.is);if(!o)return pt();Array.isArray(s)&&"function"==typeof s[0]&&((a=a||{}).scopedSlots={default:s[0]},s.length=0);c===Pe?s=oe(s):c===Ne&&(s=function(t){for(var e=0;e<t.length;e++)if(Array.isArray(t[e]))return Array.prototype.concat.apply([],t);return t}(s));var u,l;if("string"==typeof o){var f;l=t.$vnode&&t.$vnode.ns||L.getTagNamespace(o),u=L.isReservedTag(o)?new lt(L.parsePlatformTagName(o),a,s,void 0,void 0,t):a&&a.pre||!n(f=It(t.$options,"components",o))?new lt(o,a,s,void 0,void 0,t):Ie(f,a,t,s,o);}else u=Ie(o,a,t,s);return Array.isArray(u)?u:n(u)?(n(l)&&function t(o,i,a){o.ns=i;"foreignObject"===o.tag&&(i=void 0,a=!0);if(n(o.children))for(var s=0,c=o.children.length;s<c;s++){var u=o.children[s];n(u.tag)&&(e(u.ns)||r(a)&&"svg"!==u.tag)&&t(u,i,a);}}(u,l),n(a)&&function(t){i(t.style)&&Qt(t.style);i(t.class)&&Qt(t.class);}(a),u):pt()}(t,a,s,c,u)}var Me,Fe=null;function Re(t,e){return (t.__esModule||rt&&"Module"===t[Symbol.toStringTag])&&(t=t.default),i(t)?e.extend(t):t}function Ue(t){return t.isComment&&t.asyncFactory}function He(t){if(Array.isArray(t))for(var e=0;e<t.length;e++){var r=t[e];if(n(r)&&(n(r.componentOptions)||Ue(r)))return r}}function Be(t,e){Me.$on(t,e);}function Ve(t,e){Me.$off(t,e);}function ze(t,e){var n=Me;return function r(){null!==e.apply(null,arguments)&&n.$off(t,r);}}function We(t,e,n){Me=t,ee(e,n||{},Be,Ve,ze,t),Me=void 0;}var qe=null;function Ke(t){var e=qe;return qe=t,function(){qe=e;}}function Xe(t){for(;t&&(t=t.$parent);)if(t._inactive)return !0;return !1}function Ge(t,e){if(e){if(t._directInactive=!1,Xe(t))return}else if(t._directInactive)return;if(t._inactive||null===t._inactive){t._inactive=!1;for(var n=0;n<t.$children.length;n++)Ge(t.$children[n]);Ze(t,"activated");}}function Ze(t,e){ct();var n=t.$options[e],r=e+" hook";if(n)for(var o=0,i=n.length;o<i;o++)Ft(n[o],t,null,t,r);t._hasHookEvent&&t.$emit("hook:"+e),ut();}var Je=[],Qe=[],Ye={},tn=!1,en=!1,nn=0;var rn=0,on=Date.now;function sn(){var t,e;for(rn=on(),en=!0,Je.sort(function(t,e){return t.id-e.id}),nn=0;nn<Je.length;nn++)(t=Je[nn]).before&&t.before(),e=t.id,Ye[e]=null,t.run();var n=Qe.slice(),r=Je.slice();nn=Je.length=Qe.length=0,Ye={},tn=en=!1,function(t){for(var e=0;e<t.length;e++)t[e]._inactive=!0,Ge(t[e],!0);}(n),function(t){var e=t.length;for(;e--;){var n=t[e],r=n.vm;r._watcher===n&&r._isMounted&&!r._isDestroyed&&Ze(r,"updated");}}(r),tt;}var cn=0,un=function(t,e,n,r,o){this.vm=t,o&&(t._watcher=this),t._watchers.push(this),r?(this.deep=!!r.deep,this.user=!!r.user,this.lazy=!!r.lazy,this.sync=!!r.sync,this.before=r.before):this.deep=this.user=this.lazy=this.sync=!1,this.cb=n,this.id=++cn,this.active=!0,this.dirty=this.lazy,this.deps=[],this.newDeps=[],this.depIds=new nt,this.newDepIds=new nt,this.expression="","function"==typeof e?this.getter=e:(this.getter=function(t){if(!F.test(t)){var e=t.split(".");return function(t){for(var n=0;n<e.length;n++){if(!t)return;t=t[e[n]];}return t}}}(e),this.getter||(this.getter=k)),this.value=this.lazy?void 0:this.get();};un.prototype.get=function(){var t;ct(this);var e=this.vm;try{t=this.getter.call(e,e);}catch(t){if(!this.user)throw t;Mt(t,e,'getter for watcher "'+this.expression+'"');}finally{this.deep&&Qt(t),ut(),this.cleanupDeps();}return t},un.prototype.addDep=function(t){var e=t.id;this.newDepIds.has(e)||(this.newDepIds.add(e),this.newDeps.push(t),this.depIds.has(e)||t.addSub(this));},un.prototype.cleanupDeps=function(){for(var t=this.deps.length;t--;){var e=this.deps[t];this.newDepIds.has(e.id)||e.removeSub(this);}var n=this.depIds;this.depIds=this.newDepIds,this.newDepIds=n,this.newDepIds.clear(),n=this.deps,this.deps=this.newDeps,this.newDeps=n,this.newDeps.length=0;},un.prototype.update=function(){this.lazy?this.dirty=!0:this.sync?this.run():function(t){var e=t.id;if(null==Ye[e]){if(Ye[e]=!0,en){for(var n=Je.length-1;n>nn&&Je[n].id>t.id;)n--;Je.splice(n+1,0,t);}else Je.push(t);tn||(tn=!0,Zt(sn));}}(this);},un.prototype.run=function(){if(this.active){var t=this.get();if(t!==this.value||i(t)||this.deep){var e=this.value;if(this.value=t,this.user)try{this.cb.call(this.vm,t,e);}catch(t){Mt(t,this.vm,'callback for watcher "'+this.expression+'"');}else this.cb.call(this.vm,t,e);}}},un.prototype.evaluate=function(){this.value=this.get(),this.dirty=!1;},un.prototype.depend=function(){for(var t=this.deps.length;t--;)this.deps[t].depend();},un.prototype.teardown=function(){if(this.active){this.vm._isBeingDestroyed||v(this.vm._watchers,this);for(var t=this.deps.length;t--;)this.deps[t].removeSub(this);this.active=!1;}};var ln={enumerable:!0,configurable:!0,get:k,set:k};function fn(t,e,n){ln.get=function(){return this[e][n]},ln.set=function(t){this[e][n]=t;},Object.defineProperty(t,n,ln);}function pn(t){t._watchers=[];var e=t.$options;e.props&&function(t,e){var n=t.$options.propsData||{},r=t._props={},o=t.$options._propKeys=[];t.$parent&&_t(!1);var i=function(i){o.push(i);var a=Dt(i,e,n,t);$t(r,i,a),i in t||fn(t,"_props",i);};for(var a in e)i(a);_t(!0);}(t,e.props),e.methods&&function(t,e){t.$options.props;for(var n in e)t[n]="function"!=typeof e[n]?k:w(e[n],t);}(t,e.methods),e.data?function(t){var e=t.$options.data;s(e=t._data="function"==typeof e?function(t,e){ct();try{return t.call(e,e)}catch(t){return Mt(t,e,"data()"),{}}finally{ut();}}(e,t):e||{})||(e={});var n=Object.keys(e),r=t.$options.props,o=(t.$options.methods,n.length);for(;o--;){var i=n[o];r&&m(r,i)||(a=void 0,36!==(a=(i+"").charCodeAt(0))&&95!==a&&fn(t,"_data",i));}var a;Ct(e,!0);}(t):Ct(t._data={},!0),e.computed&&function(t,e){var n=t._computedWatchers=Object.create(null),r=Y();for(var o in e){var i=e[o],a="function"==typeof i?i:i.get;r||(n[o]=new un(t,a||k,k,dn)),o in t||vn(t,o,i);}}(t,e.computed),e.watch&&e.watch!==Z&&function(t,e){for(var n in e){var r=e[n];if(Array.isArray(r))for(var o=0;o<r.length;o++)yn(t,n,r[o]);else yn(t,n,r);}}(t,e.watch);}var dn={lazy:!0};function vn(t,e,n){var r=!Y();"function"==typeof n?(ln.get=r?hn(e):mn(n),ln.set=k):(ln.get=n.get?r&&!1!==n.cache?hn(e):mn(n.get):k,ln.set=n.set||k),Object.defineProperty(t,e,ln);}function hn(t){return function(){var e=this._computedWatchers&&this._computedWatchers[t];if(e)return e.dirty&&e.evaluate(),at.target&&e.depend(),e.value}}function mn(t){return function(){return t.call(this,this)}}function yn(t,e,n,r){return s(n)&&(r=n,n=n.handler),"string"==typeof n&&(n=t[n]),t.$watch(e,n,r)}var gn=0;function _n(t){var e=t.options;if(t.super){var n=_n(t.super);if(n!==t.superOptions){t.superOptions=n;var r=function(t){var e,n=t.options,r=t.sealedOptions;for(var o in n)n[o]!==r[o]&&(e||(e={}),e[o]=n[o]);return e}(t);r&&x(t.extendOptions,r),(e=t.options=Tt(n,t.extendOptions)).name&&(e.components[e.name]=t);}}return e}function bn(t){this._init(t);}function Cn(t){t.cid=0;var e=1;t.extend=function(t){t=t||{};var n=this,r=n.cid,o=t._Ctor||(t._Ctor={});if(o[r])return o[r];var i=t.name||n.options.name,a=function(t){this._init(t);};return (a.prototype=Object.create(n.prototype)).constructor=a,a.cid=e++,a.options=Tt(n.options,t),a.super=n,a.options.props&&function(t){var e=t.options.props;for(var n in e)fn(t.prototype,"_props",n);}(a),a.options.computed&&function(t){var e=t.options.computed;for(var n in e)vn(t.prototype,n,e[n]);}(a),a.extend=n.extend,a.mixin=n.mixin,a.use=n.use,N.forEach(function(t){a[t]=n[t];}),i&&(a.options.components[i]=a),a.superOptions=n.options,a.extendOptions=t,a.sealedOptions=x({},a.options),o[r]=a,a};}function $n(t){return t&&(t.Ctor.options.name||t.tag)}function wn(t,e){return Array.isArray(t)?t.indexOf(e)>-1:"string"==typeof t?t.split(",").indexOf(e)>-1:(n=t,"[object RegExp]"===a.call(n)&&t.test(e));var n;}function An(t,e){var n=t.cache,r=t.keys,o=t._vnode;for(var i in n){var a=n[i];if(a){var s=$n(a.componentOptions);s&&!e(s)&&xn(n,i,r,o);}}}function xn(t,e,n,r){var o=t[e];!o||r&&o.tag===r.tag||o.componentInstance.$destroy(),t[e]=null,v(n,e);}!function(e){e.prototype._init=function(e){var n=this;n._uid=gn++,n._isVue=!0,e&&e._isComponent?function(t,e){var n=t.$options=Object.create(t.constructor.options),r=e._parentVnode;n.parent=e.parent,n._parentVnode=r;var o=r.componentOptions;n.propsData=o.propsData,n._parentListeners=o.listeners,n._renderChildren=o.children,n._componentTag=o.tag,e.render&&(n.render=e.render,n.staticRenderFns=e.staticRenderFns);}(n,e):n.$options=Tt(_n(n.constructor),e||{},n),n._renderProxy=n,n._self=n,function(t){var e=t.$options,n=e.parent;if(n&&!e.abstract){for(;n.$options.abstract&&n.$parent;)n=n.$parent;n.$children.push(t);}t.$parent=n,t.$root=n?n.$root:t,t.$children=[],t.$refs={},t._watcher=null,t._inactive=null,t._directInactive=!1,t._isMounted=!1,t._isDestroyed=!1,t._isBeingDestroyed=!1;}(n),function(t){t._events=Object.create(null),t._hasHookEvent=!1;var e=t.$options._parentListeners;e&&We(t,e);}(n),function(e){e._vnode=null,e._staticTrees=null;var n=e.$options,r=e.$vnode=n._parentVnode,o=r&&r.context;e.$slots=se(n._renderChildren,o),e.$scopedSlots=t,e._c=function(t,n,r,o){return Le(e,t,n,r,o,!1)},e.$createElement=function(t,n,r,o){return Le(e,t,n,r,o,!0)};var i=r&&r.data;$t(e,"$attrs",i&&i.attrs||t,null,!0),$t(e,"$listeners",n._parentListeners||t,null,!0);}(n),Ze(n,"beforeCreate"),function(t){var e=ae(t.$options.inject,t);e&&(_t(!1),Object.keys(e).forEach(function(n){$t(t,n,e[n]);}),_t(!0));}(n),pn(n),function(t){var e=t.$options.provide;e&&(t._provided="function"==typeof e?e.call(t):e);}(n),Ze(n,"created"),n.$options.el&&n.$mount(n.$options.el);};}(bn),function(t){var e={get:function(){return this._data}},n={get:function(){return this._props}};Object.defineProperty(t.prototype,"$data",e),Object.defineProperty(t.prototype,"$props",n),t.prototype.$set=wt,t.prototype.$delete=At,t.prototype.$watch=function(t,e,n){if(s(e))return yn(this,t,e,n);(n=n||{}).user=!0;var r=new un(this,t,e,n);if(n.immediate)try{e.call(this,r.value);}catch(t){Mt(t,this,'callback for immediate watcher "'+r.expression+'"');}return function(){r.teardown();}};}(bn),function(t){var e=/^hook:/;t.prototype.$on=function(t,n){var r=this;if(Array.isArray(t))for(var o=0,i=t.length;o<i;o++)r.$on(t[o],n);else (r._events[t]||(r._events[t]=[])).push(n),e.test(t)&&(r._hasHookEvent=!0);return r},t.prototype.$once=function(t,e){var n=this;function r(){n.$off(t,r),e.apply(n,arguments);}return r.fn=e,n.$on(t,r),n},t.prototype.$off=function(t,e){var n=this;if(!arguments.length)return n._events=Object.create(null),n;if(Array.isArray(t)){for(var r=0,o=t.length;r<o;r++)n.$off(t[r],e);return n}var i,a=n._events[t];if(!a)return n;if(!e)return n._events[t]=null,n;for(var s=a.length;s--;)if((i=a[s])===e||i.fn===e){a.splice(s,1);break}return n},t.prototype.$emit=function(t){var e=this._events[t];if(e){e=e.length>1?A(e):e;for(var n=A(arguments,1),r='event handler for "'+t+'"',o=0,i=e.length;o<i;o++)Ft(e[o],this,n,this,r);}return this};}(bn),function(t){t.prototype._update=function(t,e){var n=this,r=n.$el,o=n._vnode,i=Ke(n);n._vnode=t,n.$el=o?n.__patch__(o,t):n.__patch__(n.$el,t,e,!1),i(),r&&(r.__vue__=null),n.$el&&(n.$el.__vue__=n),n.$vnode&&n.$parent&&n.$vnode===n.$parent._vnode&&(n.$parent.$el=n.$el);},t.prototype.$forceUpdate=function(){this._watcher&&this._watcher.update();},t.prototype.$destroy=function(){var t=this;if(!t._isBeingDestroyed){Ze(t,"beforeDestroy"),t._isBeingDestroyed=!0;var e=t.$parent;!e||e._isBeingDestroyed||t.$options.abstract||v(e.$children,t),t._watcher&&t._watcher.teardown();for(var n=t._watchers.length;n--;)t._watchers[n].teardown();t._data.__ob__&&t._data.__ob__.vmCount--,t._isDestroyed=!0,t.__patch__(t._vnode,null),Ze(t,"destroyed"),t.$off(),t.$el&&(t.$el.__vue__=null),t.$vnode&&(t.$vnode.parent=null);}};}(bn),function(t){Oe(t.prototype),t.prototype.$nextTick=function(t){return Zt(t,this)},t.prototype._render=function(){var t,e=this,n=e.$options,r=n.render,o=n._parentVnode;o&&(e.$scopedSlots=ue(o.data.scopedSlots,e.$slots,e.$scopedSlots)),e.$vnode=o;try{Fe=e,t=r.call(e._renderProxy,e.$createElement);}catch(n){Mt(n,e,"render"),t=e._vnode;}finally{Fe=null;}return Array.isArray(t)&&1===t.length&&(t=t[0]),t instanceof lt||(t=pt()),t.parent=o,t};}(bn);var On=[String,RegExp,Array],kn={KeepAlive:{name:"keep-alive",abstract:!0,props:{include:On,exclude:On,max:[String,Number]},created:function(){this.cache=Object.create(null),this.keys=[];},destroyed:function(){for(var t in this.cache)xn(this.cache,t,this.keys);},mounted:function(){var t=this;this.$watch("include",function(e){An(t,function(t){return wn(e,t)});}),this.$watch("exclude",function(e){An(t,function(t){return !wn(e,t)});});},render:function(){var t=this.$slots.default,e=He(t),n=e&&e.componentOptions;if(n){var r=$n(n),o=this.include,i=this.exclude;if(o&&(!r||!wn(o,r))||i&&r&&wn(i,r))return e;var a=this.cache,s=this.keys,c=null==e.key?n.Ctor.cid+(n.tag?"::"+n.tag:""):e.key;a[c]?(e.componentInstance=a[c].componentInstance,v(s,c),s.push(c)):(a[c]=e,s.push(c),this.max&&s.length>parseInt(this.max)&&xn(a,s[0],s,this._vnode)),e.data.keepAlive=!0;}return e||t&&t[0]}}};!function(t){var e={get:function(){return L}};Object.defineProperty(t,"config",e),t.util={warn:ot,extend:x,mergeOptions:Tt,defineReactive:$t},t.set=wt,t.delete=At,t.nextTick=Zt,t.observable=function(t){return Ct(t),t},t.options=Object.create(null),N.forEach(function(e){t.options[e+"s"]=Object.create(null);}),t.options._base=t,x(t.options.components,kn),function(t){t.use=function(t){var e=this._installedPlugins||(this._installedPlugins=[]);if(e.indexOf(t)>-1)return this;var n=A(arguments,1);return n.unshift(this),"function"==typeof t.install?t.install.apply(t,n):"function"==typeof t&&t.apply(null,n),e.push(t),this};}(t),function(t){t.mixin=function(t){return this.options=Tt(this.options,t),this};}(t),Cn(t),function(t){N.forEach(function(e){t[e]=function(t,n){return n?("component"===e&&s(n)&&(n.name=n.name||t,n=this.options._base.extend(n)),"directive"===e&&"function"==typeof n&&(n={bind:n,update:n}),this.options[e+"s"][t]=n,n):this.options[e+"s"][t]};});}(t);}(bn),Object.defineProperty(bn.prototype,"$isServer",{get:Y}),Object.defineProperty(bn.prototype,"$ssrContext",{get:function(){return this.$vnode&&this.$vnode.ssrContext}}),Object.defineProperty(bn,"FunctionalRenderContext",{value:ke}),bn.version="2.6.12";var Sn=p("style,class"),En=p("input,textarea,option,select,progress"),jn=p("contenteditable,draggable,spellcheck"),Tn=p("events,caret,typing,plaintext-only"),In=function(t,e){return Mn(e)||"false"===e?"false":"contenteditable"===t&&Tn(e)?e:"true"},Dn=p("allowfullscreen,async,autofocus,autoplay,checked,compact,controls,declare,default,defaultchecked,defaultmuted,defaultselected,defer,disabled,enabled,formnovalidate,hidden,indeterminate,inert,ismap,itemscope,loop,multiple,muted,nohref,noresize,noshade,novalidate,nowrap,open,pauseonexit,readonly,required,reversed,scoped,seamless,selected,sortable,translate,truespeed,typemustmatch,visible"),Nn="http://www.w3.org/1999/xlink",Pn=function(t){return ":"===t.charAt(5)&&"xlink"===t.slice(0,5)},Ln=function(t){return Pn(t)?t.slice(6,t.length):""},Mn=function(t){return null==t||!1===t};function Fn(t){for(var e=t.data,r=t,o=t;n(o.componentInstance);)(o=o.componentInstance._vnode)&&o.data&&(e=Rn(o.data,e));for(;n(r=r.parent);)r&&r.data&&(e=Rn(e,r.data));return function(t,e){if(n(t)||n(e))return Un(t,Hn(e));return ""}(e.staticClass,e.class)}function Rn(t,e){return {staticClass:Un(t.staticClass,e.staticClass),class:n(t.class)?[t.class,e.class]:e.class}}function Un(t,e){return t?e?t+" "+e:t:e||""}function Hn(t){return Array.isArray(t)?function(t){for(var e,r="",o=0,i=t.length;o<i;o++)n(e=Hn(t[o]))&&""!==e&&(r&&(r+=" "),r+=e);return r}(t):i(t)?function(t){var e="";for(var n in t)t[n]&&(e&&(e+=" "),e+=n);return e}(t):"string"==typeof t?t:""}var Bn={svg:"http://www.w3.org/2000/svg",math:"http://www.w3.org/1998/Math/MathML"},Vn=p("html,body,base,head,link,meta,style,title,address,article,aside,footer,header,h1,h2,h3,h4,h5,h6,hgroup,nav,section,div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby,s,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,output,progress,select,textarea,details,dialog,menu,menuitem,summary,content,element,shadow,template,blockquote,iframe,tfoot"),zn=p("svg,animate,circle,clippath,cursor,defs,desc,ellipse,filter,font-face,foreignObject,g,glyph,image,line,marker,mask,missing-glyph,path,pattern,polygon,polyline,rect,switch,symbol,text,textpath,tspan,use,view",!0),Wn=function(t){return Vn(t)||zn(t)};var Kn=p("text,number,password,search,email,tel,url");var Xn=Object.freeze({createElement:function(t,e){var n=document.createElement(t);return "select"!==t?n:(e.data&&e.data.attrs&&void 0!==e.data.attrs.multiple&&n.setAttribute("multiple","multiple"),n)},createElementNS:function(t,e){return document.createElementNS(Bn[t],e)},createTextNode:function(t){return document.createTextNode(t)},createComment:function(t){return document.createComment(t)},insertBefore:function(t,e,n){t.insertBefore(e,n);},removeChild:function(t,e){t.removeChild(e);},appendChild:function(t,e){t.appendChild(e);},parentNode:function(t){return t.parentNode},nextSibling:function(t){return t.nextSibling},tagName:function(t){return t.tagName},setTextContent:function(t,e){t.textContent=e;},setStyleScope:function(t,e){t.setAttribute(e,"");}}),Gn={create:function(t,e){Zn(e);},update:function(t,e){t.data.ref!==e.data.ref&&(Zn(t,!0),Zn(e));},destroy:function(t){Zn(t,!0);}};function Zn(t,e){var r=t.data.ref;if(n(r)){var o=t.context,i=t.componentInstance||t.elm,a=o.$refs;e?Array.isArray(a[r])?v(a[r],i):a[r]===i&&(a[r]=void 0):t.data.refInFor?Array.isArray(a[r])?a[r].indexOf(i)<0&&a[r].push(i):a[r]=[i]:a[r]=i;}}var Jn=new lt("",{},[]),Qn=["create","activate","update","remove","destroy"];function Yn(t,o){return t.key===o.key&&(t.tag===o.tag&&t.isComment===o.isComment&&n(t.data)===n(o.data)&&function(t,e){if("input"!==t.tag)return !0;var r,o=n(r=t.data)&&n(r=r.attrs)&&r.type,i=n(r=e.data)&&n(r=r.attrs)&&r.type;return o===i||Kn(o)&&Kn(i)}(t,o)||r(t.isAsyncPlaceholder)&&t.asyncFactory===o.asyncFactory&&e(o.asyncFactory.error))}function tr(t,e,r){var o,i,a={};for(o=e;o<=r;++o)n(i=t[o].key)&&(a[i]=o);return a}var er={create:nr,update:nr,destroy:function(t){nr(t,Jn);}};function nr(t,e){(t.data.directives||e.data.directives)&&function(t,e){var n,r,o,i=t===Jn,a=e===Jn,s=or(t.data.directives,t.context),c=or(e.data.directives,e.context),u=[],l=[];for(n in c)r=s[n],o=c[n],r?(o.oldValue=r.value,o.oldArg=r.arg,ar(o,"update",e,t),o.def&&o.def.componentUpdated&&l.push(o)):(ar(o,"bind",e,t),o.def&&o.def.inserted&&u.push(o));if(u.length){var f=function(){for(var n=0;n<u.length;n++)ar(u[n],"inserted",e,t);};i?ne(e,"insert",f):f();}l.length&&ne(e,"postpatch",function(){for(var n=0;n<l.length;n++)ar(l[n],"componentUpdated",e,t);});if(!i)for(n in s)c[n]||ar(s[n],"unbind",t,t,a);}(t,e);}var rr=Object.create(null);function or(t,e){var n,r,o=Object.create(null);if(!t)return o;for(n=0;n<t.length;n++)(r=t[n]).modifiers||(r.modifiers=rr),o[ir(r)]=r,r.def=It(e.$options,"directives",r.name);return o}function ir(t){return t.rawName||t.name+"."+Object.keys(t.modifiers||{}).join(".")}function ar(t,e,n,r,o){var i=t.def&&t.def[e];if(i)try{i(n.elm,t,n,r,o);}catch(r){Mt(r,n.context,"directive "+t.name+" "+e+" hook");}}var sr=[Gn,er];function cr(t,r){var o=r.componentOptions;if(!(n(o)&&!1===o.Ctor.options.inheritAttrs||e(t.data.attrs)&&e(r.data.attrs))){var i,a,s=r.elm,c=t.data.attrs||{},u=r.data.attrs||{};for(i in n(u.__ob__)&&(u=r.data.attrs=x({},u)),u)a=u[i],c[i]!==a&&ur(s,i,a);for(i in c)e(u[i])&&(Pn(i)?s.removeAttributeNS(Nn,Ln(i)):jn(i)||s.removeAttribute(i));}}function ur(t,e,n){t.tagName.indexOf("-")>-1?lr(t,e,n):Dn(e)?Mn(n)?t.removeAttribute(e):(n="allowfullscreen"===e&&"EMBED"===t.tagName?"true":e,t.setAttribute(e,n)):jn(e)?t.setAttribute(e,In(e,n)):Pn(e)?Mn(n)?t.removeAttributeNS(Nn,Ln(e)):t.setAttributeNS(Nn,e,n):lr(t,e,n);}function lr(t,e,n){if(Mn(n))t.removeAttribute(e);else {t.setAttribute(e,n);}}var fr={create:cr,update:cr};function pr(t,r){var o=r.elm,i=r.data,a=t.data;if(!(e(i.staticClass)&&e(i.class)&&(e(a)||e(a.staticClass)&&e(a.class)))){var s=Fn(r),c=o._transitionClasses;n(c)&&(s=Un(s,Hn(c))),s!==o._prevClass&&(o.setAttribute("class",s),o._prevClass=s);}}var dr,vr={create:pr,update:pr},hr="__r",mr="__c";function yr(t,e,n){var r=dr;return function o(){null!==e.apply(null,arguments)&&br(t,o,n,r);}}var gr=Bt&&!(G);function _r(t,e,n,r){if(gr){var o=rn,i=e;e=i._wrapper=function(t){if(t.target===t.currentTarget||t.timeStamp>=o||t.timeStamp<=0||t.target.ownerDocument!==document)return i.apply(this,arguments)};}dr.addEventListener(t,e,n);}function br(t,e,n,r){(r||dr).removeEventListener(t,e._wrapper||e,n);}function Cr(t,r){if(!e(t.data.on)||!e(r.data.on)){var o=r.data.on||{},i=t.data.on||{};dr=r.elm,function(t){if(n(t[hr])){var e="input";t[e]=[].concat(t[hr],t[e]||[]),delete t[hr];}n(t[mr])&&(t.change=[].concat(t[mr],t.change||[]),delete t[mr]);}(o),ee(o,i,_r,br,yr,r.context),dr=void 0;}}var $r,wr={create:Cr,update:Cr};function Ar(t,r){if(!e(t.data.domProps)||!e(r.data.domProps)){var o,i,a=r.elm,s=t.data.domProps||{},c=r.data.domProps||{};for(o in n(c.__ob__)&&(c=r.data.domProps=x({},c)),s)o in c||(a[o]="");for(o in c){if(i=c[o],"textContent"===o||"innerHTML"===o){if(r.children&&(r.children.length=0),i===s[o])continue;1===a.childNodes.length&&a.removeChild(a.childNodes[0]);}if("value"===o&&"PROGRESS"!==a.tagName){a._value=i;var u=e(i)?"":String(i);xr(a,u)&&(a.value=u);}else if("innerHTML"===o&&zn(a.tagName)&&e(a.innerHTML)){($r=$r||document.createElement("div")).innerHTML="<svg>"+i+"</svg>";for(var l=$r.firstChild;a.firstChild;)a.removeChild(a.firstChild);for(;l.firstChild;)a.appendChild(l.firstChild);}else if(i!==s[o])try{a[o]=i;}catch(t){}}}}function xr(t,e){return !t.composing&&("OPTION"===t.tagName||function(t,e){var n=!0;try{n=document.activeElement!==t;}catch(t){}return n&&t.value!==e}(t,e)||function(t,e){var r=t.value,o=t._vModifiers;if(n(o)){if(o.number)return f(r)!==f(e);if(o.trim)return r.trim()!==e.trim()}return r!==e}(t,e))}var Or={create:Ar,update:Ar},kr=y(function(t){var e={},n=/:(.+)/;return t.split(/;(?![^(]*\))/g).forEach(function(t){if(t){var r=t.split(n);r.length>1&&(e[r[0].trim()]=r[1].trim());}}),e});function Sr(t){var e=Er(t.style);return t.staticStyle?x(t.staticStyle,e):e}function Er(t){return Array.isArray(t)?O(t):"string"==typeof t?kr(t):t}var jr,Tr=/^--/,Ir=/\s*!important$/,Dr=function(t,e,n){if(Tr.test(e))t.style.setProperty(e,n);else if(Ir.test(n))t.style.setProperty($(e),n.replace(Ir,""),"important");else {var r=Pr(e);if(Array.isArray(n))for(var o=0,i=n.length;o<i;o++)t.style[r]=n[o];else t.style[r]=n;}},Nr=["Webkit","Moz","ms"],Pr=y(function(t){if(jr=jr||document.createElement("div").style,"filter"!==(t=_(t))&&t in jr)return t;for(var e=t.charAt(0).toUpperCase()+t.slice(1),n=0;n<Nr.length;n++){var r=Nr[n]+e;if(r in jr)return r}});function Lr(t,r){var o=r.data,i=t.data;if(!(e(o.staticStyle)&&e(o.style)&&e(i.staticStyle)&&e(i.style))){var a,s,c=r.elm,u=i.staticStyle,l=i.normalizedStyle||i.style||{},f=u||l,p=Er(r.data.style)||{};r.data.normalizedStyle=n(p.__ob__)?x({},p):p;var d=function(t,e){var n,r={};if(e)for(var o=t;o.componentInstance;)(o=o.componentInstance._vnode)&&o.data&&(n=Sr(o.data))&&x(r,n);(n=Sr(t.data))&&x(r,n);for(var i=t;i=i.parent;)i.data&&(n=Sr(i.data))&&x(r,n);return r}(r,!0);for(s in f)e(d[s])&&Dr(c,s,"");for(s in d)(a=d[s])!==f[s]&&Dr(c,s,null==a?"":a);}}var Mr={create:Lr,update:Lr},Fr=/\s+/;function Rr(t,e){if(e&&(e=e.trim()))if(t.classList)e.indexOf(" ")>-1?e.split(Fr).forEach(function(e){return t.classList.add(e)}):t.classList.add(e);else {var n=" "+(t.getAttribute("class")||"")+" ";n.indexOf(" "+e+" ")<0&&t.setAttribute("class",(n+e).trim());}}function Ur(t,e){if(e&&(e=e.trim()))if(t.classList)e.indexOf(" ")>-1?e.split(Fr).forEach(function(e){return t.classList.remove(e)}):t.classList.remove(e),t.classList.length||t.removeAttribute("class");else {for(var n=" "+(t.getAttribute("class")||"")+" ",r=" "+e+" ";n.indexOf(r)>=0;)n=n.replace(r," ");(n=n.trim())?t.setAttribute("class",n):t.removeAttribute("class");}}function Hr(t){if(t){if("object"==typeof t){var e={};return !1!==t.css&&x(e,Br(t.name||"v")),x(e,t),e}return "string"==typeof t?Br(t):void 0}}var Br=y(function(t){return {enterClass:t+"-enter",enterToClass:t+"-enter-to",enterActiveClass:t+"-enter-active",leaveClass:t+"-leave",leaveToClass:t+"-leave-to",leaveActiveClass:t+"-leave-active"}}),zr="transition",Wr="animation",qr="transition",Kr="transitionend",Xr="animation",Gr="animationend";var Zr=function(t){return t()};function Jr(t){Zr(function(){Zr(t);});}function Qr(t,e){var n=t._transitionClasses||(t._transitionClasses=[]);n.indexOf(e)<0&&(n.push(e),Rr(t,e));}function Yr(t,e){t._transitionClasses&&v(t._transitionClasses,e),Ur(t,e);}function to(t,e,n){var r=no(t,e),o=r.type,i=r.timeout,a=r.propCount;if(!o)return n();var s=o===zr?Kr:Gr,c=0,u=function(){t.removeEventListener(s,l),n();},l=function(e){e.target===t&&++c>=a&&u();};setTimeout(function(){c<a&&u();},i+1),t.addEventListener(s,l);}var eo=/\b(transform|all)(,|$)/;function no(t,e){var n,r=window.getComputedStyle(t),o=(r[qr+"Delay"]||"").split(", "),i=(r[qr+"Duration"]||"").split(", "),a=ro(o,i),s=(r[Xr+"Delay"]||"").split(", "),c=(r[Xr+"Duration"]||"").split(", "),u=ro(s,c),l=0,f=0;return e===zr?a>0&&(n=zr,l=a,f=i.length):e===Wr?u>0&&(n=Wr,l=u,f=c.length):f=(n=(l=Math.max(a,u))>0?a>u?zr:Wr:null)?n===zr?i.length:c.length:0,{type:n,timeout:l,propCount:f,hasTransform:n===zr&&eo.test(r[qr+"Property"])}}function ro(t,e){for(;t.length<e.length;)t=t.concat(t);return Math.max.apply(null,e.map(function(e,n){return oo(e)+oo(t[n])}))}function oo(t){return 1e3*Number(t.slice(0,-1).replace(",","."))}function io(t,r){var o=t.elm;n(o._leaveCb)&&(o._leaveCb.cancelled=!0,o._leaveCb());var a=Hr(t.data.transition);if(!e(a)&&!n(o._enterCb)&&1===o.nodeType){for(var s=a.css,c=a.type,u=a.enterClass,l=a.enterToClass,p=a.enterActiveClass,d=a.appearClass,v=a.appearToClass,h=a.appearActiveClass,m=a.beforeEnter,y=a.enter,g=a.afterEnter,_=a.enterCancelled,b=a.beforeAppear,C=a.appear,$=a.afterAppear,w=a.appearCancelled,A=a.duration,x=qe,O=qe.$vnode;O&&O.parent;)x=O.context,O=O.parent;var k=!x._isMounted||!t.isRootInsert;if(!k||C||""===C){var S=k&&d?d:u,E=k&&h?h:p,j=k&&v?v:l,T=k&&b||m,D=k&&"function"==typeof C?C:y,N=k&&$||g,P=k&&w||_,L=f(i(A)?A.enter:A),M=!1!==s&&!q,F=co(D),R=o._enterCb=I(function(){M&&(Yr(o,j),Yr(o,E)),R.cancelled?(M&&Yr(o,S),P&&P(o)):N&&N(o),o._enterCb=null;});t.data.show||ne(t,"insert",function(){var e=o.parentNode,n=e&&e._pending&&e._pending[t.key];n&&n.tag===t.tag&&n.elm._leaveCb&&n.elm._leaveCb(),D&&D(o,R);}),T&&T(o),M&&(Qr(o,S),Qr(o,E),Jr(function(){Yr(o,S),R.cancelled||(Qr(o,j),F||(so(L)?setTimeout(R,L):to(o,c,R)));})),t.data.show&&(r&&r(),D&&D(o,R)),M||F||R();}}}function ao(t,r){var o=t.elm;n(o._enterCb)&&(o._enterCb.cancelled=!0,o._enterCb());var a=Hr(t.data.transition);if(e(a)||1!==o.nodeType)return r();if(!n(o._leaveCb)){var s=a.css,c=a.type,u=a.leaveClass,l=a.leaveToClass,p=a.leaveActiveClass,d=a.beforeLeave,v=a.leave,h=a.afterLeave,m=a.leaveCancelled,y=a.delayLeave,g=a.duration,_=!1!==s&&!q,b=co(v),C=f(i(g)?g.leave:g),$=o._leaveCb=I(function(){o.parentNode&&o.parentNode._pending&&(o.parentNode._pending[t.key]=null),_&&(Yr(o,l),Yr(o,p)),$.cancelled?(_&&Yr(o,u),m&&m(o)):(r(),h&&h(o)),o._leaveCb=null;});y?y(w):w();}function w(){$.cancelled||(!t.data.show&&o.parentNode&&((o.parentNode._pending||(o.parentNode._pending={}))[t.key]=t),d&&d(o),_&&(Qr(o,u),Qr(o,p),Jr(function(){Yr(o,u),$.cancelled||(Qr(o,l),b||(so(C)?setTimeout($,C):to(o,c,$)));})),v&&v(o,$),_||b||$());}}function so(t){return "number"==typeof t&&!isNaN(t)}function co(t){if(e(t))return !1;var r=t.fns;return n(r)?co(Array.isArray(r)?r[0]:r):(t._length||t.length)>1}(function(t){var i,a,s={},c=t.modules,u=t.nodeOps;for(i=0;i<Qn.length;++i)for(s[Qn[i]]=[],a=0;a<c.length;++a)n(c[a][Qn[i]])&&s[Qn[i]].push(c[a][Qn[i]]);function l(t){var e=u.parentNode(t);n(e)&&u.removeChild(e,t);}function f(t,e,o,i,a,c,l){if(n(t.elm)&&n(c)&&(t=c[l]=vt(t)),t.isRootInsert=!a,!function(t,e,o,i){var a=t.data;if(n(a)){var c=n(t.componentInstance)&&a.keepAlive;if(n(a=a.hook)&&n(a=a.init)&&a(t,!1),n(t.componentInstance))return d(t,e),v(o,t.elm,i),r(c)&&function(t,e,r,o){for(var i,a=t;a.componentInstance;)if(a=a.componentInstance._vnode,n(i=a.data)&&n(i=i.transition)){for(i=0;i<s.activate.length;++i)s.activate[i](Jn,a);e.push(a);break}v(r,t.elm,o);}(t,e,o,i),!0}}(t,e,o,i)){var f=t.data,p=t.children,m=t.tag;n(m)?(t.elm=t.ns?u.createElementNS(t.ns,m):u.createElement(m,t),g(t),h(t,p,e),n(f)&&y(t,e),v(o,t.elm,i)):r(t.isComment)?(t.elm=u.createComment(t.text),v(o,t.elm,i)):(t.elm=u.createTextNode(t.text),v(o,t.elm,i));}}function d(t,e){n(t.data.pendingInsert)&&(e.push.apply(e,t.data.pendingInsert),t.data.pendingInsert=null),t.elm=t.componentInstance.$el,m(t)?(y(t,e),g(t)):(Zn(t),e.push(t));}function v(t,e,r){n(t)&&(n(r)?u.parentNode(r)===t&&u.insertBefore(t,e,r):u.appendChild(t,e));}function h(t,e,n){if(Array.isArray(e))for(var r=0;r<e.length;++r)f(e[r],n,t.elm,null,!0,e,r);else o(t.text)&&u.appendChild(t.elm,u.createTextNode(String(t.text)));}function m(t){for(;t.componentInstance;)t=t.componentInstance._vnode;return n(t.tag)}function y(t,e){for(var r=0;r<s.create.length;++r)s.create[r](Jn,t);n(i=t.data.hook)&&(n(i.create)&&i.create(Jn,t),n(i.insert)&&e.push(t));}function g(t){var e;if(n(e=t.fnScopeId))u.setStyleScope(t.elm,e);else for(var r=t;r;)n(e=r.context)&&n(e=e.$options._scopeId)&&u.setStyleScope(t.elm,e),r=r.parent;n(e=qe)&&e!==t.context&&e!==t.fnContext&&n(e=e.$options._scopeId)&&u.setStyleScope(t.elm,e);}function _(t,e,n,r,o,i){for(;r<=o;++r)f(n[r],i,t,e,!1,n,r);}function b(t){var e,r,o=t.data;if(n(o))for(n(e=o.hook)&&n(e=e.destroy)&&e(t),e=0;e<s.destroy.length;++e)s.destroy[e](t);if(n(e=t.children))for(r=0;r<t.children.length;++r)b(t.children[r]);}function C(t,e,r){for(;e<=r;++e){var o=t[e];n(o)&&(n(o.tag)?($(o),b(o)):l(o.elm));}}function $(t,e){if(n(e)||n(t.data)){var r,o=s.remove.length+1;for(n(e)?e.listeners+=o:e=function(t,e){function n(){0==--n.listeners&&l(t);}return n.listeners=e,n}(t.elm,o),n(r=t.componentInstance)&&n(r=r._vnode)&&n(r.data)&&$(r,e),r=0;r<s.remove.length;++r)s.remove[r](t,e);n(r=t.data.hook)&&n(r=r.remove)?r(t,e):e();}else l(t.elm);}function w(t,e,r,o){for(var i=r;i<o;i++){var a=e[i];if(n(a)&&Yn(t,a))return i}}function A(t,o,i,a,c,l){if(t!==o){n(o.elm)&&n(a)&&(o=a[c]=vt(o));var p=o.elm=t.elm;if(r(t.isAsyncPlaceholder))n(o.asyncFactory.resolved)?k(t.elm,o,i):o.isAsyncPlaceholder=!0;else if(r(o.isStatic)&&r(t.isStatic)&&o.key===t.key&&(r(o.isCloned)||r(o.isOnce)))o.componentInstance=t.componentInstance;else {var d,v=o.data;n(v)&&n(d=v.hook)&&n(d=d.prepatch)&&d(t,o);var h=t.children,y=o.children;if(n(v)&&m(o)){for(d=0;d<s.update.length;++d)s.update[d](t,o);n(d=v.hook)&&n(d=d.update)&&d(t,o);}e(o.text)?n(h)&&n(y)?h!==y&&function(t,r,o,i,a){for(var s,c,l,p=0,d=0,v=r.length-1,h=r[0],m=r[v],y=o.length-1,g=o[0],b=o[y],$=!a;p<=v&&d<=y;)e(h)?h=r[++p]:e(m)?m=r[--v]:Yn(h,g)?(A(h,g,i,o,d),h=r[++p],g=o[++d]):Yn(m,b)?(A(m,b,i,o,y),m=r[--v],b=o[--y]):Yn(h,b)?(A(h,b,i,o,y),$&&u.insertBefore(t,h.elm,u.nextSibling(m.elm)),h=r[++p],b=o[--y]):Yn(m,g)?(A(m,g,i,o,d),$&&u.insertBefore(t,m.elm,h.elm),m=r[--v],g=o[++d]):(e(s)&&(s=tr(r,p,v)),e(c=n(g.key)?s[g.key]:w(g,r,p,v))?f(g,i,t,h.elm,!1,o,d):Yn(l=r[c],g)?(A(l,g,i,o,d),r[c]=void 0,$&&u.insertBefore(t,l.elm,h.elm)):f(g,i,t,h.elm,!1,o,d),g=o[++d]);p>v?_(t,e(o[y+1])?null:o[y+1].elm,o,d,y,i):d>y&&C(r,p,v);}(p,h,y,i,l):n(y)?(n(t.text)&&u.setTextContent(p,""),_(p,null,y,0,y.length-1,i)):n(h)?C(h,0,h.length-1):n(t.text)&&u.setTextContent(p,""):t.text!==o.text&&u.setTextContent(p,o.text),n(v)&&n(d=v.hook)&&n(d=d.postpatch)&&d(t,o);}}}function x(t,e,o){if(r(o)&&n(t.parent))t.parent.data.pendingInsert=e;else for(var i=0;i<e.length;++i)e[i].data.hook.insert(e[i]);}var O=p("attrs,class,staticClass,staticStyle,key");function k(t,e,o,i){var a,s=e.tag,c=e.data,u=e.children;if(i=i||c&&c.pre,e.elm=t,r(e.isComment)&&n(e.asyncFactory))return e.isAsyncPlaceholder=!0,!0;if(n(c)&&(n(a=c.hook)&&n(a=a.init)&&a(e,!0),n(a=e.componentInstance)))return d(e,o),!0;if(n(s)){if(n(u))if(t.hasChildNodes())if(n(a=c)&&n(a=a.domProps)&&n(a=a.innerHTML)){if(a!==t.innerHTML)return !1}else {for(var l=!0,f=t.firstChild,p=0;p<u.length;p++){if(!f||!k(f,u[p],o,i)){l=!1;break}f=f.nextSibling;}if(!l||f)return !1}else h(e,u,o);if(n(c)){var v=!1;for(var m in c)if(!O(m)){v=!0,y(e,o);break}!v&&c.class&&Qt(c.class);}}else t.data!==e.text&&(t.data=e.text);return !0}return function(t,o,i,a){if(!e(o)){var c,l=!1,p=[];if(e(t))l=!0,f(o,p);else {var d=n(t.nodeType);if(!d&&Yn(t,o))A(t,o,p,null,null,a);else {if(d){if(1===t.nodeType&&t.hasAttribute(D)&&(t.removeAttribute(D),i=!0),r(i)&&k(t,o,p))return x(o,p,!0),t;c=t,t=new lt(u.tagName(c).toLowerCase(),{},[],void 0,c);}var v=t.elm,h=u.parentNode(v);if(f(o,p,v._leaveCb?null:h,u.nextSibling(v)),n(o.parent))for(var y=o.parent,g=m(o);y;){for(var _=0;_<s.destroy.length;++_)s.destroy[_](y);if(y.elm=o.elm,g){for(var $=0;$<s.create.length;++$)s.create[$](Jn,y);var w=y.data.hook.insert;if(w.merged)for(var O=1;O<w.fns.length;O++)w.fns[O]();}else Zn(y);y=y.parent;}n(h)?C([t],0,0):n(t.tag)&&b(t);}}return x(o,p,l),o.elm}n(t)&&b(t);}})({nodeOps:Xn,modules:[fr,vr,wr,Or,Mr,{}].concat(sr)});var fo={inserted:function(t,e,n,r){"select"===n.tag?(r.elm&&!r.elm._vOptions?ne(n,"postpatch",function(){fo.componentUpdated(t,e,n);}):po(t,e,n.context),t._vOptions=[].map.call(t.options,mo)):("textarea"===n.tag||Kn(t.type))&&(t._vModifiers=e.modifiers,e.modifiers.lazy||(t.addEventListener("compositionstart",yo),t.addEventListener("compositionend",go),t.addEventListener("change",go),q));},componentUpdated:function(t,e,n){if("select"===n.tag){po(t,e,n.context);var r=t._vOptions,o=t._vOptions=[].map.call(t.options,mo);if(o.some(function(t,e){return !j(t,r[e])}))(t.multiple?e.value.some(function(t){return ho(t,o)}):e.value!==e.oldValue&&ho(e.value,o))&&_o(t,"change");}}};function po(t,e,n){vo(t,e),(K);}function vo(t,e,n){var r=e.value,o=t.multiple;if(!o||Array.isArray(r)){for(var i,a,s=0,c=t.options.length;s<c;s++)if(a=t.options[s],o)i=T(r,mo(a))>-1,a.selected!==i&&(a.selected=i);else if(j(mo(a),r))return void(t.selectedIndex!==s&&(t.selectedIndex=s));o||(t.selectedIndex=-1);}}function ho(t,e){return e.every(function(e){return !j(e,t)})}function mo(t){return "_value"in t?t._value:t.value}function yo(t){t.target.composing=!0;}function go(t){t.target.composing&&(t.target.composing=!1,_o(t.target,"input"));}function _o(t,e){var n=document.createEvent("HTMLEvents");n.initEvent(e,!0,!0),t.dispatchEvent(n);}function bo(t){return !t.componentInstance||t.data&&t.data.transition?t:bo(t.componentInstance._vnode)}var Co={model:fo,show:{bind:function(t,e,n){var r=e.value,o=(n=bo(n)).data&&n.data.transition,i=t.__vOriginalDisplay="none"===t.style.display?"":t.style.display;r&&o?(n.data.show=!0,io(n,function(){t.style.display=i;})):t.style.display=r?i:"none";},update:function(t,e,n){var r=e.value;!r!=!e.oldValue&&((n=bo(n)).data&&n.data.transition?(n.data.show=!0,r?io(n,function(){t.style.display=t.__vOriginalDisplay;}):ao(n,function(){t.style.display="none";})):t.style.display=r?t.__vOriginalDisplay:"none");},unbind:function(t,e,n,r,o){o||(t.style.display=t.__vOriginalDisplay);}}},$o={name:String,appear:Boolean,css:Boolean,mode:String,type:String,enterClass:String,leaveClass:String,enterToClass:String,leaveToClass:String,enterActiveClass:String,leaveActiveClass:String,appearClass:String,appearActiveClass:String,appearToClass:String,duration:[Number,String,Object]};function wo(t){var e=t&&t.componentOptions;return e&&e.Ctor.options.abstract?wo(He(e.children)):t}function Ao(t){var e={},n=t.$options;for(var r in n.propsData)e[r]=t[r];var o=n._parentListeners;for(var i in o)e[_(i)]=o[i];return e}function xo(t,e){if(/\d-keep-alive$/.test(e.tag))return t("keep-alive",{props:e.componentOptions.propsData})}var Oo=function(t){return t.tag||Ue(t)},ko=function(t){return "show"===t.name},So={name:"transition",props:$o,abstract:!0,render:function(t){var e=this,n=this.$slots.default;if(n&&(n=n.filter(Oo)).length){var r=this.mode,i=n[0];if(function(t){for(;t=t.parent;)if(t.data.transition)return !0}(this.$vnode))return i;var a=wo(i);if(!a)return i;if(this._leaving)return xo(t,i);var s="__transition-"+this._uid+"-";a.key=null==a.key?a.isComment?s+"comment":s+a.tag:o(a.key)?0===String(a.key).indexOf(s)?a.key:s+a.key:a.key;var c=(a.data||(a.data={})).transition=Ao(this),u=this._vnode,l=wo(u);if(a.data.directives&&a.data.directives.some(ko)&&(a.data.show=!0),l&&l.data&&!function(t,e){return e.key===t.key&&e.tag===t.tag}(a,l)&&!Ue(l)&&(!l.componentInstance||!l.componentInstance._vnode.isComment)){var f=l.data.transition=x({},c);if("out-in"===r)return this._leaving=!0,ne(f,"afterLeave",function(){e._leaving=!1,e.$forceUpdate();}),xo(t,i);if("in-out"===r){if(Ue(a))return u;var p,d=function(){p();};ne(c,"afterEnter",d),ne(c,"enterCancelled",d),ne(f,"delayLeave",function(t){p=t;});}}return i}}},Eo=x({tag:String,moveClass:String},$o);function jo(t){t.elm._moveCb&&t.elm._moveCb(),t.elm._enterCb&&t.elm._enterCb();}function To(t){t.data.newPos=t.elm.getBoundingClientRect();}function Io(t){var e=t.data.pos,n=t.data.newPos,r=e.left-n.left,o=e.top-n.top;if(r||o){t.data.moved=!0;var i=t.elm.style;i.transform=i.WebkitTransform="translate("+r+"px,"+o+"px)",i.transitionDuration="0s";}}delete Eo.mode;var Do={Transition:So,TransitionGroup:{props:Eo,beforeMount:function(){var t=this,e=this._update;this._update=function(n,r){var o=Ke(t);t.__patch__(t._vnode,t.kept,!1,!0),t._vnode=t.kept,o(),e.call(t,n,r);};},render:function(t){for(var e=this.tag||this.$vnode.data.tag||"span",n=Object.create(null),r=this.prevChildren=this.children,o=this.$slots.default||[],i=this.children=[],a=Ao(this),s=0;s<o.length;s++){var c=o[s];c.tag&&null!=c.key&&0!==String(c.key).indexOf("__vlist")&&(i.push(c),n[c.key]=c,(c.data||(c.data={})).transition=a);}if(r){for(var u=[],l=[],f=0;f<r.length;f++){var p=r[f];p.data.transition=a,p.data.pos=p.elm.getBoundingClientRect(),n[p.key]?u.push(p):l.push(p);}this.kept=t(e,null,u),this.removed=l;}return t(e,null,i)},updated:function(){var t=this.prevChildren,e=this.moveClass||(this.name||"v")+"-move";t.length&&this.hasMove(t[0].elm,e)&&(t.forEach(jo),t.forEach(To),t.forEach(Io),this._reflow=document.body.offsetHeight,t.forEach(function(t){if(t.data.moved){var n=t.elm,r=n.style;Qr(n,e),r.transform=r.WebkitTransform=r.transitionDuration="",n.addEventListener(Kr,n._moveCb=function t(r){r&&r.target!==n||r&&!/transform$/.test(r.propertyName)||(n.removeEventListener(Kr,t),n._moveCb=null,Yr(n,e));});}}));},methods:{hasMove:function(t,e){return !1;}}}};bn.config.mustUseProp=function(t,e,n){return "value"===n&&En(t)&&"button"!==e||"selected"===n&&"option"===t||"checked"===n&&"input"===t||"muted"===n&&"video"===t},bn.config.isReservedTag=Wn,bn.config.isReservedAttr=Sn,bn.config.getTagNamespace=function(t){return zn(t)?"svg":"math"===t?"math":void 0},bn.config.isUnknownElement=function(t){return !0;},x(bn.options.directives,Co),x(bn.options.components,Do),bn.prototype.__patch__=k,bn.prototype.$mount=function(t,e){return function(t,e,n){var r;return t.$el=e,t.$options.render||(t.$options.render=pt),Ze(t,"beforeMount"),r=function(){t._update(t._render(),n);},new un(t,r,k,{before:function(){t._isMounted&&!t._isDestroyed&&Ze(t,"beforeUpdate");}},!0),n=!1,null==t.$vnode&&(t._isMounted=!0,Ze(t,"mounted")),t}(this,t=t&&H?function(t){if("string"==typeof t){var e=document.querySelector(t);return e||document.createElement("div")}return t}(t):void 0,e)},module.exports=bn;
});

/*@__PURE__*/server$1.getDefaultExportFromCjs(vue_runtime_common_prod);

var vue_runtime_common = server$1.createCommonjsModule(function (module) {
{
  module.exports = vue_runtime_common_prod;
}
});

const n$1 = /[^\0-\x7E]/;
const t$1 = /[\x2E\u3002\uFF0E\uFF61]/g;
const o$1 = {overflow: "Overflow Error", "not-basic": "Illegal Input", "invalid-input": "Invalid Input"};
const e$1 = Math.floor;
const r$1 = String.fromCharCode;
function s$1(n2) {
  throw new RangeError(o$1[n2]);
}
const c$1 = function(n2, t2) {
  return n2 + 22 + 75 * (n2 < 26) - ((t2 != 0) << 5);
};
const u$1 = function(n2, t2, o2) {
  let r2 = 0;
  for (n2 = o2 ? e$1(n2 / 700) : n2 >> 1, n2 += e$1(n2 / t2); n2 > 455; r2 += 36) {
    n2 = e$1(n2 / 35);
  }
  return e$1(r2 + 36 * n2 / (n2 + 38));
};
function toASCII(o2) {
  return function(n2, o3) {
    const e2 = n2.split("@");
    let r2 = "";
    e2.length > 1 && (r2 = e2[0] + "@", n2 = e2[1]);
    const s2 = function(n3, t2) {
      const o4 = [];
      let e3 = n3.length;
      for (; e3--; ) {
        o4[e3] = t2(n3[e3]);
      }
      return o4;
    }((n2 = n2.replace(t$1, ".")).split("."), o3).join(".");
    return r2 + s2;
  }(o2, function(t2) {
    return n$1.test(t2) ? "xn--" + function(n2) {
      const t3 = [];
      const o3 = (n2 = function(n3) {
        const t4 = [];
        let o4 = 0;
        const e2 = n3.length;
        for (; o4 < e2; ) {
          const r2 = n3.charCodeAt(o4++);
          if (r2 >= 55296 && r2 <= 56319 && o4 < e2) {
            const e3 = n3.charCodeAt(o4++);
            (64512 & e3) == 56320 ? t4.push(((1023 & r2) << 10) + (1023 & e3) + 65536) : (t4.push(r2), o4--);
          } else {
            t4.push(r2);
          }
        }
        return t4;
      }(n2)).length;
      let f = 128;
      let i = 0;
      let l = 72;
      for (const o4 of n2) {
        o4 < 128 && t3.push(r$1(o4));
      }
      const h = t3.length;
      let p = h;
      for (h && t3.push("-"); p < o3; ) {
        let o4 = 2147483647;
        for (const t4 of n2) {
          t4 >= f && t4 < o4 && (o4 = t4);
        }
        const a = p + 1;
        o4 - f > e$1((2147483647 - i) / a) && s$1("overflow"), i += (o4 - f) * a, f = o4;
        for (const o5 of n2) {
          if (o5 < f && ++i > 2147483647 && s$1("overflow"), o5 == f) {
            let n3 = i;
            for (let o6 = 36; ; o6 += 36) {
              const s2 = o6 <= l ? 1 : o6 >= l + 26 ? 26 : o6 - l;
              if (n3 < s2) {
                break;
              }
              const u2 = n3 - s2;
              const f2 = 36 - s2;
              t3.push(r$1(c$1(s2 + u2 % f2, 0))), n3 = e$1(u2 / f2);
            }
            t3.push(r$1(c$1(n3, 0))), l = u$1(i, a, p == h), i = 0, ++p;
          }
        }
        ++i, ++f;
      }
      return t3.join("");
    }(t2) : t2;
  });
}

const HASH_RE = /#/g;
const AMPERSAND_RE = /&/g;
const SLASH_RE = /\//g;
const EQUAL_RE = /=/g;
const IM_RE = /\?/g;
const PLUS_RE = /\+/g;
const ENC_BRACKET_OPEN_RE = /%5B/g;
const ENC_BRACKET_CLOSE_RE = /%5D/g;
const ENC_CARET_RE = /%5E/g;
const ENC_BACKTICK_RE = /%60/g;
const ENC_CURLY_OPEN_RE = /%7B/g;
const ENC_PIPE_RE = /%7C/g;
const ENC_CURLY_CLOSE_RE = /%7D/g;
const ENC_SPACE_RE = /%20/g;
function encode(text) {
  return encodeURI("" + text).replace(ENC_PIPE_RE, "|").replace(ENC_BRACKET_OPEN_RE, "[").replace(ENC_BRACKET_CLOSE_RE, "]");
}
function encodeHash(text) {
  return encode(text).replace(ENC_CURLY_OPEN_RE, "{").replace(ENC_CURLY_CLOSE_RE, "}").replace(ENC_CARET_RE, "^");
}
function encodeQueryValue(text) {
  return encode(text).replace(PLUS_RE, "%2B").replace(ENC_SPACE_RE, "+").replace(HASH_RE, "%23").replace(AMPERSAND_RE, "%26").replace(ENC_BACKTICK_RE, "`").replace(ENC_CURLY_OPEN_RE, "{").replace(ENC_CURLY_CLOSE_RE, "}").replace(ENC_CARET_RE, "^");
}
function encodeQueryKey(text) {
  return encodeQueryValue(text).replace(EQUAL_RE, "%3D");
}
function encodePath(text) {
  return encode(text).replace(HASH_RE, "%23").replace(IM_RE, "%3F");
}
function encodeParam(text) {
  return encodePath(text).replace(SLASH_RE, "%2F");
}
function decode(text = "") {
  try {
    return decodeURIComponent("" + text);
  } catch (_err) {
    return "" + text;
  }
}
function encodeHost(name = "") {
  return toASCII(name);
}

function parseQuery(paramsStr = "") {
  const obj = {};
  if (paramsStr[0] === "?") {
    paramsStr = paramsStr.substr(1);
  }
  for (const param of paramsStr.split("&")) {
    const s = param.match(/([^=]+)=?(.*)/) || [];
    if (s.length < 2) {
      continue;
    }
    const key = decode(s[1]);
    const value = decode(s[2] || "");
    if (obj[key]) {
      if (Array.isArray(obj[key])) {
        obj[key].push(value);
      } else {
        obj[key] = [obj[key], value];
      }
    } else {
      obj[key] = value;
    }
  }
  return obj;
}
function encodeQueryItem(key, val) {
  if (!val) {
    return encodeQueryKey(key);
  }
  if (Array.isArray(val)) {
    return val.map((_val) => `${encodeQueryKey(key)}=${encodeQueryValue(_val)}`).join("&");
  }
  return `${encodeQueryKey(key)}=${encodeQueryValue(val)}`;
}
function stringifyQuery(query) {
  return Object.keys(query).map((k) => encodeQueryItem(k, query[k])).join("&");
}

class $URL {
  constructor(input = "") {
    this.query = {};
    if (typeof input !== "string") {
      throw new TypeError(`URL input should be string received ${typeof input} (${input})`);
    }
    const parsed = parseURL(input);
    this.protocol = decode(parsed.protocol);
    this.host = decode(parsed.host);
    this.auth = decode(parsed.auth);
    this.pathname = decode(parsed.pathname);
    this.query = parseQuery(parsed.search);
    this.hash = decode(parsed.hash);
  }
  get hostname() {
    return parseHost(this.host).hostname;
  }
  get port() {
    return parseHost(this.host).port || "";
  }
  get username() {
    return parseAuth(this.auth).username;
  }
  get password() {
    return parseAuth(this.auth).password || "";
  }
  get hasProtocol() {
    return this.protocol.length;
  }
  get isAbsolute() {
    return this.hasProtocol || this.pathname[0] === "/";
  }
  get search() {
    const q = stringifyQuery(this.query);
    return q.length ? "?" + q : "";
  }
  get searchParams() {
    const p = new URLSearchParams();
    for (const name in this.query) {
      const value = this.query[name];
      if (Array.isArray(value)) {
        value.forEach((v) => p.append(name, v));
      } else {
        p.append(name, value || "");
      }
    }
    return p;
  }
  get origin() {
    return (this.protocol ? this.protocol + "//" : "") + encodeHost(this.host);
  }
  get fullpath() {
    return encodePath(this.pathname) + this.search + encodeHash(this.hash);
  }
  get encodedAuth() {
    if (!this.auth) {
      return "";
    }
    const {username, password} = parseAuth(this.auth);
    return encodeURIComponent(username) + (password ? ":" + encodeURIComponent(password) : "");
  }
  get href() {
    const auth = this.encodedAuth;
    const originWithAuth = (this.protocol ? this.protocol + "//" : "") + (auth ? auth + "@" : "") + encodeHost(this.host);
    return this.hasProtocol && this.isAbsolute ? originWithAuth + this.fullpath : this.fullpath;
  }
  append(url) {
    if (url.hasProtocol) {
      throw new Error("Cannot append a URL with protocol");
    }
    Object.assign(this.query, url.query);
    if (url.pathname) {
      this.pathname = withTrailingSlash(this.pathname) + withoutLeadingSlash(url.pathname);
    }
    if (url.hash) {
      this.hash = url.hash;
    }
  }
  toJSON() {
    return this.href;
  }
  toString() {
    return this.href;
  }
}

function hasProtocol(inputStr) {
  return /^\w+:\/\//.test(inputStr);
}
function withoutTrailingSlash(input = "") {
  return input.endsWith("/") ? input.slice(0, -1) : input;
}
function withTrailingSlash(input = "") {
  return input.endsWith("/") ? input : input + "/";
}
function withoutLeadingSlash(input = "") {
  return input.startsWith("/") ? input.substr(1) : input;
}
function withLeadingSlash(input = "") {
  return input.startsWith("/") ? input : "/" + input;
}
function cleanDoubleSlashes(input = "") {
  return input.split("://").map((str) => str.replace(/\/{2,}/g, "/")).join("://");
}
function withQuery(input, query2) {
  const parsed = parseURL(input);
  const mergedQuery = {...parseQuery(parsed.search), ...query2};
  parsed.search = stringifyQuery(mergedQuery);
  return stringifyParsedURL(parsed);
}
function getQuery(input) {
  return parseQuery(parseURL(input).search);
}
function joinURL(base, ...input) {
  let url2 = base || "";
  for (const i of input) {
    url2 = withTrailingSlash(url2) + withoutLeadingSlash(i);
  }
  return url2;
}
function createURL(input) {
  return new $URL(input);
}
function normalizeURL(input) {
  return createURL(input).toString();
}
function resolveURL(base, ...input) {
  const url2 = createURL(base);
  for (const i of input) {
    url2.append(createURL(i));
  }
  return url2.toString();
}

function parseURL(input = "") {
  if (!hasProtocol(input)) {
    return parsePath(input);
  }
  const [protocol, auth, hostAndPath] = (input.match(/([^:/]+:)\/\/([^/@]+@)?(.*)/) || []).splice(1);
  const [host = "", path = ""] = (hostAndPath.match(/([^/]*)(.*)?/) || []).splice(1);
  const {pathname, search, hash} = parsePath(path);
  return {
    protocol,
    auth: auth ? auth.substr(0, auth.length - 1) : "",
    host,
    pathname,
    search,
    hash
  };
}
function parsePath(input = "") {
  const [pathname = "", search = "", hash = ""] = (input.match(/([^#?]*)(\?[^#]*)?(#.*)?/) || []).splice(1);
  return {
    pathname,
    search,
    hash
  };
}
function parseAuth(input = "") {
  const [username, password] = input.split(":");
  return {
    username: decode(username),
    password: decode(password)
  };
}
function parseHost(input = "") {
  const [hostname, port] = (input.match(/([^/]*)(:0-9+)?/) || []).splice(1);
  return {
    hostname: decode(hostname),
    port
  };
}
function stringifyParsedURL(parsed) {
  const fullpath = parsed.pathname + (parsed.search ? "?" + parsed.search : "") + parsed.hash;
  if (!parsed.protocol) {
    return fullpath;
  }
  return parsed.protocol + "//" + (parsed.auth ? parsed.auth + "@" : "") + parsed.host + fullpath;
}

var $URL_1 = $URL;
var cleanDoubleSlashes_1 = cleanDoubleSlashes;
var createURL_1 = createURL;
var decode_1 = decode;
var encode_1 = encode;
var encodeHash_1 = encodeHash;
var encodeHost_1 = encodeHost;
var encodeParam_1 = encodeParam;
var encodePath_1 = encodePath;
var encodeQueryItem_1 = encodeQueryItem;
var encodeQueryKey_1 = encodeQueryKey;
var encodeQueryValue_1 = encodeQueryValue;
var getQuery_1 = getQuery;
var hasProtocol_1 = hasProtocol;
var joinURL_1 = joinURL;
var normalizeURL_1 = normalizeURL;
var parseAuth_1 = parseAuth;
var parseHost_1 = parseHost;
var parsePath_1 = parsePath;
var parseQuery_1 = parseQuery;
var parseURL_1 = parseURL;
var resolveURL_1 = resolveURL;
var stringifyParsedURL_1 = stringifyParsedURL;
var stringifyQuery_1 = stringifyQuery;
var withLeadingSlash_1 = withLeadingSlash;
var withQuery_1 = withQuery;
var withTrailingSlash_1 = withTrailingSlash;
var withoutLeadingSlash_1 = withoutLeadingSlash;
var withoutTrailingSlash_1 = withoutTrailingSlash;

var dist = /*#__PURE__*/Object.defineProperty({
	$URL: $URL_1,
	cleanDoubleSlashes: cleanDoubleSlashes_1,
	createURL: createURL_1,
	decode: decode_1,
	encode: encode_1,
	encodeHash: encodeHash_1,
	encodeHost: encodeHost_1,
	encodeParam: encodeParam_1,
	encodePath: encodePath_1,
	encodeQueryItem: encodeQueryItem_1,
	encodeQueryKey: encodeQueryKey_1,
	encodeQueryValue: encodeQueryValue_1,
	getQuery: getQuery_1,
	hasProtocol: hasProtocol_1,
	joinURL: joinURL_1,
	normalizeURL: normalizeURL_1,
	parseAuth: parseAuth_1,
	parseHost: parseHost_1,
	parsePath: parsePath_1,
	parseQuery: parseQuery_1,
	parseURL: parseURL_1,
	resolveURL: resolveURL_1,
	stringifyParsedURL: stringifyParsedURL_1,
	stringifyQuery: stringifyQuery_1,
	withLeadingSlash: withLeadingSlash_1,
	withQuery: withQuery_1,
	withTrailingSlash: withTrailingSlash_1,
	withoutLeadingSlash: withoutLeadingSlash_1,
	withoutTrailingSlash: withoutTrailingSlash_1
}, '__esModule', {value: true});

/*!
  * vue-router v3.5.1
  * (c) 2021 Evan You
  * @license MIT
  */

function extend (a, b) {
  for (var key in b) {
    a[key] = b[key];
  }
  return a
}

/*  */

var encodeReserveRE = /[!'()*]/g;
var encodeReserveReplacer = function (c) { return '%' + c.charCodeAt(0).toString(16); };
var commaRE = /%2C/g;

// fixed encodeURIComponent which is more conformant to RFC3986:
// - escapes [!'()*]
// - preserve commas
var encode$1 = function (str) { return encodeURIComponent(str)
    .replace(encodeReserveRE, encodeReserveReplacer)
    .replace(commaRE, ','); };

function decode$1 (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
  }
  return str
}

function resolveQuery (
  query,
  extraQuery,
  _parseQuery
) {
  if ( extraQuery === void 0 ) extraQuery = {};

  var parse = _parseQuery || parseQuery$1;
  var parsedQuery;
  try {
    parsedQuery = parse(query || '');
  } catch (e) {
    parsedQuery = {};
  }
  for (var key in extraQuery) {
    var value = extraQuery[key];
    parsedQuery[key] = Array.isArray(value)
      ? value.map(castQueryParamValue)
      : castQueryParamValue(value);
  }
  return parsedQuery
}

var castQueryParamValue = function (value) { return (value == null || typeof value === 'object' ? value : String(value)); };

function parseQuery$1 (query) {
  var res = {};

  query = query.trim().replace(/^(\?|#|&)/, '');

  if (!query) {
    return res
  }

  query.split('&').forEach(function (param) {
    var parts = param.replace(/\+/g, ' ').split('=');
    var key = decode$1(parts.shift());
    var val = parts.length > 0 ? decode$1(parts.join('=')) : null;

    if (res[key] === undefined) {
      res[key] = val;
    } else if (Array.isArray(res[key])) {
      res[key].push(val);
    } else {
      res[key] = [res[key], val];
    }
  });

  return res
}

function stringifyQuery$1 (obj) {
  var res = obj
    ? Object.keys(obj)
      .map(function (key) {
        var val = obj[key];

        if (val === undefined) {
          return ''
        }

        if (val === null) {
          return encode$1(key)
        }

        if (Array.isArray(val)) {
          var result = [];
          val.forEach(function (val2) {
            if (val2 === undefined) {
              return
            }
            if (val2 === null) {
              result.push(encode$1(key));
            } else {
              result.push(encode$1(key) + '=' + encode$1(val2));
            }
          });
          return result.join('&')
        }

        return encode$1(key) + '=' + encode$1(val)
      })
      .filter(function (x) { return x.length > 0; })
      .join('&')
    : null;
  return res ? ("?" + res) : ''
}

/*  */

var trailingSlashRE = /\/?$/;

function createRoute (
  record,
  location,
  redirectedFrom,
  router
) {
  var stringifyQuery = router && router.options.stringifyQuery;

  var query = location.query || {};
  try {
    query = clone(query);
  } catch (e) {}

  var route = {
    name: location.name || (record && record.name),
    meta: (record && record.meta) || {},
    path: location.path || '/',
    hash: location.hash || '',
    query: query,
    params: location.params || {},
    fullPath: getFullPath(location, stringifyQuery),
    matched: record ? formatMatch(record) : []
  };
  if (redirectedFrom) {
    route.redirectedFrom = getFullPath(redirectedFrom, stringifyQuery);
  }
  return Object.freeze(route)
}

function clone (value) {
  if (Array.isArray(value)) {
    return value.map(clone)
  } else if (value && typeof value === 'object') {
    var res = {};
    for (var key in value) {
      res[key] = clone(value[key]);
    }
    return res
  } else {
    return value
  }
}

// the starting route that represents the initial state
var START = createRoute(null, {
  path: '/'
});

function formatMatch (record) {
  var res = [];
  while (record) {
    res.unshift(record);
    record = record.parent;
  }
  return res
}

function getFullPath (
  ref,
  _stringifyQuery
) {
  var path = ref.path;
  var query = ref.query; if ( query === void 0 ) query = {};
  var hash = ref.hash; if ( hash === void 0 ) hash = '';

  var stringify = _stringifyQuery || stringifyQuery$1;
  return (path || '/') + stringify(query) + hash
}

function isSameRoute (a, b, onlyPath) {
  if (b === START) {
    return a === b
  } else if (!b) {
    return false
  } else if (a.path && b.path) {
    return a.path.replace(trailingSlashRE, '') === b.path.replace(trailingSlashRE, '') && (onlyPath ||
      a.hash === b.hash &&
      isObjectEqual(a.query, b.query))
  } else if (a.name && b.name) {
    return (
      a.name === b.name &&
      (onlyPath || (
        a.hash === b.hash &&
      isObjectEqual(a.query, b.query) &&
      isObjectEqual(a.params, b.params))
      )
    )
  } else {
    return false
  }
}

function isObjectEqual (a, b) {
  if ( a === void 0 ) a = {};
  if ( b === void 0 ) b = {};

  // handle null value #1566
  if (!a || !b) { return a === b }
  var aKeys = Object.keys(a).sort();
  var bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) {
    return false
  }
  return aKeys.every(function (key, i) {
    var aVal = a[key];
    var bKey = bKeys[i];
    if (bKey !== key) { return false }
    var bVal = b[key];
    // query values can be null and undefined
    if (aVal == null || bVal == null) { return aVal === bVal }
    // check nested equality
    if (typeof aVal === 'object' && typeof bVal === 'object') {
      return isObjectEqual(aVal, bVal)
    }
    return String(aVal) === String(bVal)
  })
}

function isIncludedRoute (current, target) {
  return (
    current.path.replace(trailingSlashRE, '/').indexOf(
      target.path.replace(trailingSlashRE, '/')
    ) === 0 &&
    (!target.hash || current.hash === target.hash) &&
    queryIncludes(current.query, target.query)
  )
}

function queryIncludes (current, target) {
  for (var key in target) {
    if (!(key in current)) {
      return false
    }
  }
  return true
}

function handleRouteEntered (route) {
  for (var i = 0; i < route.matched.length; i++) {
    var record = route.matched[i];
    for (var name in record.instances) {
      var instance = record.instances[name];
      var cbs = record.enteredCbs[name];
      if (!instance || !cbs) { continue }
      delete record.enteredCbs[name];
      for (var i$1 = 0; i$1 < cbs.length; i$1++) {
        if (!instance._isBeingDestroyed) { cbs[i$1](instance); }
      }
    }
  }
}

var View = {
  name: 'RouterView',
  functional: true,
  props: {
    name: {
      type: String,
      default: 'default'
    }
  },
  render: function render (_, ref) {
    var props = ref.props;
    var children = ref.children;
    var parent = ref.parent;
    var data = ref.data;

    // used by devtools to display a router-view badge
    data.routerView = true;

    // directly use parent context's createElement() function
    // so that components rendered by router-view can resolve named slots
    var h = parent.$createElement;
    var name = props.name;
    var route = parent.$route;
    var cache = parent._routerViewCache || (parent._routerViewCache = {});

    // determine current view depth, also check to see if the tree
    // has been toggled inactive but kept-alive.
    var depth = 0;
    var inactive = false;
    while (parent && parent._routerRoot !== parent) {
      var vnodeData = parent.$vnode ? parent.$vnode.data : {};
      if (vnodeData.routerView) {
        depth++;
      }
      if (vnodeData.keepAlive && parent._directInactive && parent._inactive) {
        inactive = true;
      }
      parent = parent.$parent;
    }
    data.routerViewDepth = depth;

    // render previous view if the tree is inactive and kept-alive
    if (inactive) {
      var cachedData = cache[name];
      var cachedComponent = cachedData && cachedData.component;
      if (cachedComponent) {
        // #2301
        // pass props
        if (cachedData.configProps) {
          fillPropsinData(cachedComponent, data, cachedData.route, cachedData.configProps);
        }
        return h(cachedComponent, data, children)
      } else {
        // render previous empty view
        return h()
      }
    }

    var matched = route.matched[depth];
    var component = matched && matched.components[name];

    // render empty node if no matched route or no config component
    if (!matched || !component) {
      cache[name] = null;
      return h()
    }

    // cache component
    cache[name] = { component: component };

    // attach instance registration hook
    // this will be called in the instance's injected lifecycle hooks
    data.registerRouteInstance = function (vm, val) {
      // val could be undefined for unregistration
      var current = matched.instances[name];
      if (
        (val && current !== vm) ||
        (!val && current === vm)
      ) {
        matched.instances[name] = val;
      }
    }

    // also register instance in prepatch hook
    // in case the same component instance is reused across different routes
    ;(data.hook || (data.hook = {})).prepatch = function (_, vnode) {
      matched.instances[name] = vnode.componentInstance;
    };

    // register instance in init hook
    // in case kept-alive component be actived when routes changed
    data.hook.init = function (vnode) {
      if (vnode.data.keepAlive &&
        vnode.componentInstance &&
        vnode.componentInstance !== matched.instances[name]
      ) {
        matched.instances[name] = vnode.componentInstance;
      }

      // if the route transition has already been confirmed then we weren't
      // able to call the cbs during confirmation as the component was not
      // registered yet, so we call it here.
      handleRouteEntered(route);
    };

    var configProps = matched.props && matched.props[name];
    // save route and configProps in cache
    if (configProps) {
      extend(cache[name], {
        route: route,
        configProps: configProps
      });
      fillPropsinData(component, data, route, configProps);
    }

    return h(component, data, children)
  }
};

function fillPropsinData (component, data, route, configProps) {
  // resolve props
  var propsToPass = data.props = resolveProps(route, configProps);
  if (propsToPass) {
    // clone to prevent mutation
    propsToPass = data.props = extend({}, propsToPass);
    // pass non-declared props as attrs
    var attrs = data.attrs = data.attrs || {};
    for (var key in propsToPass) {
      if (!component.props || !(key in component.props)) {
        attrs[key] = propsToPass[key];
        delete propsToPass[key];
      }
    }
  }
}

function resolveProps (route, config) {
  switch (typeof config) {
    case 'undefined':
      return
    case 'object':
      return config
    case 'function':
      return config(route)
    case 'boolean':
      return config ? route.params : undefined
  }
}

/*  */

function resolvePath (
  relative,
  base,
  append
) {
  var firstChar = relative.charAt(0);
  if (firstChar === '/') {
    return relative
  }

  if (firstChar === '?' || firstChar === '#') {
    return base + relative
  }

  var stack = base.split('/');

  // remove trailing segment if:
  // - not appending
  // - appending to trailing slash (last segment is empty)
  if (!append || !stack[stack.length - 1]) {
    stack.pop();
  }

  // resolve relative path
  var segments = relative.replace(/^\//, '').split('/');
  for (var i = 0; i < segments.length; i++) {
    var segment = segments[i];
    if (segment === '..') {
      stack.pop();
    } else if (segment !== '.') {
      stack.push(segment);
    }
  }

  // ensure leading slash
  if (stack[0] !== '') {
    stack.unshift('');
  }

  return stack.join('/')
}

function parsePath$1 (path) {
  var hash = '';
  var query = '';

  var hashIndex = path.indexOf('#');
  if (hashIndex >= 0) {
    hash = path.slice(hashIndex);
    path = path.slice(0, hashIndex);
  }

  var queryIndex = path.indexOf('?');
  if (queryIndex >= 0) {
    query = path.slice(queryIndex + 1);
    path = path.slice(0, queryIndex);
  }

  return {
    path: path,
    query: query,
    hash: hash
  }
}

function cleanPath (path) {
  return path.replace(/\/\//g, '/')
}

var isarray = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

/**
 * Expose `pathToRegexp`.
 */
var pathToRegexp_1 = pathToRegexp;
var parse_1 = parse;
var compile_1 = compile;
var tokensToFunction_1 = tokensToFunction;
var tokensToRegExp_1 = tokensToRegExp;

/**
 * The main path matching regexp utility.
 *
 * @type {RegExp}
 */
var PATH_REGEXP = new RegExp([
  // Match escaped characters that would otherwise appear in future matches.
  // This allows the user to escape special characters that won't transform.
  '(\\\\.)',
  // Match Express-style parameters and un-named parameters with a prefix
  // and optional suffixes. Matches appear as:
  //
  // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?", undefined]
  // "/route(\\d+)"  => [undefined, undefined, undefined, "\d+", undefined, undefined]
  // "/*"            => ["/", undefined, undefined, undefined, undefined, "*"]
  '([\\/.])?(?:(?:\\:(\\w+)(?:\\(((?:\\\\.|[^\\\\()])+)\\))?|\\(((?:\\\\.|[^\\\\()])+)\\))([+*?])?|(\\*))'
].join('|'), 'g');

/**
 * Parse a string for the raw tokens.
 *
 * @param  {string}  str
 * @param  {Object=} options
 * @return {!Array}
 */
function parse (str, options) {
  var tokens = [];
  var key = 0;
  var index = 0;
  var path = '';
  var defaultDelimiter = options && options.delimiter || '/';
  var res;

  while ((res = PATH_REGEXP.exec(str)) != null) {
    var m = res[0];
    var escaped = res[1];
    var offset = res.index;
    path += str.slice(index, offset);
    index = offset + m.length;

    // Ignore already escaped sequences.
    if (escaped) {
      path += escaped[1];
      continue
    }

    var next = str[index];
    var prefix = res[2];
    var name = res[3];
    var capture = res[4];
    var group = res[5];
    var modifier = res[6];
    var asterisk = res[7];

    // Push the current path onto the tokens.
    if (path) {
      tokens.push(path);
      path = '';
    }

    var partial = prefix != null && next != null && next !== prefix;
    var repeat = modifier === '+' || modifier === '*';
    var optional = modifier === '?' || modifier === '*';
    var delimiter = res[2] || defaultDelimiter;
    var pattern = capture || group;

    tokens.push({
      name: name || key++,
      prefix: prefix || '',
      delimiter: delimiter,
      optional: optional,
      repeat: repeat,
      partial: partial,
      asterisk: !!asterisk,
      pattern: pattern ? escapeGroup(pattern) : (asterisk ? '.*' : '[^' + escapeString(delimiter) + ']+?')
    });
  }

  // Match any characters still remaining.
  if (index < str.length) {
    path += str.substr(index);
  }

  // If the path exists, push it onto the end.
  if (path) {
    tokens.push(path);
  }

  return tokens
}

/**
 * Compile a string to a template function for the path.
 *
 * @param  {string}             str
 * @param  {Object=}            options
 * @return {!function(Object=, Object=)}
 */
function compile (str, options) {
  return tokensToFunction(parse(str, options), options)
}

/**
 * Prettier encoding of URI path segments.
 *
 * @param  {string}
 * @return {string}
 */
function encodeURIComponentPretty (str) {
  return encodeURI(str).replace(/[\/?#]/g, function (c) {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase()
  })
}

/**
 * Encode the asterisk parameter. Similar to `pretty`, but allows slashes.
 *
 * @param  {string}
 * @return {string}
 */
function encodeAsterisk (str) {
  return encodeURI(str).replace(/[?#]/g, function (c) {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase()
  })
}

/**
 * Expose a method for transforming tokens into the path function.
 */
function tokensToFunction (tokens, options) {
  // Compile all the tokens into regexps.
  var matches = new Array(tokens.length);

  // Compile all the patterns before compilation.
  for (var i = 0; i < tokens.length; i++) {
    if (typeof tokens[i] === 'object') {
      matches[i] = new RegExp('^(?:' + tokens[i].pattern + ')$', flags(options));
    }
  }

  return function (obj, opts) {
    var path = '';
    var data = obj || {};
    var options = opts || {};
    var encode = options.pretty ? encodeURIComponentPretty : encodeURIComponent;

    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];

      if (typeof token === 'string') {
        path += token;

        continue
      }

      var value = data[token.name];
      var segment;

      if (value == null) {
        if (token.optional) {
          // Prepend partial segment prefixes.
          if (token.partial) {
            path += token.prefix;
          }

          continue
        } else {
          throw new TypeError('Expected "' + token.name + '" to be defined')
        }
      }

      if (isarray(value)) {
        if (!token.repeat) {
          throw new TypeError('Expected "' + token.name + '" to not repeat, but received `' + JSON.stringify(value) + '`')
        }

        if (value.length === 0) {
          if (token.optional) {
            continue
          } else {
            throw new TypeError('Expected "' + token.name + '" to not be empty')
          }
        }

        for (var j = 0; j < value.length; j++) {
          segment = encode(value[j]);

          if (!matches[i].test(segment)) {
            throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '", but received `' + JSON.stringify(segment) + '`')
          }

          path += (j === 0 ? token.prefix : token.delimiter) + segment;
        }

        continue
      }

      segment = token.asterisk ? encodeAsterisk(value) : encode(value);

      if (!matches[i].test(segment)) {
        throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
      }

      path += token.prefix + segment;
    }

    return path
  }
}

/**
 * Escape a regular expression string.
 *
 * @param  {string} str
 * @return {string}
 */
function escapeString (str) {
  return str.replace(/([.+*?=^!:${}()[\]|\/\\])/g, '\\$1')
}

/**
 * Escape the capturing group by escaping special characters and meaning.
 *
 * @param  {string} group
 * @return {string}
 */
function escapeGroup (group) {
  return group.replace(/([=!:$\/()])/g, '\\$1')
}

/**
 * Attach the keys as a property of the regexp.
 *
 * @param  {!RegExp} re
 * @param  {Array}   keys
 * @return {!RegExp}
 */
function attachKeys (re, keys) {
  re.keys = keys;
  return re
}

/**
 * Get the flags for a regexp from the options.
 *
 * @param  {Object} options
 * @return {string}
 */
function flags (options) {
  return options && options.sensitive ? '' : 'i'
}

/**
 * Pull out keys from a regexp.
 *
 * @param  {!RegExp} path
 * @param  {!Array}  keys
 * @return {!RegExp}
 */
function regexpToRegexp (path, keys) {
  // Use a negative lookahead to match only capturing groups.
  var groups = path.source.match(/\((?!\?)/g);

  if (groups) {
    for (var i = 0; i < groups.length; i++) {
      keys.push({
        name: i,
        prefix: null,
        delimiter: null,
        optional: false,
        repeat: false,
        partial: false,
        asterisk: false,
        pattern: null
      });
    }
  }

  return attachKeys(path, keys)
}

/**
 * Transform an array into a regexp.
 *
 * @param  {!Array}  path
 * @param  {Array}   keys
 * @param  {!Object} options
 * @return {!RegExp}
 */
function arrayToRegexp (path, keys, options) {
  var parts = [];

  for (var i = 0; i < path.length; i++) {
    parts.push(pathToRegexp(path[i], keys, options).source);
  }

  var regexp = new RegExp('(?:' + parts.join('|') + ')', flags(options));

  return attachKeys(regexp, keys)
}

/**
 * Create a path regexp from string input.
 *
 * @param  {string}  path
 * @param  {!Array}  keys
 * @param  {!Object} options
 * @return {!RegExp}
 */
function stringToRegexp (path, keys, options) {
  return tokensToRegExp(parse(path, options), keys, options)
}

/**
 * Expose a function for taking tokens and returning a RegExp.
 *
 * @param  {!Array}          tokens
 * @param  {(Array|Object)=} keys
 * @param  {Object=}         options
 * @return {!RegExp}
 */
function tokensToRegExp (tokens, keys, options) {
  if (!isarray(keys)) {
    options = /** @type {!Object} */ (keys || options);
    keys = [];
  }

  options = options || {};

  var strict = options.strict;
  var end = options.end !== false;
  var route = '';

  // Iterate over the tokens and create our regexp string.
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];

    if (typeof token === 'string') {
      route += escapeString(token);
    } else {
      var prefix = escapeString(token.prefix);
      var capture = '(?:' + token.pattern + ')';

      keys.push(token);

      if (token.repeat) {
        capture += '(?:' + prefix + capture + ')*';
      }

      if (token.optional) {
        if (!token.partial) {
          capture = '(?:' + prefix + '(' + capture + '))?';
        } else {
          capture = prefix + '(' + capture + ')?';
        }
      } else {
        capture = prefix + '(' + capture + ')';
      }

      route += capture;
    }
  }

  var delimiter = escapeString(options.delimiter || '/');
  var endsWithDelimiter = route.slice(-delimiter.length) === delimiter;

  // In non-strict mode we allow a slash at the end of match. If the path to
  // match already ends with a slash, we remove it for consistency. The slash
  // is valid at the end of a path match, not in the middle. This is important
  // in non-ending mode, where "/test/" shouldn't match "/test//route".
  if (!strict) {
    route = (endsWithDelimiter ? route.slice(0, -delimiter.length) : route) + '(?:' + delimiter + '(?=$))?';
  }

  if (end) {
    route += '$';
  } else {
    // In non-ending mode, we need the capturing groups to match as much as
    // possible by using a positive lookahead to the end or next path segment.
    route += strict && endsWithDelimiter ? '' : '(?=' + delimiter + '|$)';
  }

  return attachKeys(new RegExp('^' + route, flags(options)), keys)
}

/**
 * Normalize the given path string, returning a regular expression.
 *
 * An empty array can be passed in for the keys, which will hold the
 * placeholder key descriptions. For example, using `/user/:id`, `keys` will
 * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
 *
 * @param  {(string|RegExp|Array)} path
 * @param  {(Array|Object)=}       keys
 * @param  {Object=}               options
 * @return {!RegExp}
 */
function pathToRegexp (path, keys, options) {
  if (!isarray(keys)) {
    options = /** @type {!Object} */ (keys || options);
    keys = [];
  }

  options = options || {};

  if (path instanceof RegExp) {
    return regexpToRegexp(path, /** @type {!Array} */ (keys))
  }

  if (isarray(path)) {
    return arrayToRegexp(/** @type {!Array} */ (path), /** @type {!Array} */ (keys), options)
  }

  return stringToRegexp(/** @type {string} */ (path), /** @type {!Array} */ (keys), options)
}
pathToRegexp_1.parse = parse_1;
pathToRegexp_1.compile = compile_1;
pathToRegexp_1.tokensToFunction = tokensToFunction_1;
pathToRegexp_1.tokensToRegExp = tokensToRegExp_1;

/*  */

// $flow-disable-line
var regexpCompileCache = Object.create(null);

function fillParams (
  path,
  params,
  routeMsg
) {
  params = params || {};
  try {
    var filler =
      regexpCompileCache[path] ||
      (regexpCompileCache[path] = pathToRegexp_1.compile(path));

    // Fix #2505 resolving asterisk routes { name: 'not-found', params: { pathMatch: '/not-found' }}
    // and fix #3106 so that you can work with location descriptor object having params.pathMatch equal to empty string
    if (typeof params.pathMatch === 'string') { params[0] = params.pathMatch; }

    return filler(params, { pretty: true })
  } catch (e) {
    return ''
  } finally {
    // delete the 0 if it was added
    delete params[0];
  }
}

/*  */

function normalizeLocation (
  raw,
  current,
  append,
  router
) {
  var next = typeof raw === 'string' ? { path: raw } : raw;
  // named target
  if (next._normalized) {
    return next
  } else if (next.name) {
    next = extend({}, raw);
    var params = next.params;
    if (params && typeof params === 'object') {
      next.params = extend({}, params);
    }
    return next
  }

  // relative params
  if (!next.path && next.params && current) {
    next = extend({}, next);
    next._normalized = true;
    var params$1 = extend(extend({}, current.params), next.params);
    if (current.name) {
      next.name = current.name;
      next.params = params$1;
    } else if (current.matched.length) {
      var rawPath = current.matched[current.matched.length - 1].path;
      next.path = fillParams(rawPath, params$1, ("path " + (current.path)));
    } else ;
    return next
  }

  var parsedPath = parsePath$1(next.path || '');
  var basePath = (current && current.path) || '/';
  var path = parsedPath.path
    ? resolvePath(parsedPath.path, basePath, append || next.append)
    : basePath;

  var query = resolveQuery(
    parsedPath.query,
    next.query,
    router && router.options.parseQuery
  );

  var hash = next.hash || parsedPath.hash;
  if (hash && hash.charAt(0) !== '#') {
    hash = "#" + hash;
  }

  return {
    _normalized: true,
    path: path,
    query: query,
    hash: hash
  }
}

/*  */

// work around weird flow bug
var toTypes = [String, Object];
var eventTypes = [String, Array];

var noop = function () {};

var Link = {
  name: 'RouterLink',
  props: {
    to: {
      type: toTypes,
      required: true
    },
    tag: {
      type: String,
      default: 'a'
    },
    custom: Boolean,
    exact: Boolean,
    exactPath: Boolean,
    append: Boolean,
    replace: Boolean,
    activeClass: String,
    exactActiveClass: String,
    ariaCurrentValue: {
      type: String,
      default: 'page'
    },
    event: {
      type: eventTypes,
      default: 'click'
    }
  },
  render: function render (h) {
    var this$1 = this;

    var router = this.$router;
    var current = this.$route;
    var ref = router.resolve(
      this.to,
      current,
      this.append
    );
    var location = ref.location;
    var route = ref.route;
    var href = ref.href;

    var classes = {};
    var globalActiveClass = router.options.linkActiveClass;
    var globalExactActiveClass = router.options.linkExactActiveClass;
    // Support global empty active class
    var activeClassFallback =
      globalActiveClass == null ? 'router-link-active' : globalActiveClass;
    var exactActiveClassFallback =
      globalExactActiveClass == null
        ? 'router-link-exact-active'
        : globalExactActiveClass;
    var activeClass =
      this.activeClass == null ? activeClassFallback : this.activeClass;
    var exactActiveClass =
      this.exactActiveClass == null
        ? exactActiveClassFallback
        : this.exactActiveClass;

    var compareTarget = route.redirectedFrom
      ? createRoute(null, normalizeLocation(route.redirectedFrom), null, router)
      : route;

    classes[exactActiveClass] = isSameRoute(current, compareTarget, this.exactPath);
    classes[activeClass] = this.exact || this.exactPath
      ? classes[exactActiveClass]
      : isIncludedRoute(current, compareTarget);

    var ariaCurrentValue = classes[exactActiveClass] ? this.ariaCurrentValue : null;

    var handler = function (e) {
      if (guardEvent(e)) {
        if (this$1.replace) {
          router.replace(location, noop);
        } else {
          router.push(location, noop);
        }
      }
    };

    var on = { click: guardEvent };
    if (Array.isArray(this.event)) {
      this.event.forEach(function (e) {
        on[e] = handler;
      });
    } else {
      on[this.event] = handler;
    }

    var data = { class: classes };

    var scopedSlot =
      !this.$scopedSlots.$hasNormal &&
      this.$scopedSlots.default &&
      this.$scopedSlots.default({
        href: href,
        route: route,
        navigate: handler,
        isActive: classes[activeClass],
        isExactActive: classes[exactActiveClass]
      });

    if (scopedSlot) {
      if (scopedSlot.length === 1) {
        return scopedSlot[0]
      } else if (scopedSlot.length > 1 || !scopedSlot.length) {
        return scopedSlot.length === 0 ? h() : h('span', {}, scopedSlot)
      }
    }

    if (this.tag === 'a') {
      data.on = on;
      data.attrs = { href: href, 'aria-current': ariaCurrentValue };
    } else {
      // find the first <a> child and apply listener and href
      var a = findAnchor(this.$slots.default);
      if (a) {
        // in case the <a> is a static node
        a.isStatic = false;
        var aData = (a.data = extend({}, a.data));
        aData.on = aData.on || {};
        // transform existing events in both objects into arrays so we can push later
        for (var event in aData.on) {
          var handler$1 = aData.on[event];
          if (event in on) {
            aData.on[event] = Array.isArray(handler$1) ? handler$1 : [handler$1];
          }
        }
        // append new listeners for router-link
        for (var event$1 in on) {
          if (event$1 in aData.on) {
            // on[event] is always a function
            aData.on[event$1].push(on[event$1]);
          } else {
            aData.on[event$1] = handler;
          }
        }

        var aAttrs = (a.data.attrs = extend({}, a.data.attrs));
        aAttrs.href = href;
        aAttrs['aria-current'] = ariaCurrentValue;
      } else {
        // doesn't have <a> child, apply listener to self
        data.on = on;
      }
    }

    return h(this.tag, data, this.$slots.default)
  }
};

function guardEvent (e) {
  // don't redirect with control keys
  if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) { return }
  // don't redirect when preventDefault called
  if (e.defaultPrevented) { return }
  // don't redirect on right click
  if (e.button !== undefined && e.button !== 0) { return }
  // don't redirect if `target="_blank"`
  if (e.currentTarget && e.currentTarget.getAttribute) {
    var target = e.currentTarget.getAttribute('target');
    if (/\b_blank\b/i.test(target)) { return }
  }
  // this may be a Weex event which doesn't have this method
  if (e.preventDefault) {
    e.preventDefault();
  }
  return true
}

function findAnchor (children) {
  if (children) {
    var child;
    for (var i = 0; i < children.length; i++) {
      child = children[i];
      if (child.tag === 'a') {
        return child
      }
      if (child.children && (child = findAnchor(child.children))) {
        return child
      }
    }
  }
}

var _Vue;

function install (Vue) {
  if (install.installed && _Vue === Vue) { return }
  install.installed = true;

  _Vue = Vue;

  var isDef = function (v) { return v !== undefined; };

  var registerInstance = function (vm, callVal) {
    var i = vm.$options._parentVnode;
    if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
      i(vm, callVal);
    }
  };

  Vue.mixin({
    beforeCreate: function beforeCreate () {
      if (isDef(this.$options.router)) {
        this._routerRoot = this;
        this._router = this.$options.router;
        this._router.init(this);
        Vue.util.defineReactive(this, '_route', this._router.history.current);
      } else {
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this;
      }
      registerInstance(this, this);
    },
    destroyed: function destroyed () {
      registerInstance(this);
    }
  });

  Object.defineProperty(Vue.prototype, '$router', {
    get: function get () { return this._routerRoot._router }
  });

  Object.defineProperty(Vue.prototype, '$route', {
    get: function get () { return this._routerRoot._route }
  });

  Vue.component('RouterView', View);
  Vue.component('RouterLink', Link);

  var strats = Vue.config.optionMergeStrategies;
  // use the same hook merging strategy for route hooks
  strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created;
}

/*  */

var inBrowser = "undefined" !== 'undefined';

/*  */

function createRouteMap (
  routes,
  oldPathList,
  oldPathMap,
  oldNameMap,
  parentRoute
) {
  // the path list is used to control path matching priority
  var pathList = oldPathList || [];
  // $flow-disable-line
  var pathMap = oldPathMap || Object.create(null);
  // $flow-disable-line
  var nameMap = oldNameMap || Object.create(null);

  routes.forEach(function (route) {
    addRouteRecord(pathList, pathMap, nameMap, route, parentRoute);
  });

  // ensure wildcard routes are always at the end
  for (var i = 0, l = pathList.length; i < l; i++) {
    if (pathList[i] === '*') {
      pathList.push(pathList.splice(i, 1)[0]);
      l--;
      i--;
    }
  }

  return {
    pathList: pathList,
    pathMap: pathMap,
    nameMap: nameMap
  }
}

function addRouteRecord (
  pathList,
  pathMap,
  nameMap,
  route,
  parent,
  matchAs
) {
  var path = route.path;
  var name = route.name;

  var pathToRegexpOptions =
    route.pathToRegexpOptions || {};
  var normalizedPath = normalizePath(path, parent, pathToRegexpOptions.strict);

  if (typeof route.caseSensitive === 'boolean') {
    pathToRegexpOptions.sensitive = route.caseSensitive;
  }

  var record = {
    path: normalizedPath,
    regex: compileRouteRegex(normalizedPath, pathToRegexpOptions),
    components: route.components || { default: route.component },
    alias: route.alias
      ? typeof route.alias === 'string'
        ? [route.alias]
        : route.alias
      : [],
    instances: {},
    enteredCbs: {},
    name: name,
    parent: parent,
    matchAs: matchAs,
    redirect: route.redirect,
    beforeEnter: route.beforeEnter,
    meta: route.meta || {},
    props:
      route.props == null
        ? {}
        : route.components
          ? route.props
          : { default: route.props }
  };

  if (route.children) {
    route.children.forEach(function (child) {
      var childMatchAs = matchAs
        ? cleanPath((matchAs + "/" + (child.path)))
        : undefined;
      addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs);
    });
  }

  if (!pathMap[record.path]) {
    pathList.push(record.path);
    pathMap[record.path] = record;
  }

  if (route.alias !== undefined) {
    var aliases = Array.isArray(route.alias) ? route.alias : [route.alias];
    for (var i = 0; i < aliases.length; ++i) {
      var alias = aliases[i];

      var aliasRoute = {
        path: alias,
        children: route.children
      };
      addRouteRecord(
        pathList,
        pathMap,
        nameMap,
        aliasRoute,
        parent,
        record.path || '/' // matchAs
      );
    }
  }

  if (name) {
    if (!nameMap[name]) {
      nameMap[name] = record;
    }
  }
}

function compileRouteRegex (
  path,
  pathToRegexpOptions
) {
  var regex = pathToRegexp_1(path, [], pathToRegexpOptions);
  return regex
}

function normalizePath (
  path,
  parent,
  strict
) {
  if (!strict) { path = path.replace(/\/$/, ''); }
  if (path[0] === '/') { return path }
  if (parent == null) { return path }
  return cleanPath(((parent.path) + "/" + path))
}

/*  */



function createMatcher (
  routes,
  router
) {
  var ref = createRouteMap(routes);
  var pathList = ref.pathList;
  var pathMap = ref.pathMap;
  var nameMap = ref.nameMap;

  function addRoutes (routes) {
    createRouteMap(routes, pathList, pathMap, nameMap);
  }

  function addRoute (parentOrRoute, route) {
    var parent = (typeof parentOrRoute !== 'object') ? nameMap[parentOrRoute] : undefined;
    // $flow-disable-line
    createRouteMap([route || parentOrRoute], pathList, pathMap, nameMap, parent);

    // add aliases of parent
    if (parent) {
      createRouteMap(
        // $flow-disable-line route is defined if parent is
        parent.alias.map(function (alias) { return ({ path: alias, children: [route] }); }),
        pathList,
        pathMap,
        nameMap,
        parent
      );
    }
  }

  function getRoutes () {
    return pathList.map(function (path) { return pathMap[path]; })
  }

  function match (
    raw,
    currentRoute,
    redirectedFrom
  ) {
    var location = normalizeLocation(raw, currentRoute, false, router);
    var name = location.name;

    if (name) {
      var record = nameMap[name];
      if (!record) { return _createRoute(null, location) }
      var paramNames = record.regex.keys
        .filter(function (key) { return !key.optional; })
        .map(function (key) { return key.name; });

      if (typeof location.params !== 'object') {
        location.params = {};
      }

      if (currentRoute && typeof currentRoute.params === 'object') {
        for (var key in currentRoute.params) {
          if (!(key in location.params) && paramNames.indexOf(key) > -1) {
            location.params[key] = currentRoute.params[key];
          }
        }
      }

      location.path = fillParams(record.path, location.params);
      return _createRoute(record, location, redirectedFrom)
    } else if (location.path) {
      location.params = {};
      for (var i = 0; i < pathList.length; i++) {
        var path = pathList[i];
        var record$1 = pathMap[path];
        if (matchRoute(record$1.regex, location.path, location.params)) {
          return _createRoute(record$1, location, redirectedFrom)
        }
      }
    }
    // no match
    return _createRoute(null, location)
  }

  function redirect (
    record,
    location
  ) {
    var originalRedirect = record.redirect;
    var redirect = typeof originalRedirect === 'function'
      ? originalRedirect(createRoute(record, location, null, router))
      : originalRedirect;

    if (typeof redirect === 'string') {
      redirect = { path: redirect };
    }

    if (!redirect || typeof redirect !== 'object') {
      return _createRoute(null, location)
    }

    var re = redirect;
    var name = re.name;
    var path = re.path;
    var query = location.query;
    var hash = location.hash;
    var params = location.params;
    query = re.hasOwnProperty('query') ? re.query : query;
    hash = re.hasOwnProperty('hash') ? re.hash : hash;
    params = re.hasOwnProperty('params') ? re.params : params;

    if (name) {
      // resolved named direct
      nameMap[name];
      return match({
        _normalized: true,
        name: name,
        query: query,
        hash: hash,
        params: params
      }, undefined, location)
    } else if (path) {
      // 1. resolve relative redirect
      var rawPath = resolveRecordPath(path, record);
      // 2. resolve params
      var resolvedPath = fillParams(rawPath, params);
      // 3. rematch with existing query and hash
      return match({
        _normalized: true,
        path: resolvedPath,
        query: query,
        hash: hash
      }, undefined, location)
    } else {
      return _createRoute(null, location)
    }
  }

  function alias (
    record,
    location,
    matchAs
  ) {
    var aliasedPath = fillParams(matchAs, location.params);
    var aliasedMatch = match({
      _normalized: true,
      path: aliasedPath
    });
    if (aliasedMatch) {
      var matched = aliasedMatch.matched;
      var aliasedRecord = matched[matched.length - 1];
      location.params = aliasedMatch.params;
      return _createRoute(aliasedRecord, location)
    }
    return _createRoute(null, location)
  }

  function _createRoute (
    record,
    location,
    redirectedFrom
  ) {
    if (record && record.redirect) {
      return redirect(record, redirectedFrom || location)
    }
    if (record && record.matchAs) {
      return alias(record, location, record.matchAs)
    }
    return createRoute(record, location, redirectedFrom, router)
  }

  return {
    match: match,
    addRoute: addRoute,
    getRoutes: getRoutes,
    addRoutes: addRoutes
  }
}

function matchRoute (
  regex,
  path,
  params
) {
  var m = path.match(regex);

  if (!m) {
    return false
  } else if (!params) {
    return true
  }

  for (var i = 1, len = m.length; i < len; ++i) {
    var key = regex.keys[i - 1];
    if (key) {
      // Fix #1994: using * with props: true generates a param named 0
      params[key.name || 'pathMatch'] = typeof m[i] === 'string' ? decode$1(m[i]) : m[i];
    }
  }

  return true
}

function resolveRecordPath (path, record) {
  return resolvePath(path, record.parent ? record.parent.path : '/', true)
}

/*  */

// use User Timing api (if present) for more accurate key precision
var Time =
  Date;

function genStateKey () {
  return Time.now().toFixed(3)
}

var _key = genStateKey();

function getStateKey () {
  return _key
}

function setStateKey (key) {
  return (_key = key)
}

/*  */

var positionStore = Object.create(null);

function handleScroll (
  router,
  to,
  from,
  isPop
) {
  if (!router.app) {
    return
  }

  var behavior = router.options.scrollBehavior;
  if (!behavior) {
    return
  }

  // wait until re-render finishes before scrolling
  router.app.$nextTick(function () {
    var position = getScrollPosition();
    var shouldScroll = behavior.call(
      router,
      to,
      from,
      isPop ? position : null
    );

    if (!shouldScroll) {
      return
    }

    if (typeof shouldScroll.then === 'function') {
      shouldScroll
        .then(function (shouldScroll) {
          scrollToPosition((shouldScroll), position);
        })
        .catch(function (err) {
        });
    } else {
      scrollToPosition(shouldScroll, position);
    }
  });
}

function saveScrollPosition () {
  var key = getStateKey();
  if (key) {
    positionStore[key] = {
      x: window.pageXOffset,
      y: window.pageYOffset
    };
  }
}

function getScrollPosition () {
  var key = getStateKey();
  if (key) {
    return positionStore[key]
  }
}

function getElementPosition (el, offset) {
  var docEl = document.documentElement;
  var docRect = docEl.getBoundingClientRect();
  var elRect = el.getBoundingClientRect();
  return {
    x: elRect.left - docRect.left - offset.x,
    y: elRect.top - docRect.top - offset.y
  }
}

function isValidPosition (obj) {
  return isNumber(obj.x) || isNumber(obj.y)
}

function normalizePosition (obj) {
  return {
    x: isNumber(obj.x) ? obj.x : window.pageXOffset,
    y: isNumber(obj.y) ? obj.y : window.pageYOffset
  }
}

function normalizeOffset (obj) {
  return {
    x: isNumber(obj.x) ? obj.x : 0,
    y: isNumber(obj.y) ? obj.y : 0
  }
}

function isNumber (v) {
  return typeof v === 'number'
}

var hashStartsWithNumberRE = /^#\d/;

function scrollToPosition (shouldScroll, position) {
  var isObject = typeof shouldScroll === 'object';
  if (isObject && typeof shouldScroll.selector === 'string') {
    // getElementById would still fail if the selector contains a more complicated query like #main[data-attr]
    // but at the same time, it doesn't make much sense to select an element with an id and an extra selector
    var el = hashStartsWithNumberRE.test(shouldScroll.selector) // $flow-disable-line
      ? document.getElementById(shouldScroll.selector.slice(1)) // $flow-disable-line
      : document.querySelector(shouldScroll.selector);

    if (el) {
      var offset =
        shouldScroll.offset && typeof shouldScroll.offset === 'object'
          ? shouldScroll.offset
          : {};
      offset = normalizeOffset(offset);
      position = getElementPosition(el, offset);
    } else if (isValidPosition(shouldScroll)) {
      position = normalizePosition(shouldScroll);
    }
  } else if (isObject && isValidPosition(shouldScroll)) {
    position = normalizePosition(shouldScroll);
  }

  if (position) {
    // $flow-disable-line
    if ('scrollBehavior' in document.documentElement.style) {
      window.scrollTo({
        left: position.x,
        top: position.y,
        // $flow-disable-line
        behavior: shouldScroll.behavior
      });
    } else {
      window.scrollTo(position.x, position.y);
    }
  }
}

/*  */

var supportsPushState =
  inBrowser ;

function pushState (url, replace) {
  saveScrollPosition();
  // try...catch the pushState call to get around Safari
  // DOM Exception 18 where it limits to 100 pushState calls
  var history = window.history;
  try {
    if (replace) {
      // preserve existing history state as it could be overriden by the user
      var stateCopy = extend({}, history.state);
      stateCopy.key = getStateKey();
      history.replaceState(stateCopy, '', url);
    } else {
      history.pushState({ key: setStateKey(genStateKey()) }, '', url);
    }
  } catch (e) {
    window.location[replace ? 'replace' : 'assign'](url);
  }
}

function replaceState (url) {
  pushState(url, true);
}

/*  */

function runQueue (queue, fn, cb) {
  var step = function (index) {
    if (index >= queue.length) {
      cb();
    } else {
      if (queue[index]) {
        fn(queue[index], function () {
          step(index + 1);
        });
      } else {
        step(index + 1);
      }
    }
  };
  step(0);
}

// When changing thing, also edit router.d.ts
var NavigationFailureType = {
  redirected: 2,
  aborted: 4,
  cancelled: 8,
  duplicated: 16
};

function createNavigationRedirectedError (from, to) {
  return createRouterError(
    from,
    to,
    NavigationFailureType.redirected,
    ("Redirected when going from \"" + (from.fullPath) + "\" to \"" + (stringifyRoute(
      to
    )) + "\" via a navigation guard.")
  )
}

function createNavigationDuplicatedError (from, to) {
  var error = createRouterError(
    from,
    to,
    NavigationFailureType.duplicated,
    ("Avoided redundant navigation to current location: \"" + (from.fullPath) + "\".")
  );
  // backwards compatible with the first introduction of Errors
  error.name = 'NavigationDuplicated';
  return error
}

function createNavigationCancelledError (from, to) {
  return createRouterError(
    from,
    to,
    NavigationFailureType.cancelled,
    ("Navigation cancelled from \"" + (from.fullPath) + "\" to \"" + (to.fullPath) + "\" with a new navigation.")
  )
}

function createNavigationAbortedError (from, to) {
  return createRouterError(
    from,
    to,
    NavigationFailureType.aborted,
    ("Navigation aborted from \"" + (from.fullPath) + "\" to \"" + (to.fullPath) + "\" via a navigation guard.")
  )
}

function createRouterError (from, to, type, message) {
  var error = new Error(message);
  error._isRouter = true;
  error.from = from;
  error.to = to;
  error.type = type;

  return error
}

var propertiesToLog = ['params', 'query', 'hash'];

function stringifyRoute (to) {
  if (typeof to === 'string') { return to }
  if ('path' in to) { return to.path }
  var location = {};
  propertiesToLog.forEach(function (key) {
    if (key in to) { location[key] = to[key]; }
  });
  return JSON.stringify(location, null, 2)
}

function isError (err) {
  return Object.prototype.toString.call(err).indexOf('Error') > -1
}

function isNavigationFailure (err, errorType) {
  return (
    isError(err) &&
    err._isRouter &&
    (errorType == null || err.type === errorType)
  )
}

/*  */

function resolveAsyncComponents (matched) {
  return function (to, from, next) {
    var hasAsync = false;
    var pending = 0;
    var error = null;

    flatMapComponents(matched, function (def, _, match, key) {
      // if it's a function and doesn't have cid attached,
      // assume it's an async component resolve function.
      // we are not using Vue's default async resolving mechanism because
      // we want to halt the navigation until the incoming component has been
      // resolved.
      if (typeof def === 'function' && def.cid === undefined) {
        hasAsync = true;
        pending++;

        var resolve = once(function (resolvedDef) {
          if (isESModule(resolvedDef)) {
            resolvedDef = resolvedDef.default;
          }
          // save resolved on async factory in case it's used elsewhere
          def.resolved = typeof resolvedDef === 'function'
            ? resolvedDef
            : _Vue.extend(resolvedDef);
          match.components[key] = resolvedDef;
          pending--;
          if (pending <= 0) {
            next();
          }
        });

        var reject = once(function (reason) {
          var msg = "Failed to resolve async component " + key + ": " + reason;
          if (!error) {
            error = isError(reason)
              ? reason
              : new Error(msg);
            next(error);
          }
        });

        var res;
        try {
          res = def(resolve, reject);
        } catch (e) {
          reject(e);
        }
        if (res) {
          if (typeof res.then === 'function') {
            res.then(resolve, reject);
          } else {
            // new syntax in Vue 2.3
            var comp = res.component;
            if (comp && typeof comp.then === 'function') {
              comp.then(resolve, reject);
            }
          }
        }
      }
    });

    if (!hasAsync) { next(); }
  }
}

function flatMapComponents (
  matched,
  fn
) {
  return flatten(matched.map(function (m) {
    return Object.keys(m.components).map(function (key) { return fn(
      m.components[key],
      m.instances[key],
      m, key
    ); })
  }))
}

function flatten (arr) {
  return Array.prototype.concat.apply([], arr)
}

var hasSymbol =
  typeof Symbol === 'function' &&
  typeof Symbol.toStringTag === 'symbol';

function isESModule (obj) {
  return obj.__esModule || (hasSymbol && obj[Symbol.toStringTag] === 'Module')
}

// in Webpack 2, require.ensure now also returns a Promise
// so the resolve/reject functions may get called an extra time
// if the user uses an arrow function shorthand that happens to
// return that Promise.
function once (fn) {
  var called = false;
  return function () {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    if (called) { return }
    called = true;
    return fn.apply(this, args)
  }
}

/*  */

var History = function History (router, base) {
  this.router = router;
  this.base = normalizeBase(base);
  // start with a route object that stands for "nowhere"
  this.current = START;
  this.pending = null;
  this.ready = false;
  this.readyCbs = [];
  this.readyErrorCbs = [];
  this.errorCbs = [];
  this.listeners = [];
};

History.prototype.listen = function listen (cb) {
  this.cb = cb;
};

History.prototype.onReady = function onReady (cb, errorCb) {
  if (this.ready) {
    cb();
  } else {
    this.readyCbs.push(cb);
    if (errorCb) {
      this.readyErrorCbs.push(errorCb);
    }
  }
};

History.prototype.onError = function onError (errorCb) {
  this.errorCbs.push(errorCb);
};

History.prototype.transitionTo = function transitionTo (
  location,
  onComplete,
  onAbort
) {
    var this$1 = this;

  var route;
  // catch redirect option https://github.com/vuejs/vue-router/issues/3201
  try {
    route = this.router.match(location, this.current);
  } catch (e) {
    this.errorCbs.forEach(function (cb) {
      cb(e);
    });
    // Exception should still be thrown
    throw e
  }
  var prev = this.current;
  this.confirmTransition(
    route,
    function () {
      this$1.updateRoute(route);
      onComplete && onComplete(route);
      this$1.ensureURL();
      this$1.router.afterHooks.forEach(function (hook) {
        hook && hook(route, prev);
      });

      // fire ready cbs once
      if (!this$1.ready) {
        this$1.ready = true;
        this$1.readyCbs.forEach(function (cb) {
          cb(route);
        });
      }
    },
    function (err) {
      if (onAbort) {
        onAbort(err);
      }
      if (err && !this$1.ready) {
        // Initial redirection should not mark the history as ready yet
        // because it's triggered by the redirection instead
        // https://github.com/vuejs/vue-router/issues/3225
        // https://github.com/vuejs/vue-router/issues/3331
        if (!isNavigationFailure(err, NavigationFailureType.redirected) || prev !== START) {
          this$1.ready = true;
          this$1.readyErrorCbs.forEach(function (cb) {
            cb(err);
          });
        }
      }
    }
  );
};

History.prototype.confirmTransition = function confirmTransition (route, onComplete, onAbort) {
    var this$1 = this;

  var current = this.current;
  this.pending = route;
  var abort = function (err) {
    // changed after adding errors with
    // https://github.com/vuejs/vue-router/pull/3047 before that change,
    // redirect and aborted navigation would produce an err == null
    if (!isNavigationFailure(err) && isError(err)) {
      if (this$1.errorCbs.length) {
        this$1.errorCbs.forEach(function (cb) {
          cb(err);
        });
      } else {
        console.error(err);
      }
    }
    onAbort && onAbort(err);
  };
  var lastRouteIndex = route.matched.length - 1;
  var lastCurrentIndex = current.matched.length - 1;
  if (
    isSameRoute(route, current) &&
    // in the case the route map has been dynamically appended to
    lastRouteIndex === lastCurrentIndex &&
    route.matched[lastRouteIndex] === current.matched[lastCurrentIndex]
  ) {
    this.ensureURL();
    return abort(createNavigationDuplicatedError(current, route))
  }

  var ref = resolveQueue(
    this.current.matched,
    route.matched
  );
    var updated = ref.updated;
    var deactivated = ref.deactivated;
    var activated = ref.activated;

  var queue = [].concat(
    // in-component leave guards
    extractLeaveGuards(deactivated),
    // global before hooks
    this.router.beforeHooks,
    // in-component update hooks
    extractUpdateHooks(updated),
    // in-config enter guards
    activated.map(function (m) { return m.beforeEnter; }),
    // async components
    resolveAsyncComponents(activated)
  );

  var iterator = function (hook, next) {
    if (this$1.pending !== route) {
      return abort(createNavigationCancelledError(current, route))
    }
    try {
      hook(route, current, function (to) {
        if (to === false) {
          // next(false) -> abort navigation, ensure current URL
          this$1.ensureURL(true);
          abort(createNavigationAbortedError(current, route));
        } else if (isError(to)) {
          this$1.ensureURL(true);
          abort(to);
        } else if (
          typeof to === 'string' ||
          (typeof to === 'object' &&
            (typeof to.path === 'string' || typeof to.name === 'string'))
        ) {
          // next('/') or next({ path: '/' }) -> redirect
          abort(createNavigationRedirectedError(current, route));
          if (typeof to === 'object' && to.replace) {
            this$1.replace(to);
          } else {
            this$1.push(to);
          }
        } else {
          // confirm transition and pass on the value
          next(to);
        }
      });
    } catch (e) {
      abort(e);
    }
  };

  runQueue(queue, iterator, function () {
    // wait until async components are resolved before
    // extracting in-component enter guards
    var enterGuards = extractEnterGuards(activated);
    var queue = enterGuards.concat(this$1.router.resolveHooks);
    runQueue(queue, iterator, function () {
      if (this$1.pending !== route) {
        return abort(createNavigationCancelledError(current, route))
      }
      this$1.pending = null;
      onComplete(route);
      if (this$1.router.app) {
        this$1.router.app.$nextTick(function () {
          handleRouteEntered(route);
        });
      }
    });
  });
};

History.prototype.updateRoute = function updateRoute (route) {
  this.current = route;
  this.cb && this.cb(route);
};

History.prototype.setupListeners = function setupListeners () {
  // Default implementation is empty
};

History.prototype.teardown = function teardown () {
  // clean up event listeners
  // https://github.com/vuejs/vue-router/issues/2341
  this.listeners.forEach(function (cleanupListener) {
    cleanupListener();
  });
  this.listeners = [];

  // reset current history route
  // https://github.com/vuejs/vue-router/issues/3294
  this.current = START;
  this.pending = null;
};

function normalizeBase (base) {
  if (!base) {
    {
      base = '/';
    }
  }
  // make sure there's the starting slash
  if (base.charAt(0) !== '/') {
    base = '/' + base;
  }
  // remove trailing slash
  return base.replace(/\/$/, '')
}

function resolveQueue (
  current,
  next
) {
  var i;
  var max = Math.max(current.length, next.length);
  for (i = 0; i < max; i++) {
    if (current[i] !== next[i]) {
      break
    }
  }
  return {
    updated: next.slice(0, i),
    activated: next.slice(i),
    deactivated: current.slice(i)
  }
}

function extractGuards (
  records,
  name,
  bind,
  reverse
) {
  var guards = flatMapComponents(records, function (def, instance, match, key) {
    var guard = extractGuard(def, name);
    if (guard) {
      return Array.isArray(guard)
        ? guard.map(function (guard) { return bind(guard, instance, match, key); })
        : bind(guard, instance, match, key)
    }
  });
  return flatten(reverse ? guards.reverse() : guards)
}

function extractGuard (
  def,
  key
) {
  if (typeof def !== 'function') {
    // extend now so that global mixins are applied.
    def = _Vue.extend(def);
  }
  return def.options[key]
}

function extractLeaveGuards (deactivated) {
  return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true)
}

function extractUpdateHooks (updated) {
  return extractGuards(updated, 'beforeRouteUpdate', bindGuard)
}

function bindGuard (guard, instance) {
  if (instance) {
    return function boundRouteGuard () {
      return guard.apply(instance, arguments)
    }
  }
}

function extractEnterGuards (
  activated
) {
  return extractGuards(
    activated,
    'beforeRouteEnter',
    function (guard, _, match, key) {
      return bindEnterGuard(guard, match, key)
    }
  )
}

function bindEnterGuard (
  guard,
  match,
  key
) {
  return function routeEnterGuard (to, from, next) {
    return guard(to, from, function (cb) {
      if (typeof cb === 'function') {
        if (!match.enteredCbs[key]) {
          match.enteredCbs[key] = [];
        }
        match.enteredCbs[key].push(cb);
      }
      next(cb);
    })
  }
}

/*  */

var HTML5History = /*@__PURE__*/(function (History) {
  function HTML5History (router, base) {
    History.call(this, router, base);

    this._startLocation = getLocation(this.base);
  }

  if ( History ) HTML5History.__proto__ = History;
  HTML5History.prototype = Object.create( History && History.prototype );
  HTML5History.prototype.constructor = HTML5History;

  HTML5History.prototype.setupListeners = function setupListeners () {
    var this$1 = this;

    if (this.listeners.length > 0) {
      return
    }

    var router = this.router;
    router.options.scrollBehavior;

    var handleRoutingEvent = function () {
      this$1.current;

      // Avoiding first `popstate` event dispatched in some browsers but first
      // history route not updated since async guard at the same time.
      var location = getLocation(this$1.base);
      if (this$1.current === START && location === this$1._startLocation) {
        return
      }

      this$1.transitionTo(location, function (route) {
      });
    };
    window.addEventListener('popstate', handleRoutingEvent);
    this.listeners.push(function () {
      window.removeEventListener('popstate', handleRoutingEvent);
    });
  };

  HTML5History.prototype.go = function go (n) {
    window.history.go(n);
  };

  HTML5History.prototype.push = function push (location, onComplete, onAbort) {
    var this$1 = this;

    var ref = this;
    var fromRoute = ref.current;
    this.transitionTo(location, function (route) {
      pushState(cleanPath(this$1.base + route.fullPath));
      handleScroll(this$1.router, route, fromRoute, false);
      onComplete && onComplete(route);
    }, onAbort);
  };

  HTML5History.prototype.replace = function replace (location, onComplete, onAbort) {
    var this$1 = this;

    var ref = this;
    var fromRoute = ref.current;
    this.transitionTo(location, function (route) {
      replaceState(cleanPath(this$1.base + route.fullPath));
      handleScroll(this$1.router, route, fromRoute, false);
      onComplete && onComplete(route);
    }, onAbort);
  };

  HTML5History.prototype.ensureURL = function ensureURL (push) {
    if (getLocation(this.base) !== this.current.fullPath) {
      var current = cleanPath(this.base + this.current.fullPath);
      push ? pushState(current) : replaceState(current);
    }
  };

  HTML5History.prototype.getCurrentLocation = function getCurrentLocation () {
    return getLocation(this.base)
  };

  return HTML5History;
}(History));

function getLocation (base) {
  var path = window.location.pathname;
  if (base && path.toLowerCase().indexOf(base.toLowerCase()) === 0) {
    path = path.slice(base.length);
  }
  return (path || '/') + window.location.search + window.location.hash
}

/*  */

var HashHistory = /*@__PURE__*/(function (History) {
  function HashHistory (router, base, fallback) {
    History.call(this, router, base);
    // check history fallback deeplinking
    if (fallback && checkFallback(this.base)) {
      return
    }
    ensureSlash();
  }

  if ( History ) HashHistory.__proto__ = History;
  HashHistory.prototype = Object.create( History && History.prototype );
  HashHistory.prototype.constructor = HashHistory;

  // this is delayed until the app mounts
  // to avoid the hashchange listener being fired too early
  HashHistory.prototype.setupListeners = function setupListeners () {
    var this$1 = this;

    if (this.listeners.length > 0) {
      return
    }

    var router = this.router;
    router.options.scrollBehavior;

    var handleRoutingEvent = function () {
      this$1.current;
      if (!ensureSlash()) {
        return
      }
      this$1.transitionTo(getHash(), function (route) {
        {
          replaceHash(route.fullPath);
        }
      });
    };
    var eventType = 'hashchange';
    window.addEventListener(
      eventType,
      handleRoutingEvent
    );
    this.listeners.push(function () {
      window.removeEventListener(eventType, handleRoutingEvent);
    });
  };

  HashHistory.prototype.push = function push (location, onComplete, onAbort) {
    var this$1 = this;

    var ref = this;
    var fromRoute = ref.current;
    this.transitionTo(
      location,
      function (route) {
        pushHash(route.fullPath);
        handleScroll(this$1.router, route, fromRoute, false);
        onComplete && onComplete(route);
      },
      onAbort
    );
  };

  HashHistory.prototype.replace = function replace (location, onComplete, onAbort) {
    var this$1 = this;

    var ref = this;
    var fromRoute = ref.current;
    this.transitionTo(
      location,
      function (route) {
        replaceHash(route.fullPath);
        handleScroll(this$1.router, route, fromRoute, false);
        onComplete && onComplete(route);
      },
      onAbort
    );
  };

  HashHistory.prototype.go = function go (n) {
    window.history.go(n);
  };

  HashHistory.prototype.ensureURL = function ensureURL (push) {
    var current = this.current.fullPath;
    if (getHash() !== current) {
      push ? pushHash(current) : replaceHash(current);
    }
  };

  HashHistory.prototype.getCurrentLocation = function getCurrentLocation () {
    return getHash()
  };

  return HashHistory;
}(History));

function checkFallback (base) {
  var location = getLocation(base);
  if (!/^\/#/.test(location)) {
    window.location.replace(cleanPath(base + '/#' + location));
    return true
  }
}

function ensureSlash () {
  var path = getHash();
  if (path.charAt(0) === '/') {
    return true
  }
  replaceHash('/' + path);
  return false
}

function getHash () {
  // We can't use window.location.hash here because it's not
  // consistent across browsers - Firefox will pre-decode it!
  var href = window.location.href;
  var index = href.indexOf('#');
  // empty path
  if (index < 0) { return '' }

  href = href.slice(index + 1);

  return href
}

function getUrl (path) {
  var href = window.location.href;
  var i = href.indexOf('#');
  var base = i >= 0 ? href.slice(0, i) : href;
  return (base + "#" + path)
}

function pushHash (path) {
  {
    window.location.hash = path;
  }
}

function replaceHash (path) {
  {
    window.location.replace(getUrl(path));
  }
}

/*  */

var AbstractHistory = /*@__PURE__*/(function (History) {
  function AbstractHistory (router, base) {
    History.call(this, router, base);
    this.stack = [];
    this.index = -1;
  }

  if ( History ) AbstractHistory.__proto__ = History;
  AbstractHistory.prototype = Object.create( History && History.prototype );
  AbstractHistory.prototype.constructor = AbstractHistory;

  AbstractHistory.prototype.push = function push (location, onComplete, onAbort) {
    var this$1 = this;

    this.transitionTo(
      location,
      function (route) {
        this$1.stack = this$1.stack.slice(0, this$1.index + 1).concat(route);
        this$1.index++;
        onComplete && onComplete(route);
      },
      onAbort
    );
  };

  AbstractHistory.prototype.replace = function replace (location, onComplete, onAbort) {
    var this$1 = this;

    this.transitionTo(
      location,
      function (route) {
        this$1.stack = this$1.stack.slice(0, this$1.index).concat(route);
        onComplete && onComplete(route);
      },
      onAbort
    );
  };

  AbstractHistory.prototype.go = function go (n) {
    var this$1 = this;

    var targetIndex = this.index + n;
    if (targetIndex < 0 || targetIndex >= this.stack.length) {
      return
    }
    var route = this.stack[targetIndex];
    this.confirmTransition(
      route,
      function () {
        var prev = this$1.current;
        this$1.index = targetIndex;
        this$1.updateRoute(route);
        this$1.router.afterHooks.forEach(function (hook) {
          hook && hook(route, prev);
        });
      },
      function (err) {
        if (isNavigationFailure(err, NavigationFailureType.duplicated)) {
          this$1.index = targetIndex;
        }
      }
    );
  };

  AbstractHistory.prototype.getCurrentLocation = function getCurrentLocation () {
    var current = this.stack[this.stack.length - 1];
    return current ? current.fullPath : '/'
  };

  AbstractHistory.prototype.ensureURL = function ensureURL () {
    // noop
  };

  return AbstractHistory;
}(History));

/*  */

var VueRouter = function VueRouter (options) {
  if ( options === void 0 ) options = {};

  this.app = null;
  this.apps = [];
  this.options = options;
  this.beforeHooks = [];
  this.resolveHooks = [];
  this.afterHooks = [];
  this.matcher = createMatcher(options.routes || [], this);

  var mode = options.mode || 'hash';
  this.fallback =
    mode === 'history' && !supportsPushState && options.fallback !== false;
  if (this.fallback) {
    mode = 'hash';
  }
  {
    mode = 'abstract';
  }
  this.mode = mode;

  switch (mode) {
    case 'history':
      this.history = new HTML5History(this, options.base);
      break
    case 'hash':
      this.history = new HashHistory(this, options.base, this.fallback);
      break
    case 'abstract':
      this.history = new AbstractHistory(this, options.base);
      break
  }
};

var prototypeAccessors = { currentRoute: { configurable: true } };

VueRouter.prototype.match = function match (raw, current, redirectedFrom) {
  return this.matcher.match(raw, current, redirectedFrom)
};

prototypeAccessors.currentRoute.get = function () {
  return this.history && this.history.current
};

VueRouter.prototype.init = function init (app /* Vue component instance */) {
    var this$1 = this;

  this.apps.push(app);

  // set up app destroyed handler
  // https://github.com/vuejs/vue-router/issues/2639
  app.$once('hook:destroyed', function () {
    // clean out app from this.apps array once destroyed
    var index = this$1.apps.indexOf(app);
    if (index > -1) { this$1.apps.splice(index, 1); }
    // ensure we still have a main app or null if no apps
    // we do not release the router so it can be reused
    if (this$1.app === app) { this$1.app = this$1.apps[0] || null; }

    if (!this$1.app) { this$1.history.teardown(); }
  });

  // main app previously initialized
  // return as we don't need to set up new history listener
  if (this.app) {
    return
  }

  this.app = app;

  var history = this.history;

  if (history instanceof HTML5History || history instanceof HashHistory) {
    var handleInitialScroll = function (routeOrError) {
      history.current;
      this$1.options.scrollBehavior;
    };
    var setupListeners = function (routeOrError) {
      history.setupListeners();
      handleInitialScroll(routeOrError);
    };
    history.transitionTo(
      history.getCurrentLocation(),
      setupListeners,
      setupListeners
    );
  }

  history.listen(function (route) {
    this$1.apps.forEach(function (app) {
      app._route = route;
    });
  });
};

VueRouter.prototype.beforeEach = function beforeEach (fn) {
  return registerHook(this.beforeHooks, fn)
};

VueRouter.prototype.beforeResolve = function beforeResolve (fn) {
  return registerHook(this.resolveHooks, fn)
};

VueRouter.prototype.afterEach = function afterEach (fn) {
  return registerHook(this.afterHooks, fn)
};

VueRouter.prototype.onReady = function onReady (cb, errorCb) {
  this.history.onReady(cb, errorCb);
};

VueRouter.prototype.onError = function onError (errorCb) {
  this.history.onError(errorCb);
};

VueRouter.prototype.push = function push (location, onComplete, onAbort) {
    var this$1 = this;

  // $flow-disable-line
  if (!onComplete && !onAbort && typeof Promise !== 'undefined') {
    return new Promise(function (resolve, reject) {
      this$1.history.push(location, resolve, reject);
    })
  } else {
    this.history.push(location, onComplete, onAbort);
  }
};

VueRouter.prototype.replace = function replace (location, onComplete, onAbort) {
    var this$1 = this;

  // $flow-disable-line
  if (!onComplete && !onAbort && typeof Promise !== 'undefined') {
    return new Promise(function (resolve, reject) {
      this$1.history.replace(location, resolve, reject);
    })
  } else {
    this.history.replace(location, onComplete, onAbort);
  }
};

VueRouter.prototype.go = function go (n) {
  this.history.go(n);
};

VueRouter.prototype.back = function back () {
  this.go(-1);
};

VueRouter.prototype.forward = function forward () {
  this.go(1);
};

VueRouter.prototype.getMatchedComponents = function getMatchedComponents (to) {
  var route = to
    ? to.matched
      ? to
      : this.resolve(to).route
    : this.currentRoute;
  if (!route) {
    return []
  }
  return [].concat.apply(
    [],
    route.matched.map(function (m) {
      return Object.keys(m.components).map(function (key) {
        return m.components[key]
      })
    })
  )
};

VueRouter.prototype.resolve = function resolve (
  to,
  current,
  append
) {
  current = current || this.history.current;
  var location = normalizeLocation(to, current, append, this);
  var route = this.match(location, current);
  var fullPath = route.redirectedFrom || route.fullPath;
  var base = this.history.base;
  var href = createHref(base, fullPath, this.mode);
  return {
    location: location,
    route: route,
    href: href,
    // for backwards compat
    normalizedTo: location,
    resolved: route
  }
};

VueRouter.prototype.getRoutes = function getRoutes () {
  return this.matcher.getRoutes()
};

VueRouter.prototype.addRoute = function addRoute (parentOrRoute, route) {
  this.matcher.addRoute(parentOrRoute, route);
  if (this.history.current !== START) {
    this.history.transitionTo(this.history.getCurrentLocation());
  }
};

VueRouter.prototype.addRoutes = function addRoutes (routes) {
  this.matcher.addRoutes(routes);
  if (this.history.current !== START) {
    this.history.transitionTo(this.history.getCurrentLocation());
  }
};

Object.defineProperties( VueRouter.prototype, prototypeAccessors );

function registerHook (list, fn) {
  list.push(fn);
  return function () {
    var i = list.indexOf(fn);
    if (i > -1) { list.splice(i, 1); }
  }
}

function createHref (base, fullPath, mode) {
  var path = mode === 'hash' ? '#' + fullPath : fullPath;
  return base ? cleanPath(base + '/' + path) : path
}

VueRouter.install = install;
VueRouter.version = '3.5.1';
VueRouter.isNavigationFailure = isNavigationFailure;
VueRouter.NavigationFailureType = NavigationFailureType;
VueRouter.START_LOCATION = START;

var vueRouter_common = VueRouter;

/*!
 * vue-no-ssr v1.1.1
 * (c) 2018-present egoist <0x142857@gmail.com>
 * Released under the MIT License.
 */

var index = {
  name: 'NoSsr',
  functional: true,
  props: {
    placeholder: String,
    placeholderTag: {
      type: String,
      default: 'div'
    }
  },
  render: function render(h, ref) {
    var parent = ref.parent;
    var slots = ref.slots;
    var props = ref.props;

    var ref$1 = slots();
    var defaultSlot = ref$1.default; if ( defaultSlot === void 0 ) defaultSlot = [];
    var placeholderSlot = ref$1.placeholder;

    if (parent._isMounted) {
      return defaultSlot
    }

    parent.$once('hook:mounted', function () {
      parent.$forceUpdate();
    });

    if (props.placeholderTag && (props.placeholder || placeholderSlot)) {
      return h(
        props.placeholderTag,
        {
          class: ['no-ssr-placeholder']
        },
        props.placeholder || placeholderSlot
      )
    }

    // Return a placeholder element for each child in the default slot
    // Or if no children return a single placeholder
    return defaultSlot.length > 0 ? defaultSlot.map(function () { return h(false); }) : h(false)
  }
};

var vueNoSsr_common = index;

/*!
 * vue-client-only v2.0.0
 * (c) 2019-present egoist <0x142857@gmail.com>
 * Released under the MIT License.
 */

var index$1 = {
  name: 'ClientOnly',
  functional: true,
  props: {
    placeholder: String,
    placeholderTag: {
      type: String,
      default: 'div'
    }
  },
  render: function render(h, ref) {
    var parent = ref.parent;
    var slots = ref.slots;
    var props = ref.props;

    var ref$1 = slots();
    var defaultSlot = ref$1.default; if ( defaultSlot === void 0 ) defaultSlot = [];
    var placeholderSlot = ref$1.placeholder;

    if (parent._isMounted) {
      return defaultSlot
    }

    parent.$once('hook:mounted', function () {
      parent.$forceUpdate();
    });

    if (props.placeholderTag && (props.placeholder || placeholderSlot)) {
      return h(
        props.placeholderTag,
        {
          class: ['client-only-placeholder']
        },
        props.placeholder || placeholderSlot
      )
    }

    // Return a placeholder element for each child in the default slot
    // Or if no children return a single placeholder
    return defaultSlot.length > 0 ? defaultSlot.map(function () { return h(false); }) : h(false)
  }
};

var vueClientOnly_common = index$1;

var isMergeableObject = function isMergeableObject(value) {
	return isNonNullObject(value)
		&& !isSpecial(value)
};

function isNonNullObject(value) {
	return !!value && typeof value === 'object'
}

function isSpecial(value) {
	var stringValue = Object.prototype.toString.call(value);

	return stringValue === '[object RegExp]'
		|| stringValue === '[object Date]'
		|| isReactElement(value)
}

// see https://github.com/facebook/react/blob/b5ac963fb791d1298e7f396236383bc955f916c1/src/isomorphic/classic/element/ReactElement.js#L21-L25
var canUseSymbol = typeof Symbol === 'function' && Symbol.for;
var REACT_ELEMENT_TYPE = canUseSymbol ? Symbol.for('react.element') : 0xeac7;

function isReactElement(value) {
	return value.$$typeof === REACT_ELEMENT_TYPE
}

function emptyTarget(val) {
	return Array.isArray(val) ? [] : {}
}

function cloneUnlessOtherwiseSpecified(value, options) {
	return (options.clone !== false && options.isMergeableObject(value))
		? deepmerge(emptyTarget(value), value, options)
		: value
}

function defaultArrayMerge(target, source, options) {
	return target.concat(source).map(function(element) {
		return cloneUnlessOtherwiseSpecified(element, options)
	})
}

function getMergeFunction(key, options) {
	if (!options.customMerge) {
		return deepmerge
	}
	var customMerge = options.customMerge(key);
	return typeof customMerge === 'function' ? customMerge : deepmerge
}

function getEnumerableOwnPropertySymbols(target) {
	return Object.getOwnPropertySymbols
		? Object.getOwnPropertySymbols(target).filter(function(symbol) {
			return target.propertyIsEnumerable(symbol)
		})
		: []
}

function getKeys(target) {
	return Object.keys(target).concat(getEnumerableOwnPropertySymbols(target))
}

function propertyIsOnObject(object, property) {
	try {
		return property in object
	} catch(_) {
		return false
	}
}

// Protects from prototype poisoning and unexpected merging up the prototype chain.
function propertyIsUnsafe(target, key) {
	return propertyIsOnObject(target, key) // Properties are safe to merge if they don't exist in the target yet,
		&& !(Object.hasOwnProperty.call(target, key) // unsafe if they exist up the prototype chain,
			&& Object.propertyIsEnumerable.call(target, key)) // and also unsafe if they're nonenumerable.
}

function mergeObject(target, source, options) {
	var destination = {};
	if (options.isMergeableObject(target)) {
		getKeys(target).forEach(function(key) {
			destination[key] = cloneUnlessOtherwiseSpecified(target[key], options);
		});
	}
	getKeys(source).forEach(function(key) {
		if (propertyIsUnsafe(target, key)) {
			return
		}

		if (propertyIsOnObject(target, key) && options.isMergeableObject(source[key])) {
			destination[key] = getMergeFunction(key, options)(target[key], source[key], options);
		} else {
			destination[key] = cloneUnlessOtherwiseSpecified(source[key], options);
		}
	});
	return destination
}

function deepmerge(target, source, options) {
	options = options || {};
	options.arrayMerge = options.arrayMerge || defaultArrayMerge;
	options.isMergeableObject = options.isMergeableObject || isMergeableObject;
	// cloneUnlessOtherwiseSpecified is added to `options` so that custom arrayMerge()
	// implementations can use it. The caller may not replace it.
	options.cloneUnlessOtherwiseSpecified = cloneUnlessOtherwiseSpecified;

	var sourceIsArray = Array.isArray(source);
	var targetIsArray = Array.isArray(target);
	var sourceAndTargetTypesMatch = sourceIsArray === targetIsArray;

	if (!sourceAndTargetTypesMatch) {
		return cloneUnlessOtherwiseSpecified(source, options)
	} else if (sourceIsArray) {
		return options.arrayMerge(target, source, options)
	} else {
		return mergeObject(target, source, options)
	}
}

deepmerge.all = function deepmergeAll(array, options) {
	if (!Array.isArray(array)) {
		throw new Error('first argument should be an array')
	}

	return array.reduce(function(prev, next) {
		return deepmerge(prev, next, options)
	}, {})
};

var deepmerge_1 = deepmerge;

var cjs = deepmerge_1;

/**
 * vue-meta v2.4.0
 * (c) 2020
 * - Declan de Wet
 * - Sébastien Chopin (@Atinux)
 * - Pim (@pimlie)
 * - All the amazing contributors
 * @license MIT
 */

function _interopDefault$1 (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var deepmerge$1 = _interopDefault$1(cjs);

var version = "2.4.0";

function _typeof(obj) {
  "@babel/helpers - typeof";

  if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
    _typeof = function (obj) {
      return typeof obj;
    };
  } else {
    _typeof = function (obj) {
      return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
    };
  }

  return _typeof(obj);
}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    });
    keys.push.apply(keys, symbols);
  }

  return keys;
}

function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};

    if (i % 2) {
      ownKeys(Object(source), true).forEach(function (key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys(Object(source)).forEach(function (key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }

  return target;
}

function _toConsumableArray(arr) {
  return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread();
}

function _arrayWithoutHoles(arr) {
  if (Array.isArray(arr)) return _arrayLikeToArray(arr);
}

function _iterableToArray(iter) {
  if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter);
}

function _unsupportedIterableToArray(o, minLen) {
  if (!o) return;
  if (typeof o === "string") return _arrayLikeToArray(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor) n = o.constructor.name;
  if (n === "Map" || n === "Set") return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
}

function _arrayLikeToArray(arr, len) {
  if (len == null || len > arr.length) len = arr.length;

  for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];

  return arr2;
}

function _nonIterableSpread() {
  throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}

function _createForOfIteratorHelper(o, allowArrayLike) {
  var it;

  if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) {
    if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") {
      if (it) o = it;
      var i = 0;

      var F = function () {};

      return {
        s: F,
        n: function () {
          if (i >= o.length) return {
            done: true
          };
          return {
            done: false,
            value: o[i++]
          };
        },
        e: function (e) {
          throw e;
        },
        f: F
      };
    }

    throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }

  var normalCompletion = true,
      didErr = false,
      err;
  return {
    s: function () {
      it = o[Symbol.iterator]();
    },
    n: function () {
      var step = it.next();
      normalCompletion = step.done;
      return step;
    },
    e: function (e) {
      didErr = true;
      err = e;
    },
    f: function () {
      try {
        if (!normalCompletion && it.return != null) it.return();
      } finally {
        if (didErr) throw err;
      }
    }
  };
}

/**
 * checks if passed argument is an array
 * @param  {any}  arg - the object to check
 * @return {Boolean} - true if `arg` is an array
 */
function isArray(arg) {
  return Array.isArray(arg);
}
function isUndefined(arg) {
  return typeof arg === 'undefined';
}
function isObject(arg) {
  return _typeof(arg) === 'object';
}
function isPureObject(arg) {
  return _typeof(arg) === 'object' && arg !== null;
}
function isFunction(arg) {
  return typeof arg === 'function';
}
function isString(arg) {
  return typeof arg === 'string';
}

function hasGlobalWindowFn() {
  try {
    return !isUndefined(window);
  } catch (e) {
    return false;
  }
}
var hasGlobalWindow = hasGlobalWindowFn();

var _global = hasGlobalWindow ? window : server$1.commonjsGlobal;

var console$1 = _global.console || {};
function warn(str) {
  /* istanbul ignore next */
  if (!console$1 || !console$1.warn) {
    return;
  }

  console$1.warn(str);
}
var showWarningNotSupported = function showWarningNotSupported() {
  return warn('This vue app/component has no vue-meta configuration');
};

/**
 * These are constant variables used throughout the application.
 */
// set some sane defaults
var defaultInfo = {
  title: undefined,
  titleChunk: '',
  titleTemplate: '%s',
  htmlAttrs: {},
  bodyAttrs: {},
  headAttrs: {},
  base: [],
  link: [],
  meta: [],
  style: [],
  script: [],
  noscript: [],
  __dangerouslyDisableSanitizers: [],
  __dangerouslyDisableSanitizersByTagID: {}
};
var rootConfigKey = '_vueMeta'; // This is the name of the component option that contains all the information that
// gets converted to the various meta tags & attributes for the page.

var keyName = 'metaInfo'; // This is the attribute vue-meta arguments on elements to know which it should
// manage and which it should ignore.

var attribute = 'data-vue-meta'; // This is the attribute that goes on the `html` tag to inform `vue-meta`
// that the server has already generated the meta tags for the initial render.

var ssrAttribute = 'data-vue-meta-server-rendered'; // This is the property that tells vue-meta to overwrite (instead of append)
// an item in a tag list. For example, if you have two `meta` tag list items
// that both have `vmid` of "description", then vue-meta will overwrite the
// shallowest one with the deepest one.

var tagIDKeyName = 'vmid'; // This is the key name for possible meta templates

var metaTemplateKeyName = 'template'; // This is the key name for the content-holding property

var contentKeyName = 'content'; // The id used for the ssr app

var ssrAppId = 'ssr'; // How long meta update

var debounceWait = 10; // How long meta update

var waitOnDestroyed = true;
var defaultOptions = {
  keyName: keyName,
  attribute: attribute,
  ssrAttribute: ssrAttribute,
  tagIDKeyName: tagIDKeyName,
  contentKeyName: contentKeyName,
  metaTemplateKeyName: metaTemplateKeyName,
  waitOnDestroyed: waitOnDestroyed,
  debounceWait: debounceWait,
  ssrAppId: ssrAppId
}; // might be a bit ugly, but minimizes the browser bundles a bit

var defaultInfoKeys = Object.keys(defaultInfo); // The metaInfo property keys which are used to disable escaping

var disableOptionKeys = [defaultInfoKeys[12], defaultInfoKeys[13]]; // List of metaInfo property keys which are configuration options (and dont generate html)

var metaInfoOptionKeys = [defaultInfoKeys[1], defaultInfoKeys[2], 'changed'].concat(disableOptionKeys); // List of metaInfo property keys which only generates attributes and no tags

var metaInfoAttributeKeys = [defaultInfoKeys[3], defaultInfoKeys[4], defaultInfoKeys[5]]; // HTML elements which support the onload event

var tagsSupportingOnload = ['link', 'style', 'script']; // HTML elements which dont have a head tag (shortened to our needs)
// see: https://www.w3.org/TR/html52/document-metadata.html

var tagsWithoutEndTag = ['base', 'meta', 'link']; // HTML elements which can have inner content (shortened to our needs)

var tagsWithInnerContent = ['noscript', 'script', 'style']; // Attributes which are inserted as childNodes instead of HTMLAttribute

var tagAttributeAsInnerContent = ['innerHTML', 'cssText', 'json'];
var tagProperties = ['once', 'skip', 'template']; // Attributes which should be added with data- prefix

var commonDataAttributes = ['body', 'pbody']; // from: https://github.com/kangax/html-minifier/blob/gh-pages/src/htmlminifier.js#L202

var booleanHtmlAttributes = ['allowfullscreen', 'amp', 'amp-boilerplate', 'async', 'autofocus', 'autoplay', 'checked', 'compact', 'controls', 'declare', 'default', 'defaultchecked', 'defaultmuted', 'defaultselected', 'defer', 'disabled', 'enabled', 'formnovalidate', 'hidden', 'indeterminate', 'inert', 'ismap', 'itemscope', 'loop', 'multiple', 'muted', 'nohref', 'noresize', 'noshade', 'novalidate', 'nowrap', 'open', 'pauseonexit', 'readonly', 'required', 'reversed', 'scoped', 'seamless', 'selected', 'sortable', 'truespeed', 'typemustmatch', 'visible'];

var batchId = null;
function triggerUpdate(_ref, rootVm, hookName) {
  var debounceWait = _ref.debounceWait;

  // if an update was triggered during initialization or when an update was triggered by the
  // metaInfo watcher, set initialized to null
  // then we keep falsy value but know we need to run a triggerUpdate after initialization
  if (!rootVm[rootConfigKey].initialized && (rootVm[rootConfigKey].initializing || hookName === 'watcher')) {
    rootVm[rootConfigKey].initialized = null;
  }

  if (rootVm[rootConfigKey].initialized && !rootVm[rootConfigKey].pausing) {
    // batch potential DOM updates to prevent extraneous re-rendering
    // eslint-disable-next-line no-void
    batchUpdate(function () {
      return void rootVm.$meta().refresh();
    }, debounceWait);
  }
}
/**
 * Performs a batched update.
 *
 * @param  {(null|Number)} id - the ID of this update
 * @param  {Function} callback - the update to perform
 * @return {Number} id - a new ID
 */

function batchUpdate(callback, timeout) {
  timeout = timeout === undefined ? 10 : timeout;

  if (!timeout) {
    callback();
    return;
  }

  clearTimeout(batchId);
  batchId = setTimeout(function () {
    callback();
  }, timeout);
  return batchId;
}

/*
 * To reduce build size, this file provides simple polyfills without
 * overly excessive type checking and without modifying
 * the global Array.prototype
 * The polyfills are automatically removed in the commonjs build
 * Also, only files in client/ & shared/ should use these functions
 * files in server/ still use normal js function
 */
function find(array, predicate, thisArg) {
  if ( !Array.prototype.find) {
    // idx needs to be a Number, for..in returns string
    for (var idx = 0; idx < array.length; idx++) {
      if (predicate.call(thisArg, array[idx], idx, array)) {
        return array[idx];
      }
    }

    return;
  }

  return array.find(predicate, thisArg);
}
function findIndex(array, predicate, thisArg) {
  if ( !Array.prototype.findIndex) {
    // idx needs to be a Number, for..in returns string
    for (var idx = 0; idx < array.length; idx++) {
      if (predicate.call(thisArg, array[idx], idx, array)) {
        return idx;
      }
    }

    return -1;
  }

  return array.findIndex(predicate, thisArg);
}
function toArray(arg) {
  if ( !Array.from) {
    return Array.prototype.slice.call(arg);
  }

  return Array.from(arg);
}
function includes(array, value) {
  if ( !Array.prototype.includes) {
    for (var idx in array) {
      if (array[idx] === value) {
        return true;
      }
    }

    return false;
  }

  return array.includes(value);
}

var querySelector = function querySelector(arg, el) {
  return (el || document).querySelectorAll(arg);
};
function getTag(tags, tag) {
  if (!tags[tag]) {
    tags[tag] = document.getElementsByTagName(tag)[0];
  }

  return tags[tag];
}
function getElementsKey(_ref) {
  var body = _ref.body,
      pbody = _ref.pbody;
  return body ? 'body' : pbody ? 'pbody' : 'head';
}
function queryElements(parentNode, _ref2, attributes) {
  var appId = _ref2.appId,
      attribute = _ref2.attribute,
      type = _ref2.type,
      tagIDKeyName = _ref2.tagIDKeyName;
  attributes = attributes || {};
  var queries = ["".concat(type, "[").concat(attribute, "=\"").concat(appId, "\"]"), "".concat(type, "[data-").concat(tagIDKeyName, "]")].map(function (query) {
    for (var key in attributes) {
      var val = attributes[key];
      var attributeValue = val && val !== true ? "=\"".concat(val, "\"") : '';
      query += "[data-".concat(key).concat(attributeValue, "]");
    }

    return query;
  });
  return toArray(querySelector(queries.join(', '), parentNode));
}
function removeElementsByAppId(_ref3, appId) {
  var attribute = _ref3.attribute;
  toArray(querySelector("[".concat(attribute, "=\"").concat(appId, "\"]"))).map(function (el) {
    return el.remove();
  });
}
function removeAttribute(el, attributeName) {
  el.removeAttribute(attributeName);
}

function hasMetaInfo(vm) {
  vm = vm || this;
  return vm && (vm[rootConfigKey] === true || isObject(vm[rootConfigKey]));
} // a component is in a metaInfo branch when itself has meta info or one of its (grand-)children has

function inMetaInfoBranch(vm) {
  vm = vm || this;
  return vm && !isUndefined(vm[rootConfigKey]);
}

function pause(rootVm, refresh) {
  rootVm[rootConfigKey].pausing = true;
  return function () {
    return resume(rootVm, refresh);
  };
}
function resume(rootVm, refresh) {
  rootVm[rootConfigKey].pausing = false;

  if (refresh || refresh === undefined) {
    return rootVm.$meta().refresh();
  }
}

function addNavGuards(rootVm) {
  var router = rootVm.$router; // return when nav guards already added or no router exists

  if (rootVm[rootConfigKey].navGuards || !router) {
    /* istanbul ignore next */
    return;
  }

  rootVm[rootConfigKey].navGuards = true;
  router.beforeEach(function (to, from, next) {
    pause(rootVm);
    next();
  });
  router.afterEach(function () {
    rootVm.$nextTick(function () {
      var _resume = resume(rootVm),
          metaInfo = _resume.metaInfo;

      if (metaInfo && isFunction(metaInfo.afterNavigation)) {
        metaInfo.afterNavigation(metaInfo);
      }
    });
  });
}

var appId = 1;
function createMixin(Vue, options) {
  // for which Vue lifecycle hooks should the metaInfo be refreshed
  var updateOnLifecycleHook = ['activated', 'deactivated', 'beforeMount'];
  var wasServerRendered = false; // watch for client side component updates

  return {
    beforeCreate: function beforeCreate() {
      var _this2 = this;

      var rootKey = '$root';
      var $root = this[rootKey];
      var $options = this.$options;
      var devtoolsEnabled = Vue.config.devtools;
      Object.defineProperty(this, '_hasMetaInfo', {
        configurable: true,
        get: function get() {
          // Show deprecation warning once when devtools enabled
          if (devtoolsEnabled && !$root[rootConfigKey].deprecationWarningShown) {
            warn('VueMeta DeprecationWarning: _hasMetaInfo has been deprecated and will be removed in a future version. Please use hasMetaInfo(vm) instead');
            $root[rootConfigKey].deprecationWarningShown = true;
          }

          return hasMetaInfo(this);
        }
      });

      if (this === $root) {
        $root.$once('hook:beforeMount', function () {
          wasServerRendered = this.$el && this.$el.nodeType === 1 && this.$el.hasAttribute('data-server-rendered'); // In most cases when you have a SSR app it will be the first app thats gonna be
          // initiated, if we cant detect the data-server-rendered attribute from Vue but we
          // do see our own ssrAttribute then _assume_ the Vue app with appId 1 is the ssr app
          // attempted fix for #404 & #562, but we rly need to refactor how we pass appIds from
          // ssr to the client

          if (!wasServerRendered && $root[rootConfigKey] && $root[rootConfigKey].appId === 1) {
            var htmlTag = getTag({}, 'html');
            wasServerRendered = htmlTag && htmlTag.hasAttribute(options.ssrAttribute);
          }
        });
      } // Add a marker to know if it uses metaInfo
      // _vnode is used to know that it's attached to a real component
      // useful if we use some mixin to add some meta tags (like nuxt-i18n)


      if (isUndefined($options[options.keyName]) || $options[options.keyName] === null) {
        return;
      }

      if (!$root[rootConfigKey]) {
        $root[rootConfigKey] = {
          appId: appId
        };
        appId++;

        if (devtoolsEnabled && $root.$options[options.keyName]) {
          // use nextTick so the children should be added to $root
          this.$nextTick(function () {
            // find the first child that lists fnOptions
            var child = find($root.$children, function (c) {
              return c.$vnode && c.$vnode.fnOptions;
            });

            if (child && child.$vnode.fnOptions[options.keyName]) {
              warn("VueMeta has detected a possible global mixin which adds a ".concat(options.keyName, " property to all Vue components on the page. This could cause severe performance issues. If possible, use $meta().addApp to add meta information instead"));
            }
          });
        }
      } // to speed up updates we keep track of branches which have a component with vue-meta info defined
      // if _vueMeta = true it has info, if _vueMeta = false a child has info


      if (!this[rootConfigKey]) {
        this[rootConfigKey] = true;
        var parent = this.$parent;

        while (parent && parent !== $root) {
          if (isUndefined(parent[rootConfigKey])) {
            parent[rootConfigKey] = false;
          }

          parent = parent.$parent;
        }
      } // coerce function-style metaInfo to a computed prop so we can observe
      // it on creation


      if (isFunction($options[options.keyName])) {
        $options.computed = $options.computed || {};
        $options.computed.$metaInfo = $options[options.keyName];

        if (!this.$isServer) {
          // if computed $metaInfo exists, watch it for updates & trigger a refresh
          // when it changes (i.e. automatically handle async actions that affect metaInfo)
          // credit for this suggestion goes to [Sébastien Chopin](https://github.com/Atinux)
          this.$on('hook:created', function () {
            this.$watch('$metaInfo', function () {
              triggerUpdate(options, this[rootKey], 'watcher');
            });
          });
        }
      } // force an initial refresh on page load and prevent other lifecycleHooks
      // to triggerUpdate until this initial refresh is finished
      // this is to make sure that when a page is opened in an inactive tab which
      // has throttled rAF/timers we still immediately set the page title


      if (isUndefined($root[rootConfigKey].initialized)) {
        $root[rootConfigKey].initialized = this.$isServer;

        if (!$root[rootConfigKey].initialized) {
          if (!$root[rootConfigKey].initializedSsr) {
            $root[rootConfigKey].initializedSsr = true;
            this.$on('hook:beforeMount', function () {
              var $root = this[rootKey]; // if this Vue-app was server rendered, set the appId to 'ssr'
              // only one SSR app per page is supported

              if (wasServerRendered) {
                $root[rootConfigKey].appId = options.ssrAppId;
              }
            });
          } // we use the mounted hook here as on page load


          this.$on('hook:mounted', function () {
            var $root = this[rootKey];

            if ($root[rootConfigKey].initialized) {
              return;
            } // used in triggerUpdate to check if a change was triggered
            // during initialization


            $root[rootConfigKey].initializing = true; // refresh meta in nextTick so all child components have loaded

            this.$nextTick(function () {
              var _$root$$meta$refresh = $root.$meta().refresh(),
                  tags = _$root$$meta$refresh.tags,
                  metaInfo = _$root$$meta$refresh.metaInfo; // After ssr hydration (identifier by tags === false) check
              // if initialized was set to null in triggerUpdate. That'd mean
              // that during initilazation changes where triggered which need
              // to be applied OR a metaInfo watcher was triggered before the
              // current hook was called
              // (during initialization all changes are blocked)


              if (tags === false && $root[rootConfigKey].initialized === null) {
                this.$nextTick(function () {
                  return triggerUpdate(options, $root, 'init');
                });
              }

              $root[rootConfigKey].initialized = true;
              delete $root[rootConfigKey].initializing; // add the navigation guards if they havent been added yet
              // they are needed for the afterNavigation callback

              if (!options.refreshOnceOnNavigation && metaInfo.afterNavigation) {
                addNavGuards($root);
              }
            });
          }); // add the navigation guards if requested

          if (options.refreshOnceOnNavigation) {
            addNavGuards($root);
          }
        }
      }

      this.$on('hook:destroyed', function () {
        var _this = this;

        // do not trigger refresh:
        // - when user configured to not wait for transitions on destroyed
        // - when the component doesnt have a parent
        // - doesnt have metaInfo defined
        if (!this.$parent || !hasMetaInfo(this)) {
          return;
        }

        delete this._hasMetaInfo;
        this.$nextTick(function () {
          if (!options.waitOnDestroyed || !_this.$el || !_this.$el.offsetParent) {
            triggerUpdate(options, _this.$root, 'destroyed');
            return;
          } // Wait that element is hidden before refreshing meta tags (to support animations)


          var interval = setInterval(function () {
            if (_this.$el && _this.$el.offsetParent !== null) {
              /* istanbul ignore next line */
              return;
            }

            clearInterval(interval);
            triggerUpdate(options, _this.$root, 'destroyed');
          }, 50);
        });
      }); // do not trigger refresh on the server side

      if (this.$isServer) {
        /* istanbul ignore next */
        return;
      } // no need to add this hooks on server side


      updateOnLifecycleHook.forEach(function (lifecycleHook) {
        _this2.$on("hook:".concat(lifecycleHook), function () {
          triggerUpdate(options, this[rootKey], lifecycleHook);
        });
      });
    }
  };
}

function setOptions(options) {
  // combine options
  options = isObject(options) ? options : {}; // The options are set like this so they can
  // be minified by terser while keeping the
  // user api intact
  // terser --mangle-properties keep_quoted=strict

  /* eslint-disable dot-notation */

  return {
    keyName: options['keyName'] || defaultOptions.keyName,
    attribute: options['attribute'] || defaultOptions.attribute,
    ssrAttribute: options['ssrAttribute'] || defaultOptions.ssrAttribute,
    tagIDKeyName: options['tagIDKeyName'] || defaultOptions.tagIDKeyName,
    contentKeyName: options['contentKeyName'] || defaultOptions.contentKeyName,
    metaTemplateKeyName: options['metaTemplateKeyName'] || defaultOptions.metaTemplateKeyName,
    debounceWait: isUndefined(options['debounceWait']) ? defaultOptions.debounceWait : options['debounceWait'],
    waitOnDestroyed: isUndefined(options['waitOnDestroyed']) ? defaultOptions.waitOnDestroyed : options['waitOnDestroyed'],
    ssrAppId: options['ssrAppId'] || defaultOptions.ssrAppId,
    refreshOnceOnNavigation: !!options['refreshOnceOnNavigation']
  };
  /* eslint-enable dot-notation */
}
function getOptions(options) {
  var optionsCopy = {};

  for (var key in options) {
    optionsCopy[key] = options[key];
  }

  return optionsCopy;
}

function ensureIsArray(arg, key) {
  if (!key || !isObject(arg)) {
    return isArray(arg) ? arg : [];
  }

  if (!isArray(arg[key])) {
    arg[key] = [];
  }

  return arg;
}

var serverSequences = [[/&/g, '&amp;'], [/</g, '&lt;'], [/>/g, '&gt;'], [/"/g, '&quot;'], [/'/g, '&#x27;']];
var clientSequences = [[/&/g, "&"], [/</g, "<"], [/>/g, ">"], [/"/g, "\""], [/'/g, "'"]]; // sanitizes potentially dangerous characters

function escape(info, options, escapeOptions, escapeKeys) {
  var tagIDKeyName = options.tagIDKeyName;
  var _escapeOptions$doEsca = escapeOptions.doEscape,
      doEscape = _escapeOptions$doEsca === void 0 ? function (v) {
    return v;
  } : _escapeOptions$doEsca;
  var escaped = {};

  for (var key in info) {
    var value = info[key]; // no need to escape configuration options

    if (includes(metaInfoOptionKeys, key)) {
      escaped[key] = value;
      continue;
    } // do not use destructuring for disableOptionKeys, it increases transpiled size
    // due to var checks while we are guaranteed the structure of the cb


    var disableKey = disableOptionKeys[0];

    if (escapeOptions[disableKey] && includes(escapeOptions[disableKey], key)) {
      // this info[key] doesnt need to escaped if the option is listed in __dangerouslyDisableSanitizers
      escaped[key] = value;
      continue;
    }

    var tagId = info[tagIDKeyName];

    if (tagId) {
      disableKey = disableOptionKeys[1]; // keys which are listed in __dangerouslyDisableSanitizersByTagID for the current vmid do not need to be escaped

      if (escapeOptions[disableKey] && escapeOptions[disableKey][tagId] && includes(escapeOptions[disableKey][tagId], key)) {
        escaped[key] = value;
        continue;
      }
    }

    if (isString(value)) {
      escaped[key] = doEscape(value);
    } else if (isArray(value)) {
      escaped[key] = value.map(function (v) {
        if (isPureObject(v)) {
          return escape(v, options, escapeOptions, true);
        }

        return doEscape(v);
      });
    } else if (isPureObject(value)) {
      escaped[key] = escape(value, options, escapeOptions, true);
    } else {
      escaped[key] = value;
    }

    if (escapeKeys) {
      var escapedKey = doEscape(key);

      if (key !== escapedKey) {
        escaped[escapedKey] = escaped[key];
        delete escaped[key];
      }
    }
  }

  return escaped;
}
function escapeMetaInfo(options, info, escapeSequences) {
  escapeSequences = escapeSequences || []; // do not use destructuring for seq, it increases transpiled size
  // due to var checks while we are guaranteed the structure of the cb

  var escapeOptions = {
    doEscape: function doEscape(value) {
      return escapeSequences.reduce(function (val, seq) {
        return val.replace(seq[0], seq[1]);
      }, value);
    }
  };
  disableOptionKeys.forEach(function (disableKey, index) {
    if (index === 0) {
      ensureIsArray(info, disableKey);
    } else if (index === 1) {
      for (var key in info[disableKey]) {
        ensureIsArray(info[disableKey], key);
      }
    }

    escapeOptions[disableKey] = info[disableKey];
  }); // begin sanitization

  return escape(info, options, escapeOptions);
}

function applyTemplate(_ref, headObject, template, chunk) {
  var component = _ref.component,
      metaTemplateKeyName = _ref.metaTemplateKeyName,
      contentKeyName = _ref.contentKeyName;

  if (template === true || headObject[metaTemplateKeyName] === true) {
    // abort, template was already applied
    return false;
  }

  if (isUndefined(template) && headObject[metaTemplateKeyName]) {
    template = headObject[metaTemplateKeyName];
    headObject[metaTemplateKeyName] = true;
  } // return early if no template defined


  if (!template) {
    // cleanup faulty template properties
    delete headObject[metaTemplateKeyName];
    return false;
  }

  if (isUndefined(chunk)) {
    chunk = headObject[contentKeyName];
  }

  headObject[contentKeyName] = isFunction(template) ? template.call(component, chunk) : template.replace(/%s/g, chunk);
  return true;
}

function _arrayMerge(_ref, target, source) {
  var component = _ref.component,
      tagIDKeyName = _ref.tagIDKeyName,
      metaTemplateKeyName = _ref.metaTemplateKeyName,
      contentKeyName = _ref.contentKeyName;
  // we concat the arrays without merging objects contained in,
  // but we check for a `vmid` property on each object in the array
  // using an O(1) lookup associative array exploit
  var destination = [];

  if (!target.length && !source.length) {
    return destination;
  }

  target.forEach(function (targetItem, targetIndex) {
    // no tagID so no need to check for duplicity
    if (!targetItem[tagIDKeyName]) {
      destination.push(targetItem);
      return;
    }

    var sourceIndex = findIndex(source, function (item) {
      return item[tagIDKeyName] === targetItem[tagIDKeyName];
    });
    var sourceItem = source[sourceIndex]; // source doesnt contain any duplicate vmid's, we can keep targetItem

    if (sourceIndex === -1) {
      destination.push(targetItem);
      return;
    } // when sourceItem explictly defines contentKeyName or innerHTML as undefined, its
    // an indication that we need to skip the default behaviour or child has preference over parent
    // which means we keep the targetItem and ignore/remove the sourceItem


    if (contentKeyName in sourceItem && sourceItem[contentKeyName] === undefined || 'innerHTML' in sourceItem && sourceItem.innerHTML === undefined) {
      destination.push(targetItem); // remove current index from source array so its not concatenated to destination below

      source.splice(sourceIndex, 1);
      return;
    } // we now know that targetItem is a duplicate and we should ignore it in favor of sourceItem
    // if source specifies null as content then ignore both the target as the source


    if (sourceItem[contentKeyName] === null || sourceItem.innerHTML === null) {
      // remove current index from source array so its not concatenated to destination below
      source.splice(sourceIndex, 1);
      return;
    } // now we only need to check if the target has a template to combine it with the source


    var targetTemplate = targetItem[metaTemplateKeyName];

    if (!targetTemplate) {
      return;
    }

    var sourceTemplate = sourceItem[metaTemplateKeyName];

    if (!sourceTemplate) {
      // use parent template and child content
      applyTemplate({
        component: component,
        metaTemplateKeyName: metaTemplateKeyName,
        contentKeyName: contentKeyName
      }, sourceItem, targetTemplate); // set template to true to indicate template was already applied

      sourceItem.template = true;
      return;
    }

    if (!sourceItem[contentKeyName]) {
      // use parent content and child template
      applyTemplate({
        component: component,
        metaTemplateKeyName: metaTemplateKeyName,
        contentKeyName: contentKeyName
      }, sourceItem, undefined, targetItem[contentKeyName]);
    }
  });
  return destination.concat(source);
}
var warningShown = false;
function merge(target, source, options) {
  options = options || {}; // remove properties explicitly set to false so child components can
  // optionally _not_ overwrite the parents content
  // (for array properties this is checked in arrayMerge)

  if (source.title === undefined) {
    delete source.title;
  }

  metaInfoAttributeKeys.forEach(function (attrKey) {
    if (!source[attrKey]) {
      return;
    }

    for (var key in source[attrKey]) {
      if (key in source[attrKey] && source[attrKey][key] === undefined) {
        if (includes(booleanHtmlAttributes, key) && !warningShown) {
          warn('VueMeta: Please note that since v2 the value undefined is not used to indicate boolean attributes anymore, see migration guide for details');
          warningShown = true;
        }

        delete source[attrKey][key];
      }
    }
  });
  return deepmerge$1(target, source, {
    arrayMerge: function arrayMerge(t, s) {
      return _arrayMerge(options, t, s);
    }
  });
}

function getComponentMetaInfo(options, component) {
  return getComponentOption(options || {}, component, defaultInfo);
}
/**
 * Returns the `opts.option` $option value of the given `opts.component`.
 * If methods are encountered, they will be bound to the component context.
 * If `opts.deep` is true, will recursively merge all child component
 * `opts.option` $option values into the returned result.
 *
 * @param  {Object} opts - options
 * @param  {Object} opts.component - Vue component to fetch option data from
 * @param  {Boolean} opts.deep - look for data in child components as well?
 * @param  {Function} opts.arrayMerge - how should arrays be merged?
 * @param  {String} opts.keyName - the name of the option to look for
 * @param  {Object} [result={}] - result so far
 * @return {Object} result - final aggregated result
 */

function getComponentOption(options, component, result) {
  result = result || {};

  if (component._inactive) {
    return result;
  }

  options = options || {};
  var _options = options,
      keyName = _options.keyName;
  var $metaInfo = component.$metaInfo,
      $options = component.$options,
      $children = component.$children; // only collect option data if it exists

  if ($options[keyName]) {
    // if $metaInfo exists then [keyName] was defined as a function
    // and set to the computed prop $metaInfo in the mixin
    // using the computed prop should be a small performance increase
    // because Vue caches those internally
    var data = $metaInfo || $options[keyName]; // only merge data with result when its an object
    // eg it could be a function when metaInfo() returns undefined
    // dueo to the or statement above

    if (isObject(data)) {
      result = merge(result, data, options);
    }
  } // collect & aggregate child options if deep = true


  if ($children.length) {
    $children.forEach(function (childComponent) {
      // check if the childComponent is in a branch
      // return otherwise so we dont walk all component branches unnecessarily
      if (!inMetaInfoBranch(childComponent)) {
        return;
      }

      result = getComponentOption(options, childComponent, result);
    });
  }

  return result;
}

var callbacks = [];
function isDOMComplete(d) {
  return (d || document).readyState === 'complete';
}
function addCallback(query, callback) {
  if (arguments.length === 1) {
    callback = query;
    query = '';
  }

  callbacks.push([query, callback]);
}
function addCallbacks(_ref, type, tags, autoAddListeners) {
  var tagIDKeyName = _ref.tagIDKeyName;
  var hasAsyncCallback = false;
  tags.forEach(function (tag) {
    if (!tag[tagIDKeyName] || !tag.callback) {
      return;
    }

    hasAsyncCallback = true;
    addCallback("".concat(type, "[data-").concat(tagIDKeyName, "=\"").concat(tag[tagIDKeyName], "\"]"), tag.callback);
  });

  if (!autoAddListeners || !hasAsyncCallback) {
    return hasAsyncCallback;
  }

  return addListeners();
}
function addListeners() {
  if (isDOMComplete()) {
    applyCallbacks();
    return;
  } // Instead of using a MutationObserver, we just apply

  /* istanbul ignore next */


  document.onreadystatechange = function () {
    applyCallbacks();
  };
}
function applyCallbacks(matchElement) {
  callbacks.forEach(function (args) {
    // do not use destructuring for args, it increases transpiled size
    // due to var checks while we are guaranteed the structure of the cb
    var query = args[0];
    var callback = args[1];
    var selector = "".concat(query, "[onload=\"this.__vm_l=1\"]");
    var elements = [];

    if (!matchElement) {
      elements = toArray(querySelector(selector));
    }

    if (matchElement && matchElement.matches(selector)) {
      elements = [matchElement];
    }

    elements.forEach(function (element) {
      /* __vm_cb: whether the load callback has been called
       * __vm_l: set by onload attribute, whether the element was loaded
       * __vm_ev: whether the event listener was added or not
       */
      if (element.__vm_cb) {
        return;
      }

      var onload = function onload() {
        /* Mark that the callback for this element has already been called,
         * this prevents the callback to run twice in some (rare) conditions
         */
        element.__vm_cb = true;
        /* onload needs to be removed because we only need the
         * attribute after ssr and if we dont remove it the node
         * will fail isEqualNode on the client
         */

        removeAttribute(element, 'onload');
        callback(element);
      };
      /* IE9 doesnt seem to load scripts synchronously,
       * causing a script sometimes/often already to be loaded
       * when we add the event listener below (thus adding an onload event
       * listener has no use because it will never be triggered).
       * Therefore we add the onload attribute during ssr, and
       * check here if it was already loaded or not
       */


      if (element.__vm_l) {
        onload();
        return;
      }

      if (!element.__vm_ev) {
        element.__vm_ev = true;
        element.addEventListener('load', onload);
      }
    });
  });
}

// instead of adding it to the html

var attributeMap = {};
/**
 * Updates the document's html tag attributes
 *
 * @param  {Object} attrs - the new document html attributes
 * @param  {HTMLElement} tag - the HTMLElement tag to update with new attrs
 */

function updateAttribute(appId, options, type, attrs, tag) {
  var _ref = options || {},
      attribute = _ref.attribute;

  var vueMetaAttrString = tag.getAttribute(attribute);

  if (vueMetaAttrString) {
    attributeMap[type] = JSON.parse(decodeURI(vueMetaAttrString));
    removeAttribute(tag, attribute);
  }

  var data = attributeMap[type] || {};
  var toUpdate = []; // remove attributes from the map
  // which have been removed for this appId

  for (var attr in data) {
    if (data[attr] !== undefined && appId in data[attr]) {
      toUpdate.push(attr);

      if (!attrs[attr]) {
        delete data[attr][appId];
      }
    }
  }

  for (var _attr in attrs) {
    var attrData = data[_attr];

    if (!attrData || attrData[appId] !== attrs[_attr]) {
      toUpdate.push(_attr);

      if (attrs[_attr] !== undefined) {
        data[_attr] = data[_attr] || {};
        data[_attr][appId] = attrs[_attr];
      }
    }
  }

  for (var _i = 0, _toUpdate = toUpdate; _i < _toUpdate.length; _i++) {
    var _attr2 = _toUpdate[_i];
    var _attrData = data[_attr2];
    var attrValues = [];

    for (var _appId in _attrData) {
      Array.prototype.push.apply(attrValues, [].concat(_attrData[_appId]));
    }

    if (attrValues.length) {
      var attrValue = includes(booleanHtmlAttributes, _attr2) && attrValues.some(Boolean) ? '' : attrValues.filter(function (v) {
        return v !== undefined;
      }).join(' ');
      tag.setAttribute(_attr2, attrValue);
    } else {
      removeAttribute(tag, _attr2);
    }
  }

  attributeMap[type] = data;
}

/**
 * Updates the document title
 *
 * @param  {String} title - the new title of the document
 */
function updateTitle(title) {
  if (!title && title !== '') {
    return;
  }

  document.title = title;
}

/**
 * Updates meta tags inside <head> and <body> on the client. Borrowed from `react-helmet`:
 * https://github.com/nfl/react-helmet/blob/004d448f8de5f823d10f838b02317521180f34da/src/Helmet.js#L195-L245
 *
 * @param  {('meta'|'base'|'link'|'style'|'script'|'noscript')} type - the name of the tag
 * @param  {(Array<Object>|Object)} tags - an array of tag objects or a single object in case of base
 * @return {Object} - a representation of what tags changed
 */

function updateTag(appId, options, type, tags, head, body) {
  var _ref = options || {},
      attribute = _ref.attribute,
      tagIDKeyName = _ref.tagIDKeyName;

  var dataAttributes = commonDataAttributes.slice();
  dataAttributes.push(tagIDKeyName);
  var newElements = [];
  var queryOptions = {
    appId: appId,
    attribute: attribute,
    type: type,
    tagIDKeyName: tagIDKeyName
  };
  var currentElements = {
    head: queryElements(head, queryOptions),
    pbody: queryElements(body, queryOptions, {
      pbody: true
    }),
    body: queryElements(body, queryOptions, {
      body: true
    })
  };

  if (tags.length > 1) {
    // remove duplicates that could have been found by merging tags
    // which include a mixin with metaInfo and that mixin is used
    // by multiple components on the same page
    var found = [];
    tags = tags.filter(function (x) {
      var k = JSON.stringify(x);
      var res = !includes(found, k);
      found.push(k);
      return res;
    });
  }

  tags.forEach(function (tag) {
    if (tag.skip) {
      return;
    }

    var newElement = document.createElement(type);

    if (!tag.once) {
      newElement.setAttribute(attribute, appId);
    }

    Object.keys(tag).forEach(function (attr) {
      /* istanbul ignore next */
      if (includes(tagProperties, attr)) {
        return;
      }

      if (attr === 'innerHTML') {
        newElement.innerHTML = tag.innerHTML;
        return;
      }

      if (attr === 'json') {
        newElement.innerHTML = JSON.stringify(tag.json);
        return;
      }

      if (attr === 'cssText') {
        if (newElement.styleSheet) {
          /* istanbul ignore next */
          newElement.styleSheet.cssText = tag.cssText;
        } else {
          newElement.appendChild(document.createTextNode(tag.cssText));
        }

        return;
      }

      if (attr === 'callback') {
        newElement.onload = function () {
          return tag[attr](newElement);
        };

        return;
      }

      var _attr = includes(dataAttributes, attr) ? "data-".concat(attr) : attr;

      var isBooleanAttribute = includes(booleanHtmlAttributes, attr);

      if (isBooleanAttribute && !tag[attr]) {
        return;
      }

      var value = isBooleanAttribute ? '' : tag[attr];
      newElement.setAttribute(_attr, value);
    });
    var oldElements = currentElements[getElementsKey(tag)]; // Remove a duplicate tag from domTagstoRemove, so it isn't cleared.

    var indexToDelete;
    var hasEqualElement = oldElements.some(function (existingTag, index) {
      indexToDelete = index;
      return newElement.isEqualNode(existingTag);
    });

    if (hasEqualElement && (indexToDelete || indexToDelete === 0)) {
      oldElements.splice(indexToDelete, 1);
    } else {
      newElements.push(newElement);
    }
  });
  var oldElements = [];

  for (var _type in currentElements) {
    Array.prototype.push.apply(oldElements, currentElements[_type]);
  } // remove old elements


  oldElements.forEach(function (element) {
    element.parentNode.removeChild(element);
  }); // insert new elements

  newElements.forEach(function (element) {
    if (element.hasAttribute('data-body')) {
      body.appendChild(element);
      return;
    }

    if (element.hasAttribute('data-pbody')) {
      body.insertBefore(element, body.firstChild);
      return;
    }

    head.appendChild(element);
  });
  return {
    oldTags: oldElements,
    newTags: newElements
  };
}

/**
 * Performs client-side updates when new meta info is received
 *
 * @param  {Object} newInfo - the meta info to update to
 */

function updateClientMetaInfo(appId, options, newInfo) {
  options = options || {};
  var _options = options,
      ssrAttribute = _options.ssrAttribute,
      ssrAppId = _options.ssrAppId; // only cache tags for current update

  var tags = {};
  var htmlTag = getTag(tags, 'html'); // if this is a server render, then dont update

  if (appId === ssrAppId && htmlTag.hasAttribute(ssrAttribute)) {
    // remove the server render attribute so we can update on (next) changes
    removeAttribute(htmlTag, ssrAttribute); // add load callbacks if the

    var addLoadListeners = false;
    tagsSupportingOnload.forEach(function (type) {
      if (newInfo[type] && addCallbacks(options, type, newInfo[type])) {
        addLoadListeners = true;
      }
    });

    if (addLoadListeners) {
      addListeners();
    }

    return false;
  } // initialize tracked changes


  var tagsAdded = {};
  var tagsRemoved = {};

  for (var type in newInfo) {
    // ignore these
    if (includes(metaInfoOptionKeys, type)) {
      continue;
    }

    if (type === 'title') {
      // update the title
      updateTitle(newInfo.title);
      continue;
    }

    if (includes(metaInfoAttributeKeys, type)) {
      var tagName = type.substr(0, 4);
      updateAttribute(appId, options, type, newInfo[type], getTag(tags, tagName));
      continue;
    } // tags should always be an array, ignore if it isnt


    if (!isArray(newInfo[type])) {
      continue;
    }

    var _updateTag = updateTag(appId, options, type, newInfo[type], getTag(tags, 'head'), getTag(tags, 'body')),
        oldTags = _updateTag.oldTags,
        newTags = _updateTag.newTags;

    if (newTags.length) {
      tagsAdded[type] = newTags;
      tagsRemoved[type] = oldTags;
    }
  }

  return {
    tagsAdded: tagsAdded,
    tagsRemoved: tagsRemoved
  };
}

var appsMetaInfo;
function addApp(rootVm, appId, options) {
  return {
    set: function set(metaInfo) {
      return setMetaInfo(rootVm, appId, options, metaInfo);
    },
    remove: function remove() {
      return removeMetaInfo(rootVm, appId, options);
    }
  };
}
function setMetaInfo(rootVm, appId, options, metaInfo) {
  // if a vm exists _and_ its mounted then immediately update
  if (rootVm && rootVm.$el) {
    return updateClientMetaInfo(appId, options, metaInfo);
  } // store for later, the info
  // will be set on the first refresh


  appsMetaInfo = appsMetaInfo || {};
  appsMetaInfo[appId] = metaInfo;
}
function removeMetaInfo(rootVm, appId, options) {
  if (rootVm && rootVm.$el) {
    var tags = {};

    var _iterator = _createForOfIteratorHelper(metaInfoAttributeKeys),
        _step;

    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var type = _step.value;
        var tagName = type.substr(0, 4);
        updateAttribute(appId, options, type, {}, getTag(tags, tagName));
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }

    return removeElementsByAppId(options, appId);
  }

  if (appsMetaInfo[appId]) {
    delete appsMetaInfo[appId];
    clearAppsMetaInfo();
  }
}
function getAppsMetaInfo() {
  return appsMetaInfo;
}
function clearAppsMetaInfo(force) {
  if (force || !Object.keys(appsMetaInfo).length) {
    appsMetaInfo = undefined;
  }
}

/**
 * Returns the correct meta info for the given component
 * (child components will overwrite parent meta info)
 *
 * @param  {Object} component - the Vue instance to get meta info from
 * @return {Object} - returned meta info
 */

function getMetaInfo(options, info, escapeSequences, component) {
  options = options || {};
  escapeSequences = escapeSequences || [];
  var _options = options,
      tagIDKeyName = _options.tagIDKeyName; // Remove all "template" tags from meta
  // backup the title chunk in case user wants access to it

  if (info.title) {
    info.titleChunk = info.title;
  } // replace title with populated template


  if (info.titleTemplate && info.titleTemplate !== '%s') {
    applyTemplate({
      component: component,
      contentKeyName: 'title'
    }, info, info.titleTemplate, info.titleChunk || '');
  } // convert base tag to an array so it can be handled the same way
  // as the other tags


  if (info.base) {
    info.base = Object.keys(info.base).length ? [info.base] : [];
  }

  if (info.meta) {
    // remove meta items with duplicate vmid's
    info.meta = info.meta.filter(function (metaItem, index, arr) {
      var hasVmid = !!metaItem[tagIDKeyName];

      if (!hasVmid) {
        return true;
      }

      var isFirstItemForVmid = index === findIndex(arr, function (item) {
        return item[tagIDKeyName] === metaItem[tagIDKeyName];
      });
      return isFirstItemForVmid;
    }); // apply templates if needed

    info.meta.forEach(function (metaObject) {
      return applyTemplate(options, metaObject);
    });
  }

  return escapeMetaInfo(options, info, escapeSequences);
}

/**
 * When called, will update the current meta info with new meta info.
 * Useful when updating meta info as the result of an asynchronous
 * action that resolves after the initial render takes place.
 *
 * Credit to [Sébastien Chopin](https://github.com/Atinux) for the suggestion
 * to implement this method.
 *
 * @return {Object} - new meta info
 */

function refresh(rootVm, options) {
  options = options || {}; // make sure vue-meta was initiated

  if (!rootVm[rootConfigKey]) {
    showWarningNotSupported();
    return {};
  } // collect & aggregate all metaInfo $options


  var rawInfo = getComponentMetaInfo(options, rootVm);
  var metaInfo = getMetaInfo(options, rawInfo, clientSequences, rootVm);
  var appId = rootVm[rootConfigKey].appId;
  var tags = updateClientMetaInfo(appId, options, metaInfo); // emit "event" with new info

  if (tags && isFunction(metaInfo.changed)) {
    metaInfo.changed(metaInfo, tags.tagsAdded, tags.tagsRemoved);
    tags = {
      addedTags: tags.tagsAdded,
      removedTags: tags.tagsRemoved
    };
  }

  var appsMetaInfo = getAppsMetaInfo();

  if (appsMetaInfo) {
    for (var additionalAppId in appsMetaInfo) {
      updateClientMetaInfo(additionalAppId, options, appsMetaInfo[additionalAppId]);
      delete appsMetaInfo[additionalAppId];
    }

    clearAppsMetaInfo(true);
  }

  return {
    vm: rootVm,
    metaInfo: metaInfo,
    // eslint-disable-line object-shorthand
    tags: tags
  };
}

/**
 * Generates tag attributes for use on the server.
 *
 * @param  {('bodyAttrs'|'htmlAttrs'|'headAttrs')} type - the type of attributes to generate
 * @param  {Object} data - the attributes to generate
 * @return {Object} - the attribute generator
 */

function attributeGenerator(options, type, data, _ref) {
  var addSsrAttribute = _ref.addSsrAttribute;

  var _ref2 = options || {},
      attribute = _ref2.attribute,
      ssrAttribute = _ref2.ssrAttribute;

  var attributeStr = '';

  for (var attr in data) {
    var attrData = data[attr];
    var attrValues = [];

    for (var appId in attrData) {
      attrValues.push.apply(attrValues, _toConsumableArray([].concat(attrData[appId])));
    }

    if (attrValues.length) {
      attributeStr += booleanHtmlAttributes.includes(attr) && attrValues.some(Boolean) ? "".concat(attr) : "".concat(attr, "=\"").concat(attrValues.join(' '), "\"");
      attributeStr += ' ';
    }
  }

  if (attributeStr) {
    attributeStr += "".concat(attribute, "=\"").concat(encodeURI(JSON.stringify(data)), "\"");
  }

  if (type === 'htmlAttrs' && addSsrAttribute) {
    return "".concat(ssrAttribute).concat(attributeStr ? ' ' : '').concat(attributeStr);
  }

  return attributeStr;
}

/**
 * Generates title output for the server
 *
 * @param  {'title'} type - the string "title"
 * @param  {String} data - the title text
 * @return {Object} - the title generator
 */
function titleGenerator(options, type, data, generatorOptions) {
  var _ref = generatorOptions || {},
      ln = _ref.ln;

  if (!data) {
    return '';
  }

  return "<".concat(type, ">").concat(data, "</").concat(type, ">").concat(ln ? '\n' : '');
}

/**
 * Generates meta, base, link, style, script, noscript tags for use on the server
 *
 * @param  {('meta'|'base'|'link'|'style'|'script'|'noscript')} the name of the tag
 * @param  {(Array<Object>|Object)} tags - an array of tag objects or a single object in case of base
 * @return {Object} - the tag generator
 */

function tagGenerator(options, type, tags, generatorOptions) {
  var _ref = options || {},
      ssrAppId = _ref.ssrAppId,
      attribute = _ref.attribute,
      tagIDKeyName = _ref.tagIDKeyName;

  var _ref2 = generatorOptions || {},
      appId = _ref2.appId,
      _ref2$isSSR = _ref2.isSSR,
      isSSR = _ref2$isSSR === void 0 ? true : _ref2$isSSR,
      _ref2$body = _ref2.body,
      body = _ref2$body === void 0 ? false : _ref2$body,
      _ref2$pbody = _ref2.pbody,
      pbody = _ref2$pbody === void 0 ? false : _ref2$pbody,
      _ref2$ln = _ref2.ln,
      ln = _ref2$ln === void 0 ? false : _ref2$ln;

  var dataAttributes = [tagIDKeyName].concat(_toConsumableArray(commonDataAttributes));

  if (!tags || !tags.length) {
    return '';
  } // build a string containing all tags of this type


  return tags.reduce(function (tagsStr, tag) {
    if (tag.skip) {
      return tagsStr;
    }

    var tagKeys = Object.keys(tag);

    if (tagKeys.length === 0) {
      return tagsStr; // Bail on empty tag object
    }

    if (Boolean(tag.body) !== body || Boolean(tag.pbody) !== pbody) {
      return tagsStr;
    }

    var attrs = tag.once ? '' : " ".concat(attribute, "=\"").concat(appId || (isSSR === false ? '1' : ssrAppId), "\""); // build a string containing all attributes of this tag

    for (var attr in tag) {
      // these attributes are treated as children on the tag
      if (tagAttributeAsInnerContent.includes(attr) || tagProperties.includes(attr)) {
        continue;
      }

      if (attr === 'callback') {
        attrs += ' onload="this.__vm_l=1"';
        continue;
      } // these form the attribute list for this tag


      var prefix = '';

      if (dataAttributes.includes(attr)) {
        prefix = 'data-';
      }

      var isBooleanAttr = !prefix && booleanHtmlAttributes.includes(attr);

      if (isBooleanAttr && !tag[attr]) {
        continue;
      }

      attrs += " ".concat(prefix).concat(attr) + (isBooleanAttr ? '' : "=\"".concat(tag[attr], "\""));
    }

    var json = '';

    if (tag.json) {
      json = JSON.stringify(tag.json);
    } // grab child content from one of these attributes, if possible


    var content = tag.innerHTML || tag.cssText || json; // generate tag exactly without any other redundant attribute
    // these tags have no end tag

    var hasEndTag = !tagsWithoutEndTag.includes(type); // these tag types will have content inserted

    var hasContent = hasEndTag && tagsWithInnerContent.includes(type); // the final string for this specific tag

    return "".concat(tagsStr, "<").concat(type).concat(attrs).concat(!hasContent && hasEndTag ? '/' : '', ">") + (hasContent ? "".concat(content, "</").concat(type, ">") : '') + (ln ? '\n' : '');
  }, '');
}

/**
 * Converts a meta info property to one that can be stringified on the server
 *
 * @param  {String} type - the type of data to convert
 * @param  {(String|Object|Array<Object>)} data - the data value
 * @return {Object} - the new injector
 */

function generateServerInjector(options, metaInfo, globalInjectOptions) {
  var serverInjector = {
    data: metaInfo,
    extraData: undefined,
    addInfo: function addInfo(appId, metaInfo) {
      this.extraData = this.extraData || {};
      this.extraData[appId] = metaInfo;
    },
    callInjectors: function callInjectors(opts) {
      var m = this.injectors; // only call title for the head

      return (opts.body || opts.pbody ? '' : m.title.text(opts)) + m.meta.text(opts) + m.base.text(opts) + m.link.text(opts) + m.style.text(opts) + m.script.text(opts) + m.noscript.text(opts);
    },
    injectors: {
      head: function head(ln) {
        return serverInjector.callInjectors(_objectSpread2(_objectSpread2({}, globalInjectOptions), {}, {
          ln: ln
        }));
      },
      bodyPrepend: function bodyPrepend(ln) {
        return serverInjector.callInjectors(_objectSpread2(_objectSpread2({}, globalInjectOptions), {}, {
          ln: ln,
          pbody: true
        }));
      },
      bodyAppend: function bodyAppend(ln) {
        return serverInjector.callInjectors(_objectSpread2(_objectSpread2({}, globalInjectOptions), {}, {
          ln: ln,
          body: true
        }));
      }
    }
  };

  var _loop = function _loop(type) {
    if (metaInfoOptionKeys.includes(type)) {
      return "continue";
    }

    serverInjector.injectors[type] = {
      text: function text(injectOptions) {
        var addSsrAttribute = injectOptions === true;
        injectOptions = _objectSpread2(_objectSpread2({
          addSsrAttribute: addSsrAttribute
        }, globalInjectOptions), injectOptions);

        if (type === 'title') {
          return titleGenerator(options, type, serverInjector.data[type], injectOptions);
        }

        if (metaInfoAttributeKeys.includes(type)) {
          var attributeData = {};
          var data = serverInjector.data[type];

          if (data) {
            var appId = injectOptions.isSSR === false ? '1' : options.ssrAppId;

            for (var attr in data) {
              attributeData[attr] = _defineProperty({}, appId, data[attr]);
            }
          }

          if (serverInjector.extraData) {
            for (var _appId in serverInjector.extraData) {
              var _data = serverInjector.extraData[_appId][type];

              if (_data) {
                for (var _attr in _data) {
                  attributeData[_attr] = _objectSpread2(_objectSpread2({}, attributeData[_attr]), {}, _defineProperty({}, _appId, _data[_attr]));
                }
              }
            }
          }

          return attributeGenerator(options, type, attributeData, injectOptions);
        }

        var str = tagGenerator(options, type, serverInjector.data[type], injectOptions);

        if (serverInjector.extraData) {
          for (var _appId2 in serverInjector.extraData) {
            var _data2 = serverInjector.extraData[_appId2][type];
            var extraStr = tagGenerator(options, type, _data2, _objectSpread2({
              appId: _appId2
            }, injectOptions));
            str = "".concat(str).concat(extraStr);
          }
        }

        return str;
      }
    };
  };

  for (var type in defaultInfo) {
    var _ret = _loop(type);

    if (_ret === "continue") continue;
  }

  return serverInjector;
}

/**
 * Converts the state of the meta info object such that each item
 * can be compiled to a tag string on the server
 *
 * @vm {Object} - Vue instance - ideally the root component
 * @return {Object} - server meta info with `toString` methods
 */

function inject(rootVm, options, injectOptions) {
  // make sure vue-meta was initiated
  if (!rootVm[rootConfigKey]) {
    showWarningNotSupported();
    return {};
  } // collect & aggregate all metaInfo $options


  var rawInfo = getComponentMetaInfo(options, rootVm);
  var metaInfo = getMetaInfo(options, rawInfo, serverSequences, rootVm); // generate server injector

  var serverInjector = generateServerInjector(options, metaInfo, injectOptions); // add meta info from additional apps

  var appsMetaInfo = getAppsMetaInfo();

  if (appsMetaInfo) {
    for (var additionalAppId in appsMetaInfo) {
      serverInjector.addInfo(additionalAppId, appsMetaInfo[additionalAppId]);
      delete appsMetaInfo[additionalAppId];
    }

    clearAppsMetaInfo(true);
  }

  return serverInjector.injectors;
}

function $meta(options) {
  options = options || {};
  /**
   * Returns an injector for server-side rendering.
   * @this {Object} - the Vue instance (a root component)
   * @return {Object} - injector
   */

  var $root = this.$root;
  return {
    getOptions: function getOptions$1() {
      return getOptions(options);
    },
    setOptions: function setOptions(newOptions) {
      var refreshNavKey = 'refreshOnceOnNavigation';

      if (newOptions && newOptions[refreshNavKey]) {
        options.refreshOnceOnNavigation = !!newOptions[refreshNavKey];
        addNavGuards($root);
      }

      var debounceWaitKey = 'debounceWait';

      if (newOptions && debounceWaitKey in newOptions) {
        var debounceWait = parseInt(newOptions[debounceWaitKey]);

        if (!isNaN(debounceWait)) {
          options.debounceWait = debounceWait;
        }
      }

      var waitOnDestroyedKey = 'waitOnDestroyed';

      if (newOptions && waitOnDestroyedKey in newOptions) {
        options.waitOnDestroyed = !!newOptions[waitOnDestroyedKey];
      }
    },
    refresh: function refresh$1() {
      return refresh($root, options);
    },
    inject: function inject$1(injectOptions) {
      return  inject($root, options, injectOptions) ;
    },
    pause: function pause$1() {
      return pause($root);
    },
    resume: function resume$1() {
      return resume($root);
    },
    addApp: function addApp$1(appId) {
      return addApp($root, appId, options);
    }
  };
}

function generate(rawInfo, options) {
  options = setOptions(options);
  var metaInfo = getMetaInfo(options, rawInfo, serverSequences);
  var serverInjector = generateServerInjector(options, metaInfo);
  return serverInjector.injectors;
}

/**
 * Plugin install function.
 * @param {Function} Vue - the Vue constructor.
 */

function install$1(Vue, options) {
  if (Vue.__vuemeta_installed) {
    return;
  }

  Vue.__vuemeta_installed = true;
  options = setOptions(options);

  Vue.prototype.$meta = function () {
    return $meta.call(this, options);
  };

  Vue.mixin(createMixin(Vue, options));
}

var index$2 = {
  version: version,
  install: install$1,
  generate: function generate$1(metaInfo, options) {
    return  generate(metaInfo, options) ;
  },
  hasMetaInfo: hasMetaInfo
};

var vueMeta_common = index$2;

var vueCompositionApi_common_prod = server$1.createCommonjsModule(function (module, exports) {
function e(e){return e&&"object"==typeof e&&"default"in e?e:{default:e}}Object.defineProperty(exports,"__esModule",{value:!0});var t=e(vue_runtime_common);function n(e){return "function"==typeof e&&/native code/.test(e.toString())}var r="undefined"!=typeof Symbol&&n(Symbol)&&"undefined"!=typeof Reflect&&n(Reflect.ownKeys),o=function(e){return e},i={enumerable:!0,configurable:!0,get:o,set:o};function u(e,t,n){var r=n.get,u=n.set;i.get=r||o,i.set=u||o,Object.defineProperty(e,t,i);}function a(e,t,n,r){Object.defineProperty(e,t,{value:n,enumerable:!!r,writable:!0,configurable:!0});}function f(e,t){return Object.hasOwnProperty.call(e,t)}function c(e){return Array.isArray(e)}function l(e){var t=parseFloat(String(e));return t>=0&&Math.floor(t)===t&&isFinite(e)}function s(e){return "[object Object]"===function(e){return Object.prototype.toString.call(e)}(e)}function v(e){return "function"==typeof e}function p(e,n){t.default.util.warn(e,n);}var d=void 0;try{var y=vue_runtime_common;y&&g(y)?d=y:y&&"default"in y&&g(y.default)&&(d=y.default);}catch(e){}var _=null,b=null;function g(e){return e&&"function"==typeof e&&"Vue"===e.name}function h(){return _}function x(e){b=e;}function m(){return b?j(b):null}var w,$=new WeakMap;function j(e){if($.has(e))return $.get(e);var t={proxy:e,update:e.$forceUpdate,uid:e._uid,emit:e.$emit.bind(e),parent:null,root:null};return ["data","props","attrs","refs","vnode","slots"].forEach((function(n){u(t,n,{get:function(){return e["$"+n]}});})),u(t,"isMounted",{get:function(){return e._isMounted}}),u(t,"isUnmounted",{get:function(){return e._isDestroyed}}),u(t,"isDeactivated",{get:function(){return e._inactive}}),u(t,"emitted",{get:function(){return e._events}}),$.set(e,t),e.$parent&&(t.parent=j(e.$parent)),e.$root&&(t.root=j(e.$root)),t}function O(e){var t=m();return null==t?void 0:t.proxy}function k(e,t){void 0===t&&(t={});var n=e.config.silent;e.config.silent=!0;var r=new e(t);return e.config.silent=n,r}function S(e,t){return function(){for(var n=[],r=0;r<arguments.length;r++)n[r]=arguments[r];return e.$scopedSlots[t]?e.$scopedSlots[t].apply(e,n):p("slots."+t+'() got called outside of the "render()" scope',e)}}var R=function(){return (R=Object.assign||function(e){for(var t,n=1,r=arguments.length;n<r;n++)for(var o in t=arguments[n])Object.prototype.hasOwnProperty.call(t,o)&&(e[o]=t[o]);return e}).apply(this,arguments)};
/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */function E(e){var t="function"==typeof Symbol&&Symbol.iterator,n=t&&e[t],r=0;if(n)return n.call(e);if(e&&"number"==typeof e.length)return {next:function(){return e&&r>=e.length&&(e=void 0),{value:e&&e[r++],done:!e}}};throw new TypeError(t?"Object is not iterable.":"Symbol.iterator is not defined.")}function M(e,t){var n="function"==typeof Symbol&&e[Symbol.iterator];if(!n)return e;var r,o,i=n.call(e),u=[];try{for(;(void 0===t||t-- >0)&&!(r=i.next()).done;)u.push(r.value);}catch(e){o={error:e};}finally{try{r&&!r.done&&(n=i.return)&&n.call(i);}finally{if(o)throw o.error}}return u}function P(){for(var e=[],t=0;t<arguments.length;t++)e=e.concat(M(arguments[t]));return e}function C(e){return r?Symbol.for(e):e}var A=C("composition-api.preFlushQueue"),D=C("composition-api.postFlushQueue"),U="composition-api.refKey",B=new WeakMap,W=new WeakMap,V=new WeakMap,z=function(e){u(this,"value",{get:e.get,set:e.set});};function F(e,t){var n=new z(e),r=Object.seal(n);return V.set(r,!0),r}function T(e){var t;if(I(e))return e;var n=Z(((t={})[U]=e,t));return F({get:function(){return n[U]},set:function(e){return n[U]=e}})}function I(e){return e instanceof z}function K(e){return I(e)?e.value:e}function q(e){if(!s(e))return e;var t={};for(var n in e)t[n]=Q(e,n);return t}function Q(e,t){var n=e[t];return I(n)?n:F({get:function(){return e[t]},set:function(n){return e[t]=n}})}function J(e){var t;return Boolean((null==e?void 0:e.__ob__)&&(null===(t=e.__ob__)||void 0===t?void 0:t.__raw__))}function N(e){var t;return Boolean((null==e?void 0:e.__ob__)&&!(null===(t=e.__ob__)||void 0===t?void 0:t.__raw__))}function G(e){if(!(!s(e)||J(e)||Array.isArray(e)||I(e)||function(e){var t=h();return t&&e instanceof t}(e)||B.has(e))){B.set(e,!0);for(var t=Object.keys(e),n=0;n<t.length;n++)H(e,t[n]);}}function H(e,t,n){if("__ob__"!==t&&!J(e[t])){var r,o,i=Object.getOwnPropertyDescriptor(e,t);if(i){if(!1===i.configurable)return;r=i.get,o=i.set,r&&!o||2!==arguments.length||(n=e[t]);}G(n),Object.defineProperty(e,t,{enumerable:!0,configurable:!0,get:function(){var o=r?r.call(e):n;return t!==U&&I(o)?o.value:o},set:function(i){if(!r||o){var u=r?r.call(e):n;t!==U&&I(u)&&!I(i)?u.value=i:o?o.call(e,i):n=i,G(i);}}});}}function L(e){var t,n=_||d;n.observable?t=n.observable(e):t=k(n,{data:{$$state:e}})._data.$$state;return f(t,"__ob__")||a(t,"__ob__",function(e){void 0===e&&(e={});return {value:e,dep:{notify:o,depend:o,addSub:o,removeSub:o}}}(t)),t}function X(){return L({}).__ob__}function Y(e){var t,n;if(!s(e)&&!c(e)||J(e)||!Object.isExtensible(e))return e;var r=L({});G(r);var o=r.__ob__,i=function(t){var n,i,u=e[t],a=Object.getOwnPropertyDescriptor(e,t);if(a){if(!1===a.configurable)return "continue";n=a.get,i=a.set;}Object.defineProperty(r,t,{enumerable:!0,configurable:!0,get:function(){var t,r=n?n.call(e):u;return null===(t=o.dep)||void 0===t||t.depend(),r},set:function(t){var r;n&&!i||(i?i.call(e,t):u=t,null===(r=o.dep)||void 0===r||r.notify());}});};try{for(var u=E(Object.keys(e)),a=u.next();!a.done;a=u.next()){i(a.value);}}catch(e){t={error:e};}finally{try{a&&!a.done&&(n=u.return)&&n.call(u);}finally{if(t)throw t.error}}return r}function Z(e){if(!s(e)&&!c(e)||J(e)||!Object.isExtensible(e))return e;var t=L(e);return G(t),t}function ee(e){return function(t){var n,r=O(((n=e)[0].toUpperCase(),n.slice(1)));r&&function(e,t,n,r){var o=t.$options,i=e.config.optionMergeStrategies[n];o[n]=i(o[n],function(e,t){return function(){for(var n,r=[],o=0;o<arguments.length;o++)r[o]=arguments[o];var i=null===(n=m())||void 0===n?void 0:n.proxy;x(e);try{return t.apply(void 0,P(r))}finally{x(i);}}}(t,r));}(h(),r,e,t);}}var te,ne=ee("beforeMount"),re=ee("mounted"),oe=ee("beforeUpdate"),ie=ee("updated"),ue=ee("beforeDestroy"),ae=ee("destroyed"),fe=ee("errorCaptured"),ce=ee("activated"),le=ee("deactivated"),se=ee("serverPrefetch");function ve(){ye(this,A);}function pe(){ye(this,D);}function de(){var e,t=null===(e=m())||void 0===e?void 0:e.proxy;return t?function(e){return void 0!==e[A]}(t)||function(e){e[A]=[],e[D]=[],e.$on("hook:beforeUpdate",ve),e.$on("hook:updated",pe);}(t):(te||(te=k(h())),t=te),t}function ye(e,t){for(var n=e[t],r=0;r<n.length;r++)n[r]();n.length=0;}function _e(e,t,n){var r=function(){e.$nextTick((function(){e[A].length&&ye(e,A),e[D].length&&ye(e,D);}));};switch(n){case"pre":r(),e[A].push(t);break;case"post":r(),e[D].push(t);break;default:!function(e,t){if(!e)throw new Error("[vue-composition-api] "+t)}(!1,'flush must be one of ["post", "pre", "sync"], but got '+n);}}function be(e,t){var n=e.teardown;e.teardown=function(){for(var r=[],o=0;o<arguments.length;o++)r[o]=arguments[o];n.apply(e,r),t();};}function ge(e,t,n,r){var i,u,a=r.flush,f="sync"===a,c=function(e){u=function(){try{e();}catch(e){!function(e,t,n){throw e;}(e);}};},l=function(){u&&(u(),u=null);},s=function(t){return f||e===te?t:function(){for(var n=[],r=0;r<arguments.length;r++)n[r]=arguments[r];return _e(e,(function(){t.apply(void 0,P(n));}),a)}};if(null===n){var d=!1,y=function(e,t,n,r){var o=e._watchers.length;return e.$watch(t,n,{immediate:r.immediateInvokeCallback,deep:r.deep,lazy:r.noRun,sync:r.sync,before:r.before}),e._watchers[o]}(e,(function(){if(!d)try{d=!0,t(c);}finally{d=!1;}}),o,{deep:r.deep||!1,sync:f,before:l});be(y,l),y.lazy=!1;var _=y.get.bind(y);return y.get=s(_),function(){y.teardown();}}var b,g=r.deep;Array.isArray(t)?b=function(){return t.map((function(e){return I(e)?e.value:e()}))}:I(t)?b=function(){return t.value}:N(t)?(b=function(){return t},g=!0):v(t)?b=t:(b=o,p("Invalid watch source: "+JSON.stringify(t)+".\n      A watch source can only be a getter/effect function, a ref, a reactive object, or an array of these types.",e));var h=function(e,t){l(),n(e,t,c);},x=s(h);if(r.immediate){var m=x,w=function(e,t){w=m,h(e,t);};x=function(e,t){w(e,t);};}var $=e.$watch(b,x,{immediate:r.immediate,deep:g,sync:f}),j=e._watchers[e._watchers.length-1];return N(j.value)&&(null===(i=j.value.__ob__)||void 0===i?void 0:i.dep)&&g&&j.value.__ob__.dep.addSub({update:function(){j.run();}}),be(j,l),function(){$();}}var he={};var xe={},me=function(e){var t;void 0===e&&(e="$style");var n=m();if(!n)return xe;var r=null===(t=n.proxy)||void 0===t?void 0:t[e];return r||xe},we=me;var $e;var je={set:function(e,t,n){(e.__composition_api_state__=e.__composition_api_state__||{})[t]=n;},get:function(e,t){return (e.__composition_api_state__||{})[t]}};function Oe(e){var t=je.get(e,"rawBindings")||{};if(t&&Object.keys(t).length){for(var n=e.$refs,r=je.get(e,"refs")||[],o=0;o<r.length;o++){var i=t[f=r[o]];!n[f]&&i&&I(i)&&(i.value=null);}var u=Object.keys(n),a=[];for(o=0;o<u.length;o++){var f;i=t[f=u[o]];n[f]&&i&&I(i)&&(i.value=n[f],a.push(f));}je.set(e,"refs",a);}}function ke(e,t){var n=e.$options._parentVnode;if(n){for(var r=je.get(e,"slots")||[],o=function(e,t){var n;if(e){if(e._normalized)return e._normalized;for(var r in n={},e)e[r]&&"$"!==r[0]&&(n[r]=!0);}else n={};for(var r in t)r in n||(n[r]=!0);return n}(n.data.scopedSlots,e.$slots),i=0;i<r.length;i++){o[a=r[i]]||delete t[a];}var u=Object.keys(o);for(i=0;i<u.length;i++){var a;t[a=u[i]]||(t[a]=S(e,a));}je.set(e,"slots",u);}}function Se(e,t,n){var r=b;x(e);try{return t(e)}catch(e){if(!n)throw e;n(e);}finally{x(r);}}function Re(e){function t(e){if(s(e)&&!I(e)&&!N(e)&&!J(e)){var n=h().util.defineReactive;Object.keys(e).forEach((function(r){var o=e[r];n(e,r,o),o&&t(o);}));}}function n(e,t){return void 0===t&&(t=new Map),t.has(e)?t.get(e):(t.set(e,!1),Array.isArray(e)&&N(e)?(t.set(e,!0),!0):!(!s(e)||J(e))&&Object.keys(e).some((function(r){return n(e[r],t)})))}e.mixin({beforeCreate:function(){var e=this,r=e.$options,o=r.setup,i=r.render;i&&(r.render=function(){for(var t=this,n=[],r=0;r<arguments.length;r++)n[r]=arguments[r];return Se(e,(function(){return i.apply(t,n)}))});if(!o)return;if("function"!=typeof o)return;var l=r.data;r.data=function(){return function(e,r){void 0===r&&(r={});var o,i=e.$options.setup,l=function(e){var t={slots:{}},n=["attrs"],r=["emit"];return ["root","parent","refs","listeners","isServer","ssrContext"].forEach((function(n){var r="$"+n;u(t,n,{get:function(){return e[r]},set:function(){p("Cannot assign to '"+n+"' because it is a read-only property",e);}});})),n.forEach((function(n){var r="$"+n;u(t,n,{get:function(){var t,n,o=Z({}),i=e[r],a=function(t){u(o,t,{get:function(){return e[r][t]}});};try{for(var f=E(Object.keys(i)),c=f.next();!c.done;c=f.next()){a(c.value);}}catch(e){t={error:e};}finally{try{c&&!c.done&&(n=f.return)&&n.call(f);}finally{if(t)throw t.error}}return o},set:function(){p("Cannot assign to '"+n+"' because it is a read-only property",e);}});})),r.forEach((function(n){var r="$"+n;u(t,n,{get:function(){return function(){for(var t=[],n=0;n<arguments.length;n++)t[n]=arguments[n];e[r].apply(e,t);}}});})),t}(e);if(a(r,"__ob__",X()),ke(e,l.slots),Se(e,(function(){o=i(r,l);})),!o)return;if(v(o)){var d=o;return void(e.$options.render=function(){return ke(e,l.slots),Se(e,(function(){return d()}))})}if(s(o)){N(o)&&(o=q(o)),je.set(e,"rawBindings",o);var y=o;Object.keys(y).forEach((function(r){var o,i=y[r];I(i)||(N(i)?c(i)&&(i=T(i)):v(i)?i=i.bind(e):null===(o=i)||"object"!=typeof o?i=T(i):n(i)&&t(i)),function(e,t,n){var r=e.$options.props;t in e||r&&f(r,t)||(I(n)?u(e,t,{get:function(){return n.value},set:function(e){n.value=e;}}):e[t]=n);}(e,r,i);}));}}(e,e.$props),"function"==typeof l?l.call(e,e):l||{}};},mounted:function(){Oe(this);},updated:function(){Oe(this);}});}function Ee(e,t){if(!e)return t;if(!t)return e;for(var n,o,i,u=r?Reflect.ownKeys(e):Object.keys(e),a=0;a<u.length;a++)"__ob__"!==(n=u[a])&&(o=t[n],i=e[n],f(t,n)?o!==i&&s(o)&&!I(o)&&s(i)&&!I(i)&&Ee(i,o):t[n]=i);return t}function Me(e){(function(e){return f(e,"__composition_api_installed__")})(e)||(e.config.optionMergeStrategies.setup=function(e,t){return function(n,r){return Ee("function"==typeof e?e(n,r)||{}:void 0,"function"==typeof t?t(n,r)||{}:void 0)}},function(e){_=e,Object.defineProperty(e,"__composition_api_installed__",{configurable:!0,writable:!0,value:!0});}(e),Re(e));}var Pe={install:function(e){return Me(e)}};exports.computed=function(e){var t,n,r,i,u,a=null===(t=m())||void 0===t?void 0:t.proxy;if("function"==typeof e?n=e:(n=e.get,r=e.set),a&&!a.$isServer){var f,c=function(){if(!w){var e=k(h(),{computed:{value:function(){return 0}}}),t=e._computedWatchers.value.constructor,n=e._data.__ob__.dep.constructor;w={Watcher:t,Dep:n},e.$destroy();}return w}(),l=c.Watcher,s=c.Dep;u=function(){return f||(f=new l(a,n,o,{lazy:!0})),f.dirty&&f.evaluate(),s.target&&f.depend(),f.value},i=function(e){r&&r(e);};}else {var v=k(h(),{computed:{$$state:{get:n,set:r}}});a&&a.$on("hook:destroyed",(function(){return v.$destroy()})),u=function(){return v.$$state},i=function(e){v.$$state=e;};}return F({get:u,set:i})},exports.createApp=function(e,t){void 0===t&&(t=void 0);var n=h(),r=void 0;return {config:n.config,use:n.use.bind(n),mixin:n.mixin.bind(n),component:n.component.bind(n),directive:n.directive.bind(n),mount:function(o,i){return r||((r=new n(R({propsData:t},e))).$mount(o,i),r)},unmount:function(){r&&(r.$destroy(),r=void 0);}}},exports.customRef=function(e){var t=T(0);return F(e((function(){t.value;}),(function(){++t.value;})))},exports.default=Pe,exports.defineComponent=function(e){return e},exports.del=function(e,t){if(h().util.warn,Array.isArray(e)&&l(t))e.splice(t,1);else {var n=e.__ob__;e._isVue||n&&n.vmCount||f(e,t)&&(delete e[t],n&&n.dep.notify());}},exports.getCurrentInstance=m,exports.h=function(){for(var e,t=[],n=0;n<arguments.length;n++)t[n]=arguments[n];var r=null===(e=m())||void 0===e?void 0:e.proxy;return r?r.$createElement.apply(r,t):(p("`createElement()` has been called outside of render function."),$e||($e=k(h()).$createElement),$e.apply($e,t))},exports.inject=function(e,t,n){var r;if(void 0===n&&(n=!1),!e)return t;var o=null===(r=m())||void 0===r?void 0:r.proxy;if(o){var i=function(e,t){for(var n=t;n;){if(n._provided&&f(n._provided,e))return n._provided[e];n=n.$parent;}return he}(e,o);return i!==he?i:n&&v(t)?t():t}p("inject() can only be used inside setup() or functional components.");},exports.isRaw=J,exports.isReactive=N,exports.isReadonly=function(e){return V.has(e)},exports.isRef=I,exports.markRaw=function(e){if(!s(e)&&!c(e)||!Object.isExtensible(e))return e;var t=X();return t.__raw__=!0,a(e,"__ob__",t),W.set(e,!0),e},exports.nextTick=function(){for(var e,t=[],n=0;n<arguments.length;n++)t[n]=arguments[n];return null===(e=h())||void 0===e?void 0:e.nextTick.apply(this,t)},exports.onActivated=ce,exports.onBeforeMount=ne,exports.onBeforeUnmount=ue,exports.onBeforeUpdate=oe,exports.onDeactivated=le,exports.onErrorCaptured=fe,exports.onMounted=re,exports.onServerPrefetch=se,exports.onUnmounted=ae,exports.onUpdated=ie,exports.provide=function(e,t){var n=O();if(n){if(!n._provided){var r={};Object.defineProperty(n,"_provided",{get:function(){return r},set:function(e){return Object.assign(r,e)}});}n._provided[e]=t;}},exports.proxyRefs=function(e){var t,n,r;if(N(e))return e;var o=Z(((t={})[U]=e,t)),i=function(e){u(o,e,{get:function(){return I(o[e])?o[e].value:o[e]},set:function(t){if(I(o[e]))return o[e].value=K(t);o[e]=K(t);}});};try{for(var a=E(Object.keys(e)),f=a.next();!f.done;f=a.next()){i(f.value);}}catch(e){n={error:e};}finally{try{f&&!f.done&&(r=a.return)&&r.call(a);}finally{if(n)throw n.error}}return o},exports.reactive=Z,exports.readonly=function(e){return e},exports.ref=T,exports.set=function(e,t,n){var r=h().util,o=(r.warn,r.defineReactive);if(c(e)&&l(t))return e.length=Math.max(e.length,t),e.splice(t,1,n),n;if(t in e&&!(t in Object.prototype))return e[t]=n,n;var i=e.__ob__;return e._isVue||i&&i.vmCount?n:i?(o(i.value,t,n),H(e,t,n),i.dep.notify(),n):(e[t]=n,n)},exports.shallowReactive=Y,exports.shallowReadonly=function(e){var t,n;if(!s(e)&&!c(e)||!Object.isExtensible(e))return e;var r={},o=Z({}).__ob__,i=function(t){var n,i=e[t],u=Object.getOwnPropertyDescriptor(e,t);if(u){if(!1===u.configurable)return "continue";n=u.get;}Object.defineProperty(r,t,{enumerable:!0,configurable:!0,get:function(){var t=n?n.call(e):i;return o.dep.depend(),t},set:function(e){}});};try{for(var u=E(Object.keys(e)),a=u.next();!a.done;a=u.next()){i(a.value);}}catch(e){t={error:e};}finally{try{a&&!a.done&&(n=u.return)&&n.call(u);}finally{if(t)throw t.error}}return V.set(r,!0),r},exports.shallowRef=function(e){var t;if(I(e))return e;var n=Y(((t={})[U]=e,t));return F({get:function(){return n[U]},set:function(e){return n[U]=e}})},exports.toRaw=function(e){var t,n;return J(e)||!Object.isExtensible(e)?e:(null===(n=null===(t=e)||void 0===t?void 0:t.__ob__)||void 0===n?void 0:n.value)||e},exports.toRef=Q,exports.toRefs=q,exports.triggerRef=function(e){I(e)&&(e.value=e.value);},exports.unref=K,exports.useCSSModule=we,exports.useCssModule=me,exports.version="1.0.0-rc.1",exports.warn=function(e){var t;p(e,null===(t=m())||void 0===t?void 0:t.proxy);},exports.watch=function(e,t,n){var r=null;"function"==typeof t?r=t:(n=t,r=null);var o=function(e){return R({immediate:!1,deep:!1,flush:"pre"},e)}(n);return ge(de(),e,r,o)},exports.watchEffect=function(e,t){var n=function(e){return R({immediate:!0,deep:!1,flush:"pre"},e)}(t);return ge(de(),e,null,n)};
});

/*@__PURE__*/server$1.getDefaultExportFromCjs(vueCompositionApi_common_prod);

var compositionApi = server$1.createCommonjsModule(function (module) {

{
  module.exports = vueCompositionApi_common_prod;
}
});

function isObject$1(val) {
  return val !== null && typeof val === 'object';
} // Base function to apply defaults


function _defu(baseObj, defaults) {
  var namespace = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '.';
  var merger = arguments.length > 3 ? arguments[3] : undefined;

  if (!isObject$1(defaults)) {
    return _defu(baseObj, {}, namespace, merger);
  }

  var obj = Object.assign({}, defaults);

  for (var key in baseObj) {
    if (key === '__proto__' || key === 'constructor') {
      continue;
    }

    var val = baseObj[key];

    if (val === null) {
      continue;
    }

    if (merger && merger(obj, key, val, namespace)) {
      continue;
    }

    if (Array.isArray(val) && Array.isArray(obj[key])) {
      obj[key] = obj[key].concat(val);
    } else if (isObject$1(val) && isObject$1(obj[key])) {
      obj[key] = _defu(val, obj[key], (namespace ? "".concat(namespace, ".") : '') + key.toString(), merger);
    } else {
      obj[key] = val;
    }
  }

  return obj;
} // Create defu wrapper with optional merger and multi arg support


function extend$1(merger) {
  return function () {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return args.reduce(function (p, c) {
      return _defu(p, c, '', merger);
    }, {});
  };
} // Basic version


var defu = extend$1(); // Custom version with function merge support

defu.fn = extend$1(function (obj, key, currentValue, _namespace) {
  if (typeof obj[key] !== 'undefined' && typeof currentValue === 'function') {
    obj[key] = currentValue(obj[key]);
    return true;
  }
}); // Custom version with function merge support only for defined arrays

defu.arrayFn = extend$1(function (obj, key, currentValue, _namespace) {
  if (Array.isArray(obj[key]) && typeof currentValue === 'function') {
    obj[key] = currentValue(obj[key]);
    return true;
  }
}); // Support user extending

defu.extend = extend$1;

var defu_1 = defu;

function asyncWebpackModule(promise, id) {
  return function (module, exports, require) {
    module.exports = promise.then(r => {
        const realModule = { exports: {}, require };
        r.modules[id](realModule, realModule.exports, realModule.require);
        return realModule.exports;
    });
 };
}
function webpackChunk (meta, promise) {
 const chunk = { ...meta, modules: {} };
 for (const id of meta.moduleIds) {
   chunk.modules[id] = asyncWebpackModule(promise, id);
 } return chunk;
}
const dynamicChunks = {
 ['pages/index.js']: () => webpackChunk({"ids":[1],"moduleIds":["28","29","30","31"]}, Promise.resolve().then(function () { return require('./pages/index.js'); }).then(function (n) { return n.index; }))
};

function dynamicRequire(id) {
  return dynamicChunks[id]();
}

var server = server$1.createCommonjsModule(function (module) {
module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// object to store loaded chunks
/******/ 	// "0" means "already loaded"
/******/ 	var installedChunks = {
/******/ 		0: 0
/******/ 	};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/ 	// This file contains only the entry chunk.
/******/ 	// The chunk loading function for additional chunks
/******/ 	__webpack_require__.e = function requireEnsure(chunkId) {
/******/ 		var promises = [];
/******/
/******/
/******/ 		// require() chunk loading for javascript
/******/
/******/ 		// "0" is the signal for "already loaded"
/******/ 		if(installedChunks[chunkId] !== 0) {
/******/ 			var chunk = dynamicRequire( ({"1":"pages/index"}[chunkId]||chunkId) + ".js");
/******/ 			var moreModules = chunk.modules, chunkIds = chunk.ids;
/******/ 			for(var moduleId in moreModules) {
/******/ 				modules[moduleId] = moreModules[moduleId];
/******/ 			}
/******/ 			for(var i = 0; i < chunkIds.length; i++)
/******/ 				installedChunks[chunkIds[i]] = 0;
/******/ 		}
/******/ 		return Promise.all(promises);
/******/ 	};
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "/_nuxt/";
/******/
/******/ 	// uncaught error handler for webpack runtime
/******/ 	__webpack_require__.oe = function(err) {
/******/ 		process.nextTick(function() {
/******/ 			throw err; // catch this error by using import().catch()
/******/ 		});
/******/ 	};
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 15);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports) {

module.exports = vue_runtime_common;

/***/ }),
/* 1 */
/***/ (function(module, exports) {

module.exports = dist;

/***/ }),
/* 2 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return normalizeComponent; });
/* globals __VUE_SSR_CONTEXT__ */

// IMPORTANT: Do NOT use ES2015 features in this file (except for modules).
// This module is a runtime utility for cleaner component module output and will
// be included in the final webpack user bundle.

function normalizeComponent (
  scriptExports,
  render,
  staticRenderFns,
  functionalTemplate,
  injectStyles,
  scopeId,
  moduleIdentifier, /* server only */
  shadowMode /* vue-cli only */
) {
  // Vue.extend constructor export interop
  var options = typeof scriptExports === 'function'
    ? scriptExports.options
    : scriptExports;

  // render functions
  if (render) {
    options.render = render;
    options.staticRenderFns = staticRenderFns;
    options._compiled = true;
  }

  // functional template
  if (functionalTemplate) {
    options.functional = true;
  }

  // scopedId
  if (scopeId) {
    options._scopeId = 'data-v-' + scopeId;
  }

  var hook;
  if (moduleIdentifier) { // server build
    hook = function (context) {
      // 2.3 injection
      context =
        context || // cached call
        (this.$vnode && this.$vnode.ssrContext) || // stateful
        (this.parent && this.parent.$vnode && this.parent.$vnode.ssrContext); // functional
      // 2.2 with runInNewContext: true
      if (!context && typeof __VUE_SSR_CONTEXT__ !== 'undefined') {
        context = __VUE_SSR_CONTEXT__;
      }
      // inject component styles
      if (injectStyles) {
        injectStyles.call(this, context);
      }
      // register component module identifier for async chunk inferrence
      if (context && context._registeredComponents) {
        context._registeredComponents.add(moduleIdentifier);
      }
    };
    // used by ssr in case component is cached and beforeCreate
    // never gets called
    options._ssrRegister = hook;
  } else if (injectStyles) {
    hook = shadowMode
      ? function () {
        injectStyles.call(
          this,
          (options.functional ? this.parent : this).$root.$options.shadowRoot
        );
      }
      : injectStyles;
  }

  if (hook) {
    if (options.functional) {
      // for template-only hot-reload because in that case the render fn doesn't
      // go through the normalizer
      options._injectStyles = hook;
      // register for functional component in vue file
      var originalRender = options.render;
      options.render = function renderWithStyleInjection (h, context) {
        hook.call(context);
        return originalRender(h, context)
      };
    } else {
      // inject component registration as beforeCreate hook
      var existing = options.beforeCreate;
      options.beforeCreate = existing
        ? [].concat(existing, hook)
        : [hook];
    }
  }

  return {
    exports: scriptExports,
    options: options
  }
}


/***/ }),
/* 3 */
/***/ (function(module, exports) {

module.exports = vueRouter_common;

/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {


Object.defineProperty(exports, '__esModule', {
  value: true
});

const Vue = __webpack_require__(0);

const CompositionApi = __webpack_require__(22);

const defu2 = __webpack_require__(23);

function _interopDefaultLegacy(e) {
  return e && typeof e === 'object' && 'default' in e ? e : {
    'default': e
  };
}

const Vue__default = /*#__PURE__*/_interopDefaultLegacy(Vue);

const CompositionApi__default = /*#__PURE__*/_interopDefaultLegacy(CompositionApi);

const defu2__default = /*#__PURE__*/_interopDefaultLegacy(defu2);

const globalNuxt = "$nuxt".includes("options") ? "$nuxt" : "$nuxt";
const isFullStatic = "true".includes("options") ? false : false;

function validateKey(key) {
  if (!key) {
    throw new Error("You must provide a key. You can have it generated automatically by adding '@nuxtjs/composition-api/babel' to your Babel plugins.");
  }
}

function getCurrentInstance() {
  const vm = CompositionApi.getCurrentInstance();
  if (!vm) return;
  return vm.proxy;
}

function getValue(value) {
  if (value instanceof Function) return value();
  return value;
}

let globalRefs = {};

function setSSRContext(app) {
  globalRefs = Object.assign({}, {});
  app.context.ssrContext.nuxt.globalRefs = globalRefs;
}

const useServerData = () => {
  let type = "globalRefs";
  const vm = getCurrentInstance();

  if (vm) {
    type = "ssrRefs";

    {
      const {
        ssrContext
      } = vm[globalNuxt].context;
      ssrContext.nuxt.ssrRefs = ssrContext.nuxt.ssrRefs || {};
    }
  }

  const setData = (key, val) => {
    switch (type) {
      case "globalRefs":
        globalRefs[key] = sanitise(val);
        break;

      case "ssrRefs":
        vm[globalNuxt].context.ssrContext.nuxt.ssrRefs[key] = sanitise(val);
    }
  };

  return {
    type,
    setData
  };
};

const isProxyable = val => !!val && typeof val === "object";

const sanitise = val => val && JSON.parse(JSON.stringify(val)) || val;

const ssrValue = (value, key, type = "globalRefs") => {

  return getValue(value);
};

const ssrRef = (value, key) => {
  validateKey(key);
  const {
    type,
    setData
  } = useServerData();
  let val = ssrValue(value, key, type);
  if (value instanceof Function) setData(key, val);

  const getProxy = (track, trigger, observable) => new Proxy(observable, {
    get(target, prop) {
      track();
      if (isProxyable(target[prop])) return getProxy(track, trigger, target[prop]);
      return Reflect.get(target, prop);
    },

    set(obj, prop, newVal) {
      const result = Reflect.set(obj, prop, newVal);
      setData(key, val);
      trigger();
      return result;
    }

  });

  const proxy = CompositionApi.customRef((track, trigger) => ({
    get: () => {
      track();
      if (isProxyable(val)) return getProxy(track, trigger, val);
      return val;
    },
    set: v => {
      setData(key, v);
      val = v;
      trigger();
    }
  }));
  return proxy;
};

const shallowSsrRef = (value, key) => {
  validateKey(key);
  const {
    type,
    setData
  } = useServerData();

  const _val = getValue(value);

  if (value instanceof Function) {
    setData(key, _val);
  }

  return CompositionApi.customRef((track, trigger) => ({
    get() {
      track();
      return _val;
    },

    set(newValue) {
      setData(key, newValue);
      value = newValue;
      trigger();
    }

  }));
};

const ssrPromise = (value, key) => {
  validateKey(key);
  const {
    type,
    setData
  } = useServerData();
  const val = ssrValue(value, key, type);
  CompositionApi.onServerPrefetch(async () => {
    setData(key, await val);
  });
  return val;
};

const useAsync = (cb, key) => {

  validateKey(key);

  const _ref = CompositionApi.isRef(key) ? key : ssrRef(null, key);

  if (!_ref.value ||  false ) {
    const p = Promise.resolve(cb());

    {
      CompositionApi.onServerPrefetch(async () => {
        _ref.value = await p;
      });
    }
  }

  return _ref;
};

function createEmptyMeta() {
  return {
    titleTemplate: null,
    __dangerouslyDisableSanitizers: [],
    __dangerouslyDisableSanitizersByTagID: {},
    title: void 0,
    htmlAttrs: {},
    headAttrs: {},
    bodyAttrs: {},
    base: void 0,
    meta: [],
    link: [],
    style: [],
    script: [],
    noscript: [],
    changed: void 0,
    afterNavigation: void 0
  };
}

const getHeadOptions = options => {
  const head = function () {
    const optionHead = options.head instanceof Function ? options.head.call(this) : options.head;
    if (!this._computedHead) return optionHead;

    const computedHead = this._computedHead.map(h => {
      if (CompositionApi.isReactive(h)) return CompositionApi.toRaw(h);
      if (CompositionApi.isRef(h)) return h.value;
      return h;
    });

    return defu2__default['default']({}, ...computedHead.reverse(), optionHead);
  };

  return {
    head
  };
};

const useMeta = init => {
  const vm = getCurrentInstance();
  if (!vm) throw new Error("useMeta must be called within a component.");
  if (!("head" in vm.$options)) throw new Error("In order to enable `useMeta`, please make sure you include `head: {}` within your component definition, and you are using the `defineComponent` exported from @nuxtjs/composition-api.");

  if (!vm._computedHead) {
    const metaRefs = CompositionApi.reactive(createEmptyMeta());
    vm._computedHead = [metaRefs];
    vm._metaRefs = CompositionApi.toRefs(metaRefs);
  }

  if (init) {
    const initRef = init instanceof Function ? CompositionApi.computed(init) : CompositionApi.ref(init);

    vm._computedHead.push(initRef);
  }

  return vm._metaRefs;
};

const defineComponent = options => {
  if (!("head" in options)) return options;
  return { ...options,
    ...getHeadOptions(options)
  };
};

const withContext = callback => {
  const vm = getCurrentInstance();
  if (!vm) throw new Error("This must be called within a setup function.");
  callback(vm[globalNuxt].context);
};

const useContext = () => {
  const vm = getCurrentInstance();
  if (!vm) throw new Error("This must be called within a setup function.");
  return { ...(vm[globalNuxt] || vm.$options).context,
    route: CompositionApi.computed(() => vm.$route),
    query: CompositionApi.computed(() => vm.$route.query),
    from: CompositionApi.computed(() => vm.$route.redirectedFrom),
    params: CompositionApi.computed(() => vm.$route.params)
  };
};

function normalizeError(err) {
  let message;

  if (!(err.message || typeof err === "string")) {
    try {
      message = JSON.stringify(err, null, 2);
    } catch (e) {
      message = `[${err.constructor.name}]`;
    }
  } else {
    message = err.message || err;
  }

  return { ...err,
    message,
    statusCode: err.statusCode || err.status || err.response && err.response.status || 500
  };
}

const fetches = new WeakMap();
const fetchPromises = new Map();

function registerCallback(vm, callback) {
  const callbacks = fetches.get(vm) || [];
  fetches.set(vm, [...callbacks, callback]);
}

async function callFetches() {
  const fetchesToCall = fetches.get(this);
  if (!fetchesToCall) return;
  this[globalNuxt].nbFetching++;
  this.$fetchState.pending = true;
  this.$fetchState.error = null;
  this._hydrated = false;
  let error = null;
  const startTime = Date.now();

  try {
    await Promise.all(fetchesToCall.map(fetch => {
      if (fetchPromises.has(fetch)) return fetchPromises.get(fetch);
      const promise = Promise.resolve(fetch(this)).finally(() => fetchPromises.delete(fetch));
      fetchPromises.set(fetch, promise);
      return promise;
    }));
  } catch (err) {
    error = normalizeError(err);
  }

  const delayLeft = (this._fetchDelay || 0) - (Date.now() - startTime);

  if (delayLeft > 0) {
    await new Promise(resolve => setTimeout(resolve, delayLeft));
  }

  this.$fetchState.error = error;
  this.$fetchState.pending = false;
  this.$fetchState.timestamp = Date.now();
  this.$nextTick(() => this[globalNuxt].nbFetching--);
}

const setFetchState = vm => {
  vm.$fetchState = vm.$fetchState || Vue__default['default'].observable({
    error: null,
    pending: false,
    timestamp: 0
  });
};

const loadFullStatic = vm => {
  const {
    fetchOnServer
  } = vm.$options;
  const fetchedOnServer = typeof fetchOnServer === "function" ? fetchOnServer.call(vm) !== false : fetchOnServer !== false;
  const nuxt = vm[globalNuxt];

  if (!fetchedOnServer || (nuxt == null ? void 0 : nuxt.isPreview) || !(nuxt == null ? void 0 : nuxt._pagePayload)) {
    return;
  }

  vm._hydrated = true;
  nuxt._payloadFetchIndex = (nuxt._payloadFetchIndex || 0) + 1;
  vm._fetchKey = nuxt._payloadFetchIndex;
  const data = nuxt._pagePayload.fetch[vm._fetchKey];

  if (data && data._error) {
    vm.$fetchState.error = data._error;
    return;
  }

  for (const key in data) {
    CompositionApi.set(vm.$data, key, data[key]);
  }
};

async function serverPrefetch(vm) {
  if (!vm._fetchOnServer) return;
  setFetchState(vm);

  try {
    await callFetches.call(vm);
  } catch (err) {
    vm.$fetchState.error = normalizeError(err);
  }

  vm.$fetchState.pending = false;
  vm._fetchKey = vm.$ssrContext.nuxt.fetch.length;
  if (!vm.$vnode.data) vm.$vnode.data = {};
  const attrs = vm.$vnode.data.attrs = vm.$vnode.data.attrs || {};
  attrs["data-fetch-key"] = vm._fetchKey;
  const data = { ...vm._data
  };
  Object.entries(vm.__composition_api_state__.rawBindings).forEach(([key, val]) => {
    if (val instanceof Function || val instanceof Promise) return;
    data[key] = CompositionApi.isRef(val) ? val.value : val;
  });
  vm.$ssrContext.nuxt.fetch.push(vm.$fetchState.error ? {
    _error: vm.$fetchState.error
  } : JSON.parse(JSON.stringify(data)));
}

const useFetch = callback => {

  const vm = getCurrentInstance();
  if (!vm) throw new Error("This must be called within a setup function.");
  registerCallback(vm, callback);

  if (typeof vm.$options.fetchOnServer === "function") {
    vm._fetchOnServer = vm.$options.fetchOnServer.call(vm) !== false;
  } else {
    vm._fetchOnServer = vm.$options.fetchOnServer !== false;
  }

  setFetchState(vm);
  CompositionApi.onServerPrefetch(() => serverPrefetch(vm));

  function result() {
    return {
      fetch: vm.$fetch,
      fetchState: vm.$fetchState,
      $fetch: vm.$fetch,
      $fetchState: vm.$fetchState
    };
  }

  vm._fetchDelay = typeof vm.$options.fetchDelay === "number" ? vm.$options.fetchDelay : 0;
  vm.$fetch = callFetches.bind(vm);
  CompositionApi.onBeforeMount(() => !vm._hydrated && callFetches.call(vm));

  {
    if (isFullStatic) CompositionApi.onBeforeMount(() => loadFullStatic(vm));
    return result();
  }
};

const reqRefs = new Set();

const reqRef = initialValue => {
  const _ref = CompositionApi.ref(initialValue);

  reqRefs.add(() => _ref.value = initialValue);
  return _ref;
};

const reqSsrRef = (initialValue, key) => {
  const _ref = ssrRef(initialValue, key);

  reqRefs.add(() => {
    _ref.value = initialValue instanceof Function ? sanitise(initialValue()) : initialValue;
  });
  return _ref;
};

let globalSetup;

const onGlobalSetup = fn => {
  globalSetup.add(fn);
};

const setMetaPlugin = context => {
  const {
    head
  } = context.app;
  Object.assign(context.app, getHeadOptions({
    head
  }));
};

const globalPlugin = context => {
  {
    reqRefs.forEach(reset => reset());
    setSSRContext(context.app);
  }

  const {
    setup
  } = context.app;
  globalSetup = new Set();

  context.app.setup = function (...args) {
    let result = {};

    if (setup instanceof Function) {
      result = setup(...args) || {};
    }

    for (const fn of globalSetup) {
      result = { ...result,
        ...(fn.call(this, ...args) || {})
      };
    }

    return result;
  };
};

const staticPath = "/Users/alichter/Programming/rm-nitro-test/node_modules/.cache/nuxt/static-json";
const staticCache = {};

function writeFile(key, value) {
  const {
    writeFileSync
  } =  __webpack_require__(24);
  const {
    join
  } =  __webpack_require__(25);

  try {
    writeFileSync(join(staticPath, `${key}.json`), value);
  } catch (e) {
    console.log(e);
  }
}

const useStatic = (factory, param = CompositionApi.ref(""), keyBase) => {
  const key = CompositionApi.computed(() => `${keyBase}-${param.value}`);
  const result = ssrRef(null, key.value);
  if (result.value) staticCache[key.value] = result.value;

  {
    if (key.value in staticCache) {
      result.value = staticCache[key.value];
      return result;
    }

    CompositionApi.onServerPrefetch(async () => {
      const [_key, _param] = [key.value, param.value];
      result.value = await factory(_param, _key);
      staticCache[_key] = result.value;
      writeFile(_key, JSON.stringify(result.value));
    });
  }

  return result;
};

const defineNuxtPlugin = plugin => plugin;

const defineNuxtMiddleware = middleware => middleware;

const defineNuxtModule = module => module;

const defineNuxtServerMiddleware = serverMiddleware => serverMiddleware;

Vue__default['default'].use(CompositionApi__default['default']);
Object.defineProperty(exports, 'computed', {
  enumerable: true,
  get: function () {
    return CompositionApi.computed;
  }
});
Object.defineProperty(exports, 'createApp', {
  enumerable: true,
  get: function () {
    return CompositionApi.createApp;
  }
});
Object.defineProperty(exports, 'customRef', {
  enumerable: true,
  get: function () {
    return CompositionApi.customRef;
  }
});
Object.defineProperty(exports, 'del', {
  enumerable: true,
  get: function () {
    return CompositionApi.del;
  }
});
Object.defineProperty(exports, 'getCurrentInstance', {
  enumerable: true,
  get: function () {
    return CompositionApi.getCurrentInstance;
  }
});
Object.defineProperty(exports, 'h', {
  enumerable: true,
  get: function () {
    return CompositionApi.h;
  }
});
Object.defineProperty(exports, 'inject', {
  enumerable: true,
  get: function () {
    return CompositionApi.inject;
  }
});
Object.defineProperty(exports, 'isRaw', {
  enumerable: true,
  get: function () {
    return CompositionApi.isRaw;
  }
});
Object.defineProperty(exports, 'isReactive', {
  enumerable: true,
  get: function () {
    return CompositionApi.isReactive;
  }
});
Object.defineProperty(exports, 'isReadonly', {
  enumerable: true,
  get: function () {
    return CompositionApi.isReadonly;
  }
});
Object.defineProperty(exports, 'isRef', {
  enumerable: true,
  get: function () {
    return CompositionApi.isRef;
  }
});
Object.defineProperty(exports, 'markRaw', {
  enumerable: true,
  get: function () {
    return CompositionApi.markRaw;
  }
});
Object.defineProperty(exports, 'nextTick', {
  enumerable: true,
  get: function () {
    return CompositionApi.nextTick;
  }
});
Object.defineProperty(exports, 'onActivated', {
  enumerable: true,
  get: function () {
    return CompositionApi.onActivated;
  }
});
Object.defineProperty(exports, 'onBeforeMount', {
  enumerable: true,
  get: function () {
    return CompositionApi.onBeforeMount;
  }
});
Object.defineProperty(exports, 'onBeforeUnmount', {
  enumerable: true,
  get: function () {
    return CompositionApi.onBeforeUnmount;
  }
});
Object.defineProperty(exports, 'onBeforeUpdate', {
  enumerable: true,
  get: function () {
    return CompositionApi.onBeforeUpdate;
  }
});
Object.defineProperty(exports, 'onDeactivated', {
  enumerable: true,
  get: function () {
    return CompositionApi.onDeactivated;
  }
});
Object.defineProperty(exports, 'onErrorCaptured', {
  enumerable: true,
  get: function () {
    return CompositionApi.onErrorCaptured;
  }
});
Object.defineProperty(exports, 'onMounted', {
  enumerable: true,
  get: function () {
    return CompositionApi.onMounted;
  }
});
Object.defineProperty(exports, 'onServerPrefetch', {
  enumerable: true,
  get: function () {
    return CompositionApi.onServerPrefetch;
  }
});
Object.defineProperty(exports, 'onUnmounted', {
  enumerable: true,
  get: function () {
    return CompositionApi.onUnmounted;
  }
});
Object.defineProperty(exports, 'onUpdated', {
  enumerable: true,
  get: function () {
    return CompositionApi.onUpdated;
  }
});
Object.defineProperty(exports, 'provide', {
  enumerable: true,
  get: function () {
    return CompositionApi.provide;
  }
});
Object.defineProperty(exports, 'proxyRefs', {
  enumerable: true,
  get: function () {
    return CompositionApi.proxyRefs;
  }
});
Object.defineProperty(exports, 'reactive', {
  enumerable: true,
  get: function () {
    return CompositionApi.reactive;
  }
});
Object.defineProperty(exports, 'readonly', {
  enumerable: true,
  get: function () {
    return CompositionApi.readonly;
  }
});
Object.defineProperty(exports, 'ref', {
  enumerable: true,
  get: function () {
    return CompositionApi.ref;
  }
});
Object.defineProperty(exports, 'set', {
  enumerable: true,
  get: function () {
    return CompositionApi.set;
  }
});
Object.defineProperty(exports, 'shallowReactive', {
  enumerable: true,
  get: function () {
    return CompositionApi.shallowReactive;
  }
});
Object.defineProperty(exports, 'shallowReadonly', {
  enumerable: true,
  get: function () {
    return CompositionApi.shallowReadonly;
  }
});
Object.defineProperty(exports, 'shallowRef', {
  enumerable: true,
  get: function () {
    return CompositionApi.shallowRef;
  }
});
Object.defineProperty(exports, 'toRaw', {
  enumerable: true,
  get: function () {
    return CompositionApi.toRaw;
  }
});
Object.defineProperty(exports, 'toRef', {
  enumerable: true,
  get: function () {
    return CompositionApi.toRef;
  }
});
Object.defineProperty(exports, 'toRefs', {
  enumerable: true,
  get: function () {
    return CompositionApi.toRefs;
  }
});
Object.defineProperty(exports, 'triggerRef', {
  enumerable: true,
  get: function () {
    return CompositionApi.triggerRef;
  }
});
Object.defineProperty(exports, 'unref', {
  enumerable: true,
  get: function () {
    return CompositionApi.unref;
  }
});
Object.defineProperty(exports, 'useCSSModule', {
  enumerable: true,
  get: function () {
    return CompositionApi.useCSSModule;
  }
});
Object.defineProperty(exports, 'useCssModule', {
  enumerable: true,
  get: function () {
    return CompositionApi.useCssModule;
  }
});
Object.defineProperty(exports, 'version', {
  enumerable: true,
  get: function () {
    return CompositionApi.version;
  }
});
Object.defineProperty(exports, 'warn', {
  enumerable: true,
  get: function () {
    return CompositionApi.warn;
  }
});
Object.defineProperty(exports, 'watch', {
  enumerable: true,
  get: function () {
    return CompositionApi.watch;
  }
});
Object.defineProperty(exports, 'watchEffect', {
  enumerable: true,
  get: function () {
    return CompositionApi.watchEffect;
  }
});
exports.defineComponent = defineComponent;
exports.defineNuxtMiddleware = defineNuxtMiddleware;
exports.defineNuxtModule = defineNuxtModule;
exports.defineNuxtPlugin = defineNuxtPlugin;
exports.defineNuxtServerMiddleware = defineNuxtServerMiddleware;
exports.globalPlugin = globalPlugin;
exports.onGlobalSetup = onGlobalSetup;
exports.reqRef = reqRef;
exports.reqSsrRef = reqSsrRef;
exports.setMetaPlugin = setMetaPlugin;
exports.setSSRContext = setSSRContext;
exports.shallowSsrRef = shallowSsrRef;
exports.ssrPromise = ssrPromise;
exports.ssrRef = ssrRef;
exports.useAsync = useAsync;
exports.useContext = useContext;
exports.useFetch = useFetch;
exports.useMeta = useMeta;
exports.useStatic = useStatic;
exports.withContext = withContext;

/***/ }),
/* 5 */
/***/ (function(module, exports) {

module.exports = vueNoSsr_common;

/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {


/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
// css base code, injected by the css-loader
// eslint-disable-next-line func-names
module.exports = function (useSourceMap) {
  var list = []; // return the list of modules as css string

  list.toString = function toString() {
    return this.map(function (item) {
      var content = cssWithMappingToString(item, useSourceMap);

      if (item[2]) {
        return "@media ".concat(item[2], " {").concat(content, "}");
      }

      return content;
    }).join('');
  }; // import a list of modules into the list
  // eslint-disable-next-line func-names


  list.i = function (modules, mediaQuery, dedupe) {
    if (typeof modules === 'string') {
      // eslint-disable-next-line no-param-reassign
      modules = [[null, modules, '']];
    }

    var alreadyImportedModules = {};

    if (dedupe) {
      for (var i = 0; i < this.length; i++) {
        // eslint-disable-next-line prefer-destructuring
        var id = this[i][0];

        if (id != null) {
          alreadyImportedModules[id] = true;
        }
      }
    }

    for (var _i = 0; _i < modules.length; _i++) {
      var item = [].concat(modules[_i]);

      if (dedupe && alreadyImportedModules[item[0]]) {
        // eslint-disable-next-line no-continue
        continue;
      }

      if (mediaQuery) {
        if (!item[2]) {
          item[2] = mediaQuery;
        } else {
          item[2] = "".concat(mediaQuery, " and ").concat(item[2]);
        }
      }

      list.push(item);
    }
  };

  return list;
};

function cssWithMappingToString(item, useSourceMap) {
  var content = item[1] || ''; // eslint-disable-next-line prefer-destructuring

  var cssMapping = item[3];

  if (!cssMapping) {
    return content;
  }

  if (useSourceMap && typeof btoa === 'function') {
    var sourceMapping = toComment(cssMapping);
    var sourceURLs = cssMapping.sources.map(function (source) {
      return "/*# sourceURL=".concat(cssMapping.sourceRoot || '').concat(source, " */");
    });
    return [content].concat(sourceURLs).concat([sourceMapping]).join('\n');
  }

  return [content].join('\n');
} // Adapted from convert-source-map (MIT)


function toComment(sourceMap) {
  // eslint-disable-next-line no-undef
  var base64 = btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap))));
  var data = "sourceMappingURL=data:application/json;charset=utf-8;base64,".concat(base64);
  return "/*# ".concat(data, " */");
}

/***/ }),
/* 7 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, "default", function() { return /* binding */ addStylesServer; });

// CONCATENATED MODULE: ./node_modules/vue-style-loader/lib/listToStyles.js
/**
 * Translates the list format produced by css-loader into something
 * easier to manipulate.
 */
function listToStyles (parentId, list) {
  var styles = [];
  var newStyles = {};
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var id = item[0];
    var css = item[1];
    var media = item[2];
    var sourceMap = item[3];
    var part = {
      id: parentId + ':' + i,
      css: css,
      media: media,
      sourceMap: sourceMap
    };
    if (!newStyles[id]) {
      styles.push(newStyles[id] = { id: id, parts: [part] });
    } else {
      newStyles[id].parts.push(part);
    }
  }
  return styles
}

// CONCATENATED MODULE: ./node_modules/vue-style-loader/lib/addStylesServer.js


function addStylesServer (parentId, list, isProduction, context) {
  if (!context && typeof __VUE_SSR_CONTEXT__ !== 'undefined') {
    context = __VUE_SSR_CONTEXT__;
  }
  if (context) {
    if (!context.hasOwnProperty('styles')) {
      Object.defineProperty(context, 'styles', {
        enumerable: true,
        get: function() {
          return renderStyles(context._styles)
        }
      });
      // expose renderStyles for vue-server-renderer (vuejs/#6353)
      context._renderStyles = renderStyles;
    }

    var styles = context._styles || (context._styles = {});
    list = listToStyles(parentId, list);
    if (isProduction) {
      addStyleProd(styles, list);
    } else {
      addStyleDev(styles, list);
    }
  }
}

// In production, render as few style tags as possible.
// (mostly because IE9 has a limit on number of style tags)
function addStyleProd (styles, list) {
  for (var i = 0; i < list.length; i++) {
    var parts = list[i].parts;
    for (var j = 0; j < parts.length; j++) {
      var part = parts[j];
      // group style tags by media types.
      var id = part.media || 'default';
      var style = styles[id];
      if (style) {
        if (style.ids.indexOf(part.id) < 0) {
          style.ids.push(part.id);
          style.css += '\n' + part.css;
        }
      } else {
        styles[id] = {
          ids: [part.id],
          css: part.css,
          media: part.media
        };
      }
    }
  }
}

// In dev we use individual style tag for each module for hot-reload
// and source maps.
function addStyleDev (styles, list) {
  for (var i = 0; i < list.length; i++) {
    var parts = list[i].parts;
    for (var j = 0; j < parts.length; j++) {
      var part = parts[j];
      styles[part.id] = {
        ids: [part.id],
        css: part.css,
        media: part.media
      };
    }
  }
}

function renderStyles (styles) {
  var css = '';
  for (var key in styles) {
    var style = styles[key];
    css += '<style data-vue-ssr-id="' + style.ids.join(' ') + '"' +
        (style.media ? ( ' media="' + style.media + '"' ) : '') + '>' +
        style.css + '</style>';
  }
  return css
}


/***/ }),
/* 8 */
/***/ (function(module, exports) {

module.exports = vueClientOnly_common;

/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

// style-loader: Adds some css to the DOM by adding a <style> tag

// load the styles
var content = __webpack_require__(17);
if(typeof content === 'string') content = [[module.i, content, '']];
if(content.locals) module.exports = content.locals;
// add CSS to SSR context
var add = __webpack_require__(7).default;
module.exports.__inject__ = function (context) {
  add("8d90fc72", content, true, context);
};

/***/ }),
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

// style-loader: Adds some css to the DOM by adding a <style> tag

// load the styles
var content = __webpack_require__(19);
if(typeof content === 'string') content = [[module.i, content, '']];
if(content.locals) module.exports = content.locals;
// add CSS to SSR context
var add = __webpack_require__(7).default;
module.exports.__inject__ = function (context) {
  add("019e1cef", content, true, context);
};

/***/ }),
/* 11 */
/***/ (function(module, exports, __webpack_require__) {

// style-loader: Adds some css to the DOM by adding a <style> tag

// load the styles
var content = __webpack_require__(21);
if(typeof content === 'string') content = [[module.i, content, '']];
if(content.locals) module.exports = content.locals;
// add CSS to SSR context
var add = __webpack_require__(7).default;
module.exports.__inject__ = function (context) {
  add("932a8f60", content, true, context);
};

/***/ }),
/* 12 */
/***/ (function(module, exports) {

module.exports = require$$6__default['default'];

/***/ }),
/* 13 */
/***/ (function(module, exports) {

module.exports = server$1.require$$7;

/***/ }),
/* 14 */
/***/ (function(module, exports) {

module.exports = vueMeta_common;

/***/ }),
/* 15 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(27);


/***/ }),
/* 16 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _vue_style_loader_index_js_ref_3_oneOf_1_0_css_loader_dist_cjs_js_ref_3_oneOf_1_1_vue_loader_lib_loaders_stylePostLoader_js_postcss_loader_src_index_js_ref_3_oneOf_1_2_vue_loader_lib_index_js_vue_loader_options_nuxt_error_vue_vue_type_style_index_0_lang_css___WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9);
/* harmony import */ /*#__PURE__*/__webpack_require__.n(_vue_style_loader_index_js_ref_3_oneOf_1_0_css_loader_dist_cjs_js_ref_3_oneOf_1_1_vue_loader_lib_loaders_stylePostLoader_js_postcss_loader_src_index_js_ref_3_oneOf_1_2_vue_loader_lib_index_js_vue_loader_options_nuxt_error_vue_vue_type_style_index_0_lang_css___WEBPACK_IMPORTED_MODULE_0__);
/* harmony reexport (unknown) */ for(var __WEBPACK_IMPORT_KEY__ in _vue_style_loader_index_js_ref_3_oneOf_1_0_css_loader_dist_cjs_js_ref_3_oneOf_1_1_vue_loader_lib_loaders_stylePostLoader_js_postcss_loader_src_index_js_ref_3_oneOf_1_2_vue_loader_lib_index_js_vue_loader_options_nuxt_error_vue_vue_type_style_index_0_lang_css___WEBPACK_IMPORTED_MODULE_0__) if(["default"].indexOf(__WEBPACK_IMPORT_KEY__) < 0) (function(key) { __webpack_require__.d(__webpack_exports__, key, function() { return _vue_style_loader_index_js_ref_3_oneOf_1_0_css_loader_dist_cjs_js_ref_3_oneOf_1_1_vue_loader_lib_loaders_stylePostLoader_js_postcss_loader_src_index_js_ref_3_oneOf_1_2_vue_loader_lib_index_js_vue_loader_options_nuxt_error_vue_vue_type_style_index_0_lang_css___WEBPACK_IMPORTED_MODULE_0__[key]; }); }(__WEBPACK_IMPORT_KEY__));


/***/ }),
/* 17 */
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(6);
exports = ___CSS_LOADER_API_IMPORT___(false);
// Module
exports.push([module.i, ".__nuxt-error-page{padding:1rem;background:#f7f8fb;color:#47494e;text-align:center;display:flex;justify-content:center;align-items:center;flex-direction:column;font-family:sans-serif;font-weight:100!important;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;-webkit-font-smoothing:antialiased;position:absolute;top:0;left:0;right:0;bottom:0}.__nuxt-error-page .error{max-width:450px}.__nuxt-error-page .title{font-size:1.5rem;margin-top:15px;color:#47494e;margin-bottom:8px}.__nuxt-error-page .description{color:#7f828b;line-height:21px;margin-bottom:10px}.__nuxt-error-page a{color:#7f828b!important;text-decoration:none}.__nuxt-error-page .logo{position:fixed;left:12px;bottom:12px}", ""]);
// Exports
module.exports = exports;


/***/ }),
/* 18 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _vue_style_loader_index_js_ref_3_oneOf_1_0_css_loader_dist_cjs_js_ref_3_oneOf_1_1_vue_loader_lib_loaders_stylePostLoader_js_postcss_loader_src_index_js_ref_3_oneOf_1_2_vue_loader_lib_index_js_vue_loader_options_nuxt_loading_vue_vue_type_style_index_0_lang_css___WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(10);
/* harmony import */ /*#__PURE__*/__webpack_require__.n(_vue_style_loader_index_js_ref_3_oneOf_1_0_css_loader_dist_cjs_js_ref_3_oneOf_1_1_vue_loader_lib_loaders_stylePostLoader_js_postcss_loader_src_index_js_ref_3_oneOf_1_2_vue_loader_lib_index_js_vue_loader_options_nuxt_loading_vue_vue_type_style_index_0_lang_css___WEBPACK_IMPORTED_MODULE_0__);
/* harmony reexport (unknown) */ for(var __WEBPACK_IMPORT_KEY__ in _vue_style_loader_index_js_ref_3_oneOf_1_0_css_loader_dist_cjs_js_ref_3_oneOf_1_1_vue_loader_lib_loaders_stylePostLoader_js_postcss_loader_src_index_js_ref_3_oneOf_1_2_vue_loader_lib_index_js_vue_loader_options_nuxt_loading_vue_vue_type_style_index_0_lang_css___WEBPACK_IMPORTED_MODULE_0__) if(["default"].indexOf(__WEBPACK_IMPORT_KEY__) < 0) (function(key) { __webpack_require__.d(__webpack_exports__, key, function() { return _vue_style_loader_index_js_ref_3_oneOf_1_0_css_loader_dist_cjs_js_ref_3_oneOf_1_1_vue_loader_lib_loaders_stylePostLoader_js_postcss_loader_src_index_js_ref_3_oneOf_1_2_vue_loader_lib_index_js_vue_loader_options_nuxt_loading_vue_vue_type_style_index_0_lang_css___WEBPACK_IMPORTED_MODULE_0__[key]; }); }(__WEBPACK_IMPORT_KEY__));


/***/ }),
/* 19 */
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(6);
exports = ___CSS_LOADER_API_IMPORT___(false);
// Module
exports.push([module.i, ".nuxt-progress{position:fixed;top:0;left:0;right:0;height:2px;width:0;opacity:1;transition:width .1s,opacity .4s;background-color:#000;z-index:999999}.nuxt-progress.nuxt-progress-notransition{transition:none}.nuxt-progress-failed{background-color:red}", ""]);
// Exports
module.exports = exports;


/***/ }),
/* 20 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_vue_style_loader_index_js_ref_3_oneOf_1_0_node_modules_css_loader_dist_cjs_js_ref_3_oneOf_1_1_node_modules_vue_loader_lib_loaders_stylePostLoader_js_node_modules_postcss_loader_src_index_js_ref_3_oneOf_1_2_node_modules_vue_loader_lib_index_js_vue_loader_options_default_vue_vue_type_style_index_0_lang_css___WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(11);
/* harmony import */ /*#__PURE__*/__webpack_require__.n(_node_modules_vue_style_loader_index_js_ref_3_oneOf_1_0_node_modules_css_loader_dist_cjs_js_ref_3_oneOf_1_1_node_modules_vue_loader_lib_loaders_stylePostLoader_js_node_modules_postcss_loader_src_index_js_ref_3_oneOf_1_2_node_modules_vue_loader_lib_index_js_vue_loader_options_default_vue_vue_type_style_index_0_lang_css___WEBPACK_IMPORTED_MODULE_0__);
/* harmony reexport (unknown) */ for(var __WEBPACK_IMPORT_KEY__ in _node_modules_vue_style_loader_index_js_ref_3_oneOf_1_0_node_modules_css_loader_dist_cjs_js_ref_3_oneOf_1_1_node_modules_vue_loader_lib_loaders_stylePostLoader_js_node_modules_postcss_loader_src_index_js_ref_3_oneOf_1_2_node_modules_vue_loader_lib_index_js_vue_loader_options_default_vue_vue_type_style_index_0_lang_css___WEBPACK_IMPORTED_MODULE_0__) if(["default"].indexOf(__WEBPACK_IMPORT_KEY__) < 0) (function(key) { __webpack_require__.d(__webpack_exports__, key, function() { return _node_modules_vue_style_loader_index_js_ref_3_oneOf_1_0_node_modules_css_loader_dist_cjs_js_ref_3_oneOf_1_1_node_modules_vue_loader_lib_loaders_stylePostLoader_js_node_modules_postcss_loader_src_index_js_ref_3_oneOf_1_2_node_modules_vue_loader_lib_index_js_vue_loader_options_default_vue_vue_type_style_index_0_lang_css___WEBPACK_IMPORTED_MODULE_0__[key]; }); }(__WEBPACK_IMPORT_KEY__));


/***/ }),
/* 21 */
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(6);
exports = ___CSS_LOADER_API_IMPORT___(false);
// Module
exports.push([module.i, "html{font-family:\"Source Sans Pro\",-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,\"Helvetica Neue\",Arial,sans-serif;font-size:16px;word-spacing:1px;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;box-sizing:border-box}*,:after,:before{box-sizing:border-box;margin:0}.button--green{display:inline-block;border-radius:4px;border:1px solid #3b8070;color:#3b8070;text-decoration:none;padding:10px 30px}.button--green:hover{color:#fff;background-color:#3b8070}.button--grey{display:inline-block;border-radius:4px;border:1px solid #35495e;color:#35495e;text-decoration:none;padding:10px 30px;margin-left:15px}.button--grey:hover{color:#fff;background-color:#35495e}", ""]);
// Exports
module.exports = exports;


/***/ }),
/* 22 */
/***/ (function(module, exports) {

module.exports = compositionApi;

/***/ }),
/* 23 */
/***/ (function(module, exports) {

module.exports = defu_1;

/***/ }),
/* 24 */
/***/ (function(module, exports) {

module.exports = Co__default['default'];

/***/ }),
/* 25 */
/***/ (function(module, exports) {

module.exports = po__default['default'];

/***/ }),
/* 26 */
/***/ (function(module, exports) {

// This file is intentionally left empty for noop aliases

/***/ }),
/* 27 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXTERNAL MODULE: external "querystring"
var external_querystring_ = __webpack_require__(12);

// EXTERNAL MODULE: external "vue"
var external_vue_ = __webpack_require__(0);
var external_vue_default = /*#__PURE__*/__webpack_require__.n(external_vue_);

// EXTERNAL MODULE: external "@nuxt/ufo"
var ufo_ = __webpack_require__(1);

// EXTERNAL MODULE: external "node-fetch"
var external_node_fetch_ = __webpack_require__(13);
var external_node_fetch_default = /*#__PURE__*/__webpack_require__.n(external_node_fetch_);

// CONCATENATED MODULE: ./node_modules/.cache/nuxt/middleware.js
const middleware = {};
/* harmony default export */ var nuxt_middleware = (middleware);
function globalHandleError(error) {
  if (external_vue_default.a.config.errorHandler) {
    external_vue_default.a.config.errorHandler(error);
  }
}
function interopDefault(promise) {
  return promise.then(m => m.default || m);
}
function hasFetch(vm) {
  return vm.$options && typeof vm.$options.fetch === 'function' && !vm.$options.fetch.length;
}
function purifyData(data) {
  {
    return data;
  }
}
function getChildrenComponentInstancesUsingFetch(vm, instances = []) {
  const children = vm.$children || [];

  for (const child of children) {
    if (child.$fetch) {
      instances.push(child);
      continue; // Don't get the children since it will reload the template
    }

    if (child.$children) {
      getChildrenComponentInstancesUsingFetch(child, instances);
    }
  }

  return instances;
}
function applyAsyncData(Component, asyncData) {
  if ( // For SSR, we once all this function without second param to just apply asyncData
  // Prevent doing this for each SSR request
  !asyncData && Component.options.__hasNuxtData) {
    return;
  }

  const ComponentData = Component.options._originDataFn || Component.options.data || function () {
    return {};
  };

  Component.options._originDataFn = ComponentData;

  Component.options.data = function () {
    const data = ComponentData.call(this, this);

    if (this.$ssrContext) {
      asyncData = this.$ssrContext.asyncData[Component.cid];
    }

    return { ...data,
      ...asyncData
    };
  };

  Component.options.__hasNuxtData = true;

  if (Component._Ctor && Component._Ctor.options) {
    Component._Ctor.options.data = Component.options.data;
  }
}
function sanitizeComponent(Component) {
  // If Component already sanitized
  if (Component.options && Component._Ctor === Component) {
    return Component;
  }

  if (!Component.options) {
    Component = external_vue_default.a.extend(Component); // fix issue #6

    Component._Ctor = Component;
  } else {
    Component._Ctor = Component;
    Component.extendOptions = Component.options;
  } // If no component name defined, set file path as name, (also fixes #5703)


  if (!Component.options.name && Component.options.__file) {
    Component.options.name = Component.options.__file;
  }

  return Component;
}
function getMatchedComponents(route, matches = false, prop = 'components') {
  return Array.prototype.concat.apply([], route.matched.map((m, index) => {
    return Object.keys(m[prop]).map(key => {
      matches && matches.push(index);
      return m[prop][key];
    });
  }));
}
function getMatchedComponentsInstances(route, matches = false) {
  return getMatchedComponents(route, matches, 'instances');
}
function flatMapComponents(route, fn) {
  return Array.prototype.concat.apply([], route.matched.map((m, index) => {
    return Object.keys(m.components).reduce((promises, key) => {
      if (m.components[key]) {
        promises.push(fn(m.components[key], m.instances[key], m, key, index));
      } else {
        delete m.components[key];
      }

      return promises;
    }, []);
  }));
}
function resolveRouteComponents(route, fn) {
  return Promise.all(flatMapComponents(route, async (Component, instance, match, key) => {
    // If component is a function, resolve it
    if (typeof Component === 'function' && !Component.options) {
      Component = await Component();
    }

    match.components[key] = Component = sanitizeComponent(Component);
    return typeof fn === 'function' ? fn(Component, instance, match, key) : Component;
  }));
}
async function getRouteData(route) {
  if (!route) {
    return;
  } // Make sure the components are resolved (code-splitting)


  await resolveRouteComponents(route); // Send back a copy of route with meta based on Component definition

  return { ...route,
    meta: getMatchedComponents(route).map((Component, index) => {
      return { ...Component.options.meta,
        ...(route.matched[index] || {}).meta
      };
    })
  };
}
async function setContext(app, context) {
  // If context not defined, create it
  if (!app.context) {
    app.context = {
      isStatic: true,
      isDev: false,
      isHMR: false,
      app,
      payload: context.payload,
      error: context.error,
      base: '/',
      env: {
        "NITRO_PRESET": "server"
      }
    }; // Only set once

    if (context.ssrContext) {
      app.context.ssrContext = context.ssrContext;
    }

    app.context.redirect = (status, path, query) => {
      if (!status) {
        return;
      }

      app.context._redirected = true; // if only 1 or 2 arguments: redirect('/') or redirect('/', { foo: 'bar' })

      let pathType = typeof path;

      if (typeof status !== 'number' && (pathType === 'undefined' || pathType === 'object')) {
        query = path || {};
        path = status;
        pathType = typeof path;
        status = 302;
      }

      if (pathType === 'object') {
        path = app.router.resolve(path).route.fullPath;
      } // "/absolute/route", "./relative/route" or "../relative/route"


      if (/(^[.]{1,2}\/)|(^\/(?!\/))/.test(path)) {
        app.context.next({
          path,
          query,
          status
        });
      } else {
        path = formatUrl(path, query);

        {
          app.context.next({
            path,
            status
          });
        }
      }
    };

    {
      app.context.beforeNuxtRender = fn => context.beforeRenderFns.push(fn);
    }
  } // Dynamic keys


  const [currentRouteData, fromRouteData] = await Promise.all([getRouteData(context.route), getRouteData(context.from)]);

  if (context.route) {
    app.context.route = currentRouteData;
  }

  if (context.from) {
    app.context.from = fromRouteData;
  }

  app.context.next = context.next;
  app.context._redirected = false;
  app.context._errored = false;
  app.context.isHMR = false;
  app.context.params = app.context.route.params || {};
  app.context.query = app.context.route.query || {};
}
function middlewareSeries(promises, appContext) {
  if (!promises.length || appContext._redirected || appContext._errored) {
    return Promise.resolve();
  }

  return promisify(promises[0], appContext).then(() => {
    return middlewareSeries(promises.slice(1), appContext);
  });
}
function promisify(fn, context) {
  let promise;

  if (fn.length === 2) {
    // fn(context, callback)
    promise = new Promise(resolve => {
      fn(context, function (err, data) {
        if (err) {
          context.error(err);
        }

        data = data || {};
        resolve(data);
      });
    });
  } else {
    promise = fn(context);
  }

  if (promise && promise instanceof Promise && typeof promise.then === 'function') {
    return promise;
  }

  return Promise.resolve(promise);
} // Imported from vue-router

function getLocation(base, mode) {
  if (mode === 'hash') {
    return window.location.hash.replace(/^#\//, '');
  }

  base = decodeURI(base).slice(0, -1); // consideration is base is normalized with trailing slash

  let path = decodeURI(window.location.pathname);

  if (base && path.startsWith(base)) {
    path = path.slice(base.length);
  }

  const fullPath = (path || '/') + window.location.search + window.location.hash;
  return Object(ufo_["normalizeURL"])(fullPath);
} // Imported from path-to-regexp

/**
 * Compile a string to a template function for the path.
 *
 * @param  {string}             str
 * @param  {Object=}            options
 * @return {!function(Object=, Object=)}
 */

function compile(str, options) {
  return tokensToFunction(parse(str, options), options);
}
function normalizeError(err) {
  let message;

  if (!(err.message || typeof err === 'string')) {
    try {
      message = JSON.stringify(err, null, 2);
    } catch (e) {
      message = `[${err.constructor.name}]`;
    }
  } else {
    message = err.message || err;
  }

  return { ...err,
    message,
    statusCode: err.statusCode || err.status || err.response && err.response.status || 500
  };
}
/**
 * The main path matching regexp utility.
 *
 * @type {RegExp}
 */

const PATH_REGEXP = new RegExp([// Match escaped characters that would otherwise appear in future matches.
// This allows the user to escape special characters that won't transform.
'(\\\\.)', // Match Express-style parameters and un-named parameters with a prefix
// and optional suffixes. Matches appear as:
//
// "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?", undefined]
// "/route(\\d+)"  => [undefined, undefined, undefined, "\d+", undefined, undefined]
// "/*"            => ["/", undefined, undefined, undefined, undefined, "*"]
'([\\/.])?(?:(?:\\:(\\w+)(?:\\(((?:\\\\.|[^\\\\()])+)\\))?|\\(((?:\\\\.|[^\\\\()])+)\\))([+*?])?|(\\*))'].join('|'), 'g');
/**
 * Parse a string for the raw tokens.
 *
 * @param  {string}  str
 * @param  {Object=} options
 * @return {!Array}
 */

function parse(str, options) {
  const tokens = [];
  let key = 0;
  let index = 0;
  let path = '';
  const defaultDelimiter = options && options.delimiter || '/';
  let res;

  while ((res = PATH_REGEXP.exec(str)) != null) {
    const m = res[0];
    const escaped = res[1];
    const offset = res.index;
    path += str.slice(index, offset);
    index = offset + m.length; // Ignore already escaped sequences.

    if (escaped) {
      path += escaped[1];
      continue;
    }

    const next = str[index];
    const prefix = res[2];
    const name = res[3];
    const capture = res[4];
    const group = res[5];
    const modifier = res[6];
    const asterisk = res[7]; // Push the current path onto the tokens.

    if (path) {
      tokens.push(path);
      path = '';
    }

    const partial = prefix != null && next != null && next !== prefix;
    const repeat = modifier === '+' || modifier === '*';
    const optional = modifier === '?' || modifier === '*';
    const delimiter = res[2] || defaultDelimiter;
    const pattern = capture || group;
    tokens.push({
      name: name || key++,
      prefix: prefix || '',
      delimiter,
      optional,
      repeat,
      partial,
      asterisk: Boolean(asterisk),
      pattern: pattern ? escapeGroup(pattern) : asterisk ? '.*' : '[^' + escapeString(delimiter) + ']+?'
    });
  } // Match any characters still remaining.


  if (index < str.length) {
    path += str.substr(index);
  } // If the path exists, push it onto the end.


  if (path) {
    tokens.push(path);
  }

  return tokens;
}
/**
 * Prettier encoding of URI path segments.
 *
 * @param  {string}
 * @return {string}
 */


function encodeURIComponentPretty(str, slashAllowed) {
  const re = slashAllowed ? /[?#]/g : /[/?#]/g;
  return encodeURI(str).replace(re, c => {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase();
  });
}
/**
 * Encode the asterisk parameter. Similar to `pretty`, but allows slashes.
 *
 * @param  {string}
 * @return {string}
 */


function encodeAsterisk(str) {
  return encodeURIComponentPretty(str, true);
}
/**
 * Escape a regular expression string.
 *
 * @param  {string} str
 * @return {string}
 */


function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, '\\$1');
}
/**
 * Escape the capturing group by escaping special characters and meaning.
 *
 * @param  {string} group
 * @return {string}
 */


function escapeGroup(group) {
  return group.replace(/([=!:$/()])/g, '\\$1');
}
/**
 * Expose a method for transforming tokens into the path function.
 */


function tokensToFunction(tokens, options) {
  // Compile all the tokens into regexps.
  const matches = new Array(tokens.length); // Compile all the patterns before compilation.

  for (let i = 0; i < tokens.length; i++) {
    if (typeof tokens[i] === 'object') {
      matches[i] = new RegExp('^(?:' + tokens[i].pattern + ')$', flags(options));
    }
  }

  return function (obj, opts) {
    let path = '';
    const data = obj || {};
    const options = opts || {};
    const encode = options.pretty ? encodeURIComponentPretty : encodeURIComponent;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (typeof token === 'string') {
        path += token;
        continue;
      }

      const value = data[token.name || 'pathMatch'];
      let segment;

      if (value == null) {
        if (token.optional) {
          // Prepend partial segment prefixes.
          if (token.partial) {
            path += token.prefix;
          }

          continue;
        } else {
          throw new TypeError('Expected "' + token.name + '" to be defined');
        }
      }

      if (Array.isArray(value)) {
        if (!token.repeat) {
          throw new TypeError('Expected "' + token.name + '" to not repeat, but received `' + JSON.stringify(value) + '`');
        }

        if (value.length === 0) {
          if (token.optional) {
            continue;
          } else {
            throw new TypeError('Expected "' + token.name + '" to not be empty');
          }
        }

        for (let j = 0; j < value.length; j++) {
          segment = encode(value[j]);

          if (!matches[i].test(segment)) {
            throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '", but received `' + JSON.stringify(segment) + '`');
          }

          path += (j === 0 ? token.prefix : token.delimiter) + segment;
        }

        continue;
      }

      segment = token.asterisk ? encodeAsterisk(value) : encode(value);

      if (!matches[i].test(segment)) {
        throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"');
      }

      path += token.prefix + segment;
    }

    return path;
  };
}
/**
 * Get the flags for a regexp from the options.
 *
 * @param  {Object} options
 * @return {string}
 */


function flags(options) {
  return options && options.sensitive ? '' : 'i';
}
/**
 * Format given url, append query to url query string
 *
 * @param  {string} url
 * @param  {string} query
 * @return {string}
 */


function formatUrl(url, query) {
  let protocol;
  const index = url.indexOf('://');

  if (index !== -1) {
    protocol = url.substring(0, index);
    url = url.substring(index + 3);
  } else if (url.startsWith('//')) {
    url = url.substring(2);
  }

  let parts = url.split('/');
  let result = (protocol ? protocol + '://' : '//') + parts.shift();
  let path = parts.join('/');

  if (path === '' && parts.length === 1) {
    result += '/';
  }

  let hash;
  parts = path.split('#');

  if (parts.length === 2) {
    [path, hash] = parts;
  }

  result += path ? '/' + path : '';

  if (query && JSON.stringify(query) !== '{}') {
    result += (url.split('?').length === 2 ? '&' : '?') + formatQuery(query);
  }

  result += hash ? '#' + hash : '';
  return result;
}
/**
 * Transform data object to query string
 *
 * @param  {object} query
 * @return {string}
 */


function formatQuery(query) {
  return Object.keys(query).sort().map(key => {
    const val = query[key];

    if (val == null) {
      return '';
    }

    if (Array.isArray(val)) {
      return val.slice().map(val2 => [key, '=', val2].join('')).join('&');
    }

    return key + '=' + val;
  }).filter(Boolean).join('&');
}

function addLifecycleHook(vm, hook, fn) {
  if (!vm.$options[hook]) {
    vm.$options[hook] = [];
  }

  if (!vm.$options[hook].includes(fn)) {
    vm.$options[hook].push(fn);
  }
}
function urlJoin() {
  return [].slice.call(arguments).join('/').replace(/\/+/g, '/').replace(':/', '://');
}
// CONCATENATED MODULE: ./node_modules/.cache/nuxt/mixins/fetch.server.js



async function serverPrefetch() {
  if (!this._fetchOnServer) {
    return;
  } // Call and await on $fetch


  try {
    await this.$options.fetch.call(this);
  } catch (err) {

    this.$fetchState.error = normalizeError(err);
  }

  this.$fetchState.pending = false; // Define an ssrKey for hydration

  this._fetchKey = this.$ssrContext.nuxt.fetch.length; // Add data-fetch-key on parent element of Component

  const attrs = this.$vnode.data.attrs = this.$vnode.data.attrs || {};
  attrs['data-fetch-key'] = this._fetchKey; // Add to ssrContext for window.__NUXT__.fetch

  this.$ssrContext.nuxt.fetch.push(this.$fetchState.error ? {
    _error: this.$fetchState.error
  } : purifyData(this._data));
}

/* harmony default export */ var fetch_server = ({
  created() {
    if (!hasFetch(this)) {
      return;
    }

    if (typeof this.$options.fetchOnServer === 'function') {
      this._fetchOnServer = this.$options.fetchOnServer.call(this) !== false;
    } else {
      this._fetchOnServer = this.$options.fetchOnServer !== false;
    } // Added for remove vue undefined warning while ssr


    this.$fetch = () => {}; // issue #8043


    external_vue_default.a.util.defineReactive(this, '$fetchState', {
      pending: true,
      error: null,
      timestamp: Date.now()
    });
    addLifecycleHook(this, 'serverPrefetch', serverPrefetch);
  }

});
// EXTERNAL MODULE: external "vue-meta"
var external_vue_meta_ = __webpack_require__(14);
var external_vue_meta_default = /*#__PURE__*/__webpack_require__.n(external_vue_meta_);

// EXTERNAL MODULE: external "vue-client-only"
var external_vue_client_only_ = __webpack_require__(8);
var external_vue_client_only_default = /*#__PURE__*/__webpack_require__.n(external_vue_client_only_);

// EXTERNAL MODULE: external "vue-no-ssr"
var external_vue_no_ssr_ = __webpack_require__(5);
var external_vue_no_ssr_default = /*#__PURE__*/__webpack_require__.n(external_vue_no_ssr_);

// EXTERNAL MODULE: external "vue-router"
var external_vue_router_ = __webpack_require__(3);
var external_vue_router_default = /*#__PURE__*/__webpack_require__.n(external_vue_router_);

/* harmony default export */ var router_scrollBehavior = (function (to, from, savedPosition) {
  // If the returned position is falsy or an empty object, will retain current scroll position
  let position = false;
  const Pages = getMatchedComponents(to); // Scroll to the top of the page if...

  if ( // One of the children set `scrollToTop`
  Pages.some(Page => Page.options.scrollToTop) || // scrollToTop set in only page without children
  Pages.length < 2 && Pages.every(Page => Page.options.scrollToTop !== false)) {
    position = {
      x: 0,
      y: 0
    };
  } // savedPosition is only available for popstate navigations (back button)


  if (savedPosition) {
    position = savedPosition;
  }

  const nuxt = window.$nuxt;

  if ( // Route hash changes
  to.path === from.path && to.hash !== from.hash || // Initial load (vuejs/vue-router#3199)
  to === from) {
    nuxt.$nextTick(() => nuxt.$emit('triggerScroll'));
  }

  return new Promise(resolve => {
    // wait for the out transition to complete (if necessary)
    nuxt.$once('triggerScroll', () => {
      // coords will be used if no selector is provided,
      // or if the selector didn't match any element.
      if (to.hash) {
        let hash = to.hash; // CSS.escape() is not supported with IE and Edge.

        if ("undefined".CSS !== 'undefined' && "undefined".CSS.escape !== 'undefined') {
          hash = '#' + window.CSS.escape(hash.substr(1));
        }

        try {
          if (document.querySelector(hash)) {
            // scroll to anchor by returning the selector
            position = {
              selector: hash
            };
          }
        } catch (e) {
          console.warn('Failed to save scroll position. Please add CSS.escape() polyfill (https://github.com/mathiasbynens/CSS.escape).');
        }
      }

      resolve(position);
    });
  });
});
// CONCATENATED MODULE: ./node_modules/.cache/nuxt/router.js






const _0cfebf24 = () => interopDefault(__webpack_require__.e(/* import() | pages/index */ 1).then(__webpack_require__.bind(null, 31))); // TODO: remove in Nuxt 3


const emptyFn = () => {};

const originalPush = external_vue_router_default.a.prototype.push;

external_vue_router_default.a.prototype.push = function push(location, onComplete = emptyFn, onAbort) {
  return originalPush.call(this, location, onComplete, onAbort);
};

external_vue_default.a.use(external_vue_router_default.a);
const routerOptions = {
  mode: 'history',
  base: '/',
  linkActiveClass: 'nuxt-link-active',
  linkExactActiveClass: 'nuxt-link-exact-active',
  scrollBehavior: router_scrollBehavior,
  routes: [{
    path: "/",
    component: _0cfebf24,
    name: "index"
  }],
  fallback: false
};

function decodeObj(obj) {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      obj[key] = Object(ufo_["decode"])(obj[key]);
    }
  }
}

function createRouter() {
  const router = new external_vue_router_default.a(routerOptions);
  const resolve = router.resolve.bind(router);

  router.resolve = (to, current, append) => {
    if (typeof to === 'string') {
      to = Object(ufo_["normalizeURL"])(to);
    }

    const r = resolve(to, current, append);

    if (r && r.resolved && r.resolved.query) {
      decodeObj(r.resolved.query);
    }

    return r;
  };

  return router;
}
// CONCATENATED MODULE: ./node_modules/.cache/nuxt/components/nuxt-child.js
/* harmony default export */ var nuxt_child = ({
  name: 'NuxtChild',
  functional: true,
  props: {
    nuxtChildKey: {
      type: String,
      default: ''
    },
    keepAlive: Boolean,
    keepAliveProps: {
      type: Object,
      default: undefined
    }
  },

  render(_, {
    parent,
    data,
    props
  }) {
    const h = parent.$createElement;
    data.nuxtChild = true;
    const _parent = parent;
    const transitions = parent.$nuxt.nuxt.transitions;
    const defaultTransition = parent.$nuxt.nuxt.defaultTransition;
    let depth = 0;

    while (parent) {
      if (parent.$vnode && parent.$vnode.data.nuxtChild) {
        depth++;
      }

      parent = parent.$parent;
    }

    data.nuxtChildDepth = depth;
    const transition = transitions[depth] || defaultTransition;
    const transitionProps = {};
    transitionsKeys.forEach(key => {
      if (typeof transition[key] !== 'undefined') {
        transitionProps[key] = transition[key];
      }
    });
    const listeners = {};
    listenersKeys.forEach(key => {
      if (typeof transition[key] === 'function') {
        listeners[key] = transition[key].bind(_parent);
      }
    });


    if (transition.css === false) {
      const leave = listeners.leave; // only add leave listener when user didnt provide one
      // or when it misses the done argument

      if (!leave || leave.length < 2) {
        listeners.leave = (el, done) => {
          if (leave) {
            leave.call(_parent, el);
          }

          _parent.$nextTick(done);
        };
      }
    }

    let routerView = h('routerView', data);

    if (props.keepAlive) {
      routerView = h('keep-alive', {
        props: props.keepAliveProps
      }, [routerView]);
    }

    return h('transition', {
      props: transitionProps,
      on: listeners
    }, [routerView]);
  }

});
const transitionsKeys = ['name', 'mode', 'appear', 'css', 'type', 'duration', 'enterClass', 'leaveClass', 'appearClass', 'enterActiveClass', 'enterActiveClass', 'leaveActiveClass', 'appearActiveClass', 'enterToClass', 'leaveToClass', 'appearToClass'];
const listenersKeys = ['beforeEnter', 'enter', 'afterEnter', 'enterCancelled', 'beforeLeave', 'leave', 'afterLeave', 'leaveCancelled', 'beforeAppear', 'appear', 'afterAppear', 'appearCancelled'];
// CONCATENATED MODULE: ./node_modules/vue-loader/lib/loaders/templateLoader.js??vue-loader-options!./node_modules/vue-loader/lib??vue-loader-options!./node_modules/.cache/nuxt/components/nuxt-error.vue?vue&type=template&id=608a1420&
var render = function () {var _vm=this;var _h=_vm.$createElement;var _c=_vm._self._c||_h;return _c('div',{staticClass:"__nuxt-error-page"},[_vm._ssrNode("<div class=\"error\">","</div>",[_vm._ssrNode("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"90\" height=\"90\" fill=\"#DBE1EC\" viewBox=\"0 0 48 48\"><path d=\"M22 30h4v4h-4zm0-16h4v12h-4zm1.99-10C12.94 4 4 12.95 4 24s8.94 20 19.99 20S44 35.05 44 24 35.04 4 23.99 4zM24 40c-8.84 0-16-7.16-16-16S15.16 8 24 8s16 7.16 16 16-7.16 16-16 16z\"></path></svg> <div class=\"title\">"+_vm._ssrEscape(_vm._s(_vm.message))+"</div> "),(_vm.statusCode === 404)?_vm._ssrNode("<p class=\"description\">","</p>",[(typeof _vm.$route === 'undefined')?_vm._ssrNode("<a href=\"/\" class=\"error-link\">","</a>"):_c('NuxtLink',{staticClass:"error-link",attrs:{"to":"/"}},[_vm._v("Back to the home page")])],1):_vm._e(),_vm._ssrNode(" <div class=\"logo\"><a href=\"https://nuxtjs.org\" target=\"_blank\" rel=\"noopener\">Nuxt</a></div>")],2)])};
var staticRenderFns = [];


// CONCATENATED MODULE: ./node_modules/.cache/nuxt/components/nuxt-error.vue?vue&type=template&id=608a1420&

// CONCATENATED MODULE: ./node_modules/babel-loader/lib??ref--2-0!./node_modules/vue-loader/lib??vue-loader-options!./node_modules/.cache/nuxt/components/nuxt-error.vue?vue&type=script&lang=js&
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
/* harmony default export */ var nuxt_errorvue_type_script_lang_js_ = ({
  name: 'NuxtError',
  props: {
    error: {
      type: Object,
      default: null
    }
  },
  computed: {
    statusCode() {
      return this.error && this.error.statusCode || 500;
    },

    message() {
      return this.error.message || 'Error';
    }

  },

  head() {
    return {
      title: this.message,
      meta: [{
        name: 'viewport',
        content: 'width=device-width,initial-scale=1.0,minimum-scale=1.0'
      }]
    };
  }

});
// CONCATENATED MODULE: ./node_modules/.cache/nuxt/components/nuxt-error.vue?vue&type=script&lang=js&
 /* harmony default export */ var components_nuxt_errorvue_type_script_lang_js_ = (nuxt_errorvue_type_script_lang_js_); 
// EXTERNAL MODULE: ./node_modules/vue-loader/lib/runtime/componentNormalizer.js
var componentNormalizer = __webpack_require__(2);

// CONCATENATED MODULE: ./node_modules/.cache/nuxt/components/nuxt-error.vue



function injectStyles (context) {
  
  var style0 = __webpack_require__(16);
if (style0.__inject__) style0.__inject__(context);

}

/* normalize component */

var nuxt_error_component = Object(componentNormalizer["a" /* default */])(
  components_nuxt_errorvue_type_script_lang_js_,
  render,
  staticRenderFns,
  false,
  injectStyles,
  null,
  "396e363a"
  
);

/* harmony default export */ var nuxt_error = (nuxt_error_component.exports);
// CONCATENATED MODULE: ./node_modules/.cache/nuxt/components/nuxt.js




/* harmony default export */ var components_nuxt = ({
  name: 'Nuxt',
  components: {
    NuxtChild: nuxt_child,
    NuxtError: nuxt_error
  },
  props: {
    nuxtChildKey: {
      type: String,
      default: undefined
    },
    keepAlive: Boolean,
    keepAliveProps: {
      type: Object,
      default: undefined
    },
    name: {
      type: String,
      default: 'default'
    }
  },

  errorCaptured(error) {
    // if we receive and error while showing the NuxtError component
    // capture the error and force an immediate update so we re-render
    // without the NuxtError component
    if (this.displayingNuxtError) {
      this.errorFromNuxtError = error;
      this.$forceUpdate();
    }
  },

  computed: {
    routerViewKey() {
      // If nuxtChildKey prop is given or current route has children
      if (typeof this.nuxtChildKey !== 'undefined' || this.$route.matched.length > 1) {
        return this.nuxtChildKey || compile(this.$route.matched[0].path)(this.$route.params);
      }

      const [matchedRoute] = this.$route.matched;

      if (!matchedRoute) {
        return this.$route.path;
      }

      const Component = matchedRoute.components.default;

      if (Component && Component.options) {
        const {
          options
        } = Component;

        if (options.key) {
          return typeof options.key === 'function' ? options.key(this.$route) : options.key;
        }
      }

      const strict = /\/$/.test(matchedRoute.path);
      return strict ? this.$route.path : this.$route.path.replace(/\/$/, '');
    }

  },

  beforeCreate() {
    external_vue_default.a.util.defineReactive(this, 'nuxt', this.$root.$options.nuxt);
  },

  render(h) {
    // if there is no error
    if (!this.nuxt.err) {
      // Directly return nuxt child
      return h('NuxtChild', {
        key: this.routerViewKey,
        props: this.$props
      });
    } // if an error occurred within NuxtError show a simple
    // error message instead to prevent looping


    if (this.errorFromNuxtError) {
      this.$nextTick(() => this.errorFromNuxtError = false);
      return h('div', {}, [h('h2', 'An error occurred while showing the error page'), h('p', 'Unfortunately an error occurred and while showing the error page another error occurred'), h('p', `Error details: ${this.errorFromNuxtError.toString()}`), h('nuxt-link', {
        props: {
          to: '/'
        }
      }, 'Go back to home')]);
    } // track if we are showing the NuxtError component


    this.displayingNuxtError = true;
    this.$nextTick(() => this.displayingNuxtError = false);
    return h(nuxt_error, {
      props: {
        error: this.nuxt.err
      }
    });
  }

});
// CONCATENATED MODULE: ./node_modules/babel-loader/lib??ref--2-0!./node_modules/vue-loader/lib??vue-loader-options!./node_modules/.cache/nuxt/components/nuxt-loading.vue?vue&type=script&lang=js&
/* harmony default export */ var nuxt_loadingvue_type_script_lang_js_ = ({
  name: 'NuxtLoading',

  data() {
    return {
      percent: 0,
      show: false,
      canSucceed: true,
      reversed: false,
      skipTimerCount: 0,
      rtl: false,
      throttle: 200,
      duration: 5000,
      continuous: false
    };
  },

  computed: {
    left() {
      if (!this.continuous && !this.rtl) {
        return false;
      }

      return this.rtl ? this.reversed ? '0px' : 'auto' : !this.reversed ? '0px' : 'auto';
    }

  },

  beforeDestroy() {
    this.clear();
  },

  methods: {
    clear() {
      clearInterval(this._timer);
      clearTimeout(this._throttle);
      this._timer = null;
    },

    start() {
      this.clear();
      this.percent = 0;
      this.reversed = false;
      this.skipTimerCount = 0;
      this.canSucceed = true;

      if (this.throttle) {
        this._throttle = setTimeout(() => this.startTimer(), this.throttle);
      } else {
        this.startTimer();
      }

      return this;
    },

    set(num) {
      this.show = true;
      this.canSucceed = true;
      this.percent = Math.min(100, Math.max(0, Math.floor(num)));
      return this;
    },

    get() {
      return this.percent;
    },

    increase(num) {
      this.percent = Math.min(100, Math.floor(this.percent + num));
      return this;
    },

    decrease(num) {
      this.percent = Math.max(0, Math.floor(this.percent - num));
      return this;
    },

    pause() {
      clearInterval(this._timer);
      return this;
    },

    resume() {
      this.startTimer();
      return this;
    },

    finish() {
      this.percent = this.reversed ? 0 : 100;
      this.hide();
      return this;
    },

    hide() {
      this.clear();
      setTimeout(() => {
        this.show = false;
        this.$nextTick(() => {
          this.percent = 0;
          this.reversed = false;
        });
      }, 500);
      return this;
    },

    fail(error) {
      this.canSucceed = false;
      return this;
    },

    startTimer() {
      if (!this.show) {
        this.show = true;
      }

      if (typeof this._cut === 'undefined') {
        this._cut = 10000 / Math.floor(this.duration);
      }

      this._timer = setInterval(() => {
        /**
         * When reversing direction skip one timers
         * so 0, 100 are displayed for two iterations
         * also disable css width transitioning
         * which otherwise interferes and shows
         * a jojo effect
         */
        if (this.skipTimerCount > 0) {
          this.skipTimerCount--;
          return;
        }

        if (this.reversed) {
          this.decrease(this._cut);
        } else {
          this.increase(this._cut);
        }

        if (this.continuous) {
          if (this.percent >= 100) {
            this.skipTimerCount = 1;
            this.reversed = !this.reversed;
          } else if (this.percent <= 0) {
            this.skipTimerCount = 1;
            this.reversed = !this.reversed;
          }
        }
      }, 100);
    }

  },

  render(h) {
    let el = h(false);

    if (this.show) {
      el = h('div', {
        staticClass: 'nuxt-progress',
        class: {
          'nuxt-progress-notransition': this.skipTimerCount > 0,
          'nuxt-progress-failed': !this.canSucceed
        },
        style: {
          width: this.percent + '%',
          left: this.left
        }
      });
    }

    return el;
  }

});
// CONCATENATED MODULE: ./node_modules/.cache/nuxt/components/nuxt-loading.vue?vue&type=script&lang=js&
 /* harmony default export */ var components_nuxt_loadingvue_type_script_lang_js_ = (nuxt_loadingvue_type_script_lang_js_); 
// CONCATENATED MODULE: ./node_modules/.cache/nuxt/components/nuxt-loading.vue
var nuxt_loading_render, nuxt_loading_staticRenderFns;


function nuxt_loading_injectStyles (context) {
  
  var style0 = __webpack_require__(18);
if (style0.__inject__) style0.__inject__(context);

}

/* normalize component */

var nuxt_loading_component = Object(componentNormalizer["a" /* default */])(
  components_nuxt_loadingvue_type_script_lang_js_,
  nuxt_loading_render,
  nuxt_loading_staticRenderFns,
  false,
  nuxt_loading_injectStyles,
  null,
  "0d108cee"
  
);

/* harmony default export */ var nuxt_loading = (nuxt_loading_component.exports);
// CONCATENATED MODULE: ./node_modules/vue-loader/lib/loaders/templateLoader.js??vue-loader-options!./node_modules/vue-loader/lib??vue-loader-options!./layouts/default.vue?vue&type=template&id=97e65fba&
var defaultvue_type_template_id_97e65fba_render = function () {var _vm=this;var _h=_vm.$createElement;var _c=_vm._self._c||_h;return _c('div',[_c('Nuxt')],1)};
var defaultvue_type_template_id_97e65fba_staticRenderFns = [];


// CONCATENATED MODULE: ./layouts/default.vue?vue&type=template&id=97e65fba&

// CONCATENATED MODULE: ./layouts/default.vue

var script = {};
function default_injectStyles (context) {
  
  var style0 = __webpack_require__(20);
if (style0.__inject__) style0.__inject__(context);

}

/* normalize component */

var default_component = Object(componentNormalizer["a" /* default */])(
  script,
  defaultvue_type_template_id_97e65fba_render,
  defaultvue_type_template_id_97e65fba_staticRenderFns,
  false,
  default_injectStyles,
  null,
  "6944811c"
  
);

/* harmony default export */ var layouts_default = (default_component.exports);
// CONCATENATED MODULE: ./node_modules/.cache/nuxt/App.js





const layouts = {
  "_default": sanitizeComponent(layouts_default)
};
/* harmony default export */ var App = ({
  render(h, props) {
    const loadingEl = h('NuxtLoading', {
      ref: 'loading'
    });
    const layoutEl = h(this.layout || 'nuxt');
    const templateEl = h('div', {
      domProps: {
        id: '__layout'
      },
      key: this.layoutName
    }, [layoutEl]);
    const transitionEl = h('transition', {
      props: {
        name: 'layout',
        mode: 'out-in'
      },
      on: {
        beforeEnter(el) {
          // Ensure to trigger scroll event after calling scrollBehavior
          window.$nuxt.$nextTick(() => {
            window.$nuxt.$emit('triggerScroll');
          });
        }

      }
    }, [templateEl]);
    return h('div', {
      domProps: {
        id: '__nuxt'
      }
    }, [loadingEl, transitionEl]);
  },

  data: () => ({
    isOnline: true,
    layout: null,
    layoutName: '',
    nbFetching: 0
  }),

  beforeCreate() {
    external_vue_default.a.util.defineReactive(this, 'nuxt', this.$options.nuxt);
  },

  created() {
    // Add this.$nuxt in child instances
    this.$root.$options.$nuxt = this;


    this.error = this.nuxt.error; // Add $nuxt.context

    this.context = this.$options.context;
  },

  async mounted() {
    this.$loading = this.$refs.loading;

    if (this.isPreview) {
      if (this.$store && this.$store._actions.nuxtServerInit) {
        this.$loading.start();
        await this.$store.dispatch('nuxtServerInit', this.context);
      }

      await this.refresh();
      this.$loading.finish();
    }
  },

  watch: {
    'nuxt.err': 'errorChanged'
  },
  computed: {
    isOffline() {
      return !this.isOnline;
    },

    isFetching() {
      return this.nbFetching > 0;
    },

    isPreview() {
      return Boolean(this.$options.previewData);
    }

  },
  methods: {
    refreshOnlineStatus() {
    },

    async refresh() {
      const pages = getMatchedComponentsInstances(this.$route);

      if (!pages.length) {
        return;
      }

      this.$loading.start();
      const promises = pages.map(page => {
        const p = []; // Old fetch

        if (page.$options.fetch && page.$options.fetch.length) {
          p.push(promisify(page.$options.fetch, this.context));
        }

        if (page.$fetch) {
          p.push(page.$fetch());
        } else {
          // Get all component instance to call $fetch
          for (const component of getChildrenComponentInstancesUsingFetch(page.$vnode.componentInstance)) {
            p.push(component.$fetch());
          }
        }

        if (page.$options.asyncData) {
          p.push(promisify(page.$options.asyncData, this.context).then(newData => {
            for (const key in newData) {
              external_vue_default.a.set(page.$data, key, newData[key]);
            }
          }));
        }

        return Promise.all(p);
      });

      try {
        await Promise.all(promises);
      } catch (error) {
        this.$loading.fail(error);
        globalHandleError(error);
        this.error(error);
      }

      this.$loading.finish();
    },

    errorChanged() {
      if (this.nuxt.err) {
        if (this.$loading) {
          if (this.$loading.fail) {
            this.$loading.fail(this.nuxt.err);
          }

          if (this.$loading.finish) {
            this.$loading.finish();
          }
        }

        let errorLayout = (nuxt_error.options || nuxt_error).layout;

        if (typeof errorLayout === 'function') {
          errorLayout = errorLayout(this.context);
        }

        this.setLayout(errorLayout);
      }
    },

    setLayout(layout) {
      if (!layout || !layouts['_' + layout]) {
        layout = 'default';
      }

      this.layoutName = layout;
      this.layout = layouts['_' + layout];
      return this.layout;
    },

    loadLayout(layout) {
      if (!layout || !layouts['_' + layout]) {
        layout = 'default';
      }

      return Promise.resolve(layouts['_' + layout]);
    },

    getRouterBase() {
      return (this.$router.options.base || '').replace(/\/+$/, '');
    },

    getRoutePath(route = '/') {
      const base = this.getRouterBase();

      if (base && route.startsWith(base)) {
        route = route.substr(base.length);
      }

      return (route.replace(/\/+$/, '') || '/').split('?')[0].split('#')[0];
    },

    getStaticAssetsPath(route = '/') {
      const {
        staticAssetsBase
      } = window.__NUXT__;
      return urlJoin(staticAssetsBase, this.getRoutePath(route));
    },

    setPagePayload(payload) {
      this._pagePayload = payload;
      this._payloadFetchIndex = 0;
    },

    async fetchPayload(route) {
      const src = urlJoin(this.getStaticAssetsPath(route), 'payload.js');

      try {
        const payload = await window.__NUXT_IMPORT__(decodeURI(route), encodeURI(src));
        this.setPagePayload(payload);
        return payload;
      } catch (err) {
        this.setPagePayload(false);
        throw err;
      }
    }

  },
  components: {
    NuxtLoading: nuxt_loading
  }
});
// EXTERNAL MODULE: ./node_modules/.cache/nuxt/composition-api/index.js
var composition_api = __webpack_require__(4);


/* harmony default export */ var composition_api_plugin = (composition_api["globalPlugin"]);
// EXTERNAL MODULE: ./node_modules/.cache/nuxt/empty.js
__webpack_require__(26);

// CONCATENATED MODULE: ./node_modules/.cache/nuxt/composition-api/meta.js

/* harmony default export */ var meta = (composition_api["setMetaPlugin"]);
// CONCATENATED MODULE: ./node_modules/.cache/nuxt/index.js










/* Plugins */

 // Source: ./composition-api/plugin.js (mode: 'all')

 // Source: ./nitro.client.js (mode: 'client')

 // Source: ./composition-api/meta.js (mode: 'all')
// Component: <ClientOnly>

external_vue_default.a.component(external_vue_client_only_default.a.name, external_vue_client_only_default.a); // TODO: Remove in Nuxt 3: <NoSsr>

external_vue_default.a.component(external_vue_no_ssr_default.a.name, { ...external_vue_no_ssr_default.a,

  render(h, ctx) {

    return external_vue_no_ssr_default.a.render(h, ctx);
  }

}); // Component: <NuxtChild>

external_vue_default.a.component(nuxt_child.name, nuxt_child);
external_vue_default.a.component('NChild', nuxt_child); // Component NuxtLink is imported in server.js or client.js
// Component: <Nuxt>

external_vue_default.a.component(components_nuxt.name, components_nuxt);
Object.defineProperty(external_vue_default.a.prototype, '$nuxt', {
  get() {
    return this.$root.$options.$nuxt;
  },

  configurable: true
});
external_vue_default.a.use(external_vue_meta_default.a, {
  "keyName": "head",
  "attribute": "data-n-head",
  "ssrAttribute": "data-n-head-ssr",
  "tagIDKeyName": "hid"
});
const defaultTransition = {
  "name": "page",
  "mode": "out-in",
  "appear": false,
  "appearClass": "appear",
  "appearActiveClass": "appear-active",
  "appearToClass": "appear-to"
};

async function createApp(ssrContext, config = {}) {
  const router = await createRouter(); // Create Root instance
  // here we inject the router and store to all child components,
  // making them available everywhere as `this.$router` and `this.$store`.

  const app = {
    head: {
      "meta": [],
      "link": [],
      "style": [],
      "script": []
    },
    router,
    nuxt: {
      defaultTransition,
      transitions: [defaultTransition],

      setTransitions(transitions) {
        if (!Array.isArray(transitions)) {
          transitions = [transitions];
        }

        transitions = transitions.map(transition => {
          if (!transition) {
            transition = defaultTransition;
          } else if (typeof transition === 'string') {
            transition = Object.assign({}, defaultTransition, {
              name: transition
            });
          } else {
            transition = Object.assign({}, defaultTransition, transition);
          }

          return transition;
        });
        this.$options.nuxt.transitions = transitions;
        return transitions;
      },

      err: null,
      dateErr: null,

      error(err) {
        err = err || null;
        app.context._errored = Boolean(err);
        err = err ? normalizeError(err) : null;
        let nuxt = app.nuxt; // to work with @vue/composition-api, see https://github.com/nuxt/nuxt.js/issues/6517#issuecomment-573280207

        if (this) {
          nuxt = this.nuxt || this.$options.nuxt;
        }

        nuxt.dateErr = Date.now();
        nuxt.err = err; // Used in src/server.js

        if (ssrContext) {
          ssrContext.nuxt.error = err;
        }

        return err;
      }

    },
    ...App
  };
  const next = ssrContext ? ssrContext.next : location => app.router.push(location); // Resolve route

  let route;

  if (ssrContext) {
    route = router.resolve(ssrContext.url).route;
  } else {
    const path = getLocation(router.options.base, router.options.mode);
    route = router.resolve(path).route;
  } // Set context to app.context


  await setContext(app, {
    route,
    next,
    error: app.nuxt.error.bind(app),
    payload: ssrContext ? ssrContext.payload : undefined,
    req: ssrContext ? ssrContext.req : undefined,
    res: ssrContext ? ssrContext.res : undefined,
    beforeRenderFns: ssrContext ? ssrContext.beforeRenderFns : undefined,
    ssrContext
  });

  function inject(key, value) {
    if (!key) {
      throw new Error('inject(key, value) has no key provided');
    }

    if (value === undefined) {
      throw new Error(`inject('${key}', value) has no value provided`);
    }

    key = '$' + key; // Add into app

    app[key] = value; // Add into context

    if (!app.context[key]) {
      app.context[key] = value;
    } // Check if plugin not already installed


    const installKey = '__nuxt_' + key + '_installed__';

    if (external_vue_default.a[installKey]) {
      return;
    }

    external_vue_default.a[installKey] = true; // Call Vue.use() to install the plugin into vm

    external_vue_default.a.use(() => {
      if (!Object.prototype.hasOwnProperty.call(external_vue_default.a.prototype, key)) {
        Object.defineProperty(external_vue_default.a.prototype, key, {
          get() {
            return this.$root.$options[key];
          }

        });
      }
    });
  } // Inject runtime config as $config


  inject('config', config); // Add enablePreview(previewData = {}) in context for plugins


  if (typeof composition_api_plugin === 'function') {
    await composition_api_plugin(app.context, inject);
  }

  if (typeof meta === 'function') {
    await meta(app.context, inject);
  } // Lock enablePreview in context


  if ( ssrContext && ssrContext.url) {
    await new Promise((resolve, reject) => {
      router.push(ssrContext.url, resolve, err => {
        // https://github.com/vuejs/vue-router/blob/v3.4.3/src/util/errors.js
        if (!err._isRouter) return reject(err);
        if (err.type !== 2
        /* NavigationFailureType.redirected */
        ) return resolve(); // navigated to a different route in router guard

        const unregister = router.afterEach(async (to, from) => {
          ssrContext.url = to.fullPath;
          app.context.route = await getRouteData(to);
          app.context.params = to.params || {};
          app.context.query = to.query || {};
          unregister();
          resolve();
        });
      });
    });
  }

  return {
    app,
    router
  };
}


// CONCATENATED MODULE: ./node_modules/.cache/nuxt/components/nuxt-link.server.js

/* harmony default export */ var nuxt_link_server = ({
  name: 'NuxtLink',
  extends: external_vue_default.a.component('RouterLink'),
  props: {
    prefetch: {
      type: Boolean,
      default: true
    },
    noPrefetch: {
      type: Boolean,
      default: false
    }
  }
});
// CONCATENATED MODULE: ./node_modules/.cache/nuxt/server.js








 // should be included after ./index.js
// Update serverPrefetch strategy

external_vue_default.a.config.optionMergeStrategies.serverPrefetch = external_vue_default.a.config.optionMergeStrategies.created; // Fetch mixin

if (!external_vue_default.a.__nuxt__fetch__mixin__) {
  external_vue_default.a.mixin(fetch_server);
  external_vue_default.a.__nuxt__fetch__mixin__ = true;
} // Component: <NuxtLink>


external_vue_default.a.component(nuxt_link_server.name, nuxt_link_server);
external_vue_default.a.component('NLink', nuxt_link_server);

if (!server$1.commonjsGlobal.fetch) {
  server$1.commonjsGlobal.fetch = external_node_fetch_default.a;
}

const noopApp = () => new external_vue_default.a({
  render: h => h('div')
});

function server_urlJoin() {
  return Array.prototype.slice.call(arguments).join('/').replace(/\/+/g, '/');
}

const createNext = ssrContext => opts => {
  // If static target, render on client-side
  ssrContext.redirected = opts;

  if (ssrContext.target === 'static' || !ssrContext.res) {
    ssrContext.nuxt.serverRendered = false;
    return;
  }

  opts.query = Object(external_querystring_["stringify"])(opts.query);
  opts.path = opts.path + (opts.query ? '?' + opts.query : '');
  const routerBase = '/';

  if (!opts.path.startsWith('http') && routerBase !== '/' && !opts.path.startsWith(routerBase)) {
    opts.path = server_urlJoin(routerBase, opts.path);
  } // Avoid loop redirect


  if (decodeURI(opts.path) === decodeURI(ssrContext.url)) {
    ssrContext.redirected = false;
    return;
  }

  ssrContext.res.writeHead(opts.status, {
    Location: Object(ufo_["normalizeURL"])(opts.path)
  });
  ssrContext.res.end();
}; // This exported function will be called by `bundleRenderer`.
// This is where we perform data-prefetching to determine the
// state of our application before actually rendering it.
// Since data fetching is async, this function is expected to
// return a Promise that resolves to the app instance.


/* harmony default export */ __webpack_exports__["default"] = (async ssrContext => {
  // Create ssrContext.next for simulate next() of beforeEach() when wanted to redirect
  ssrContext.redirected = false;
  ssrContext.next = createNext(ssrContext); // Used for beforeNuxtRender({ Components, nuxtState })

  ssrContext.beforeRenderFns = []; // Nuxt object (window.{{globals.context}}, defaults to window.__NUXT__)

  ssrContext.nuxt = {
    layout: 'default',
    data: [],
    fetch: [],
    error: null,
    serverRendered: true,
    routePath: ''
  }; // Remove query from url is static target

  if ( ssrContext.url) {
    ssrContext.url = ssrContext.url.split('?')[0];
  } // Public runtime config


  ssrContext.nuxt.config = ssrContext.runtimeConfig.public; // Create the app definition and the instance (created for each request)

  const {
    app,
    router
  } = await createApp(ssrContext, { ...ssrContext.runtimeConfig.public,
    ...ssrContext.runtimeConfig.private
  });

  const _app = new external_vue_default.a(app); // Add ssr route path to nuxt context so we can account for page navigation between ssr and csr


  ssrContext.nuxt.routePath = app.context.route.path; // Add meta infos (used in renderer.js)

  ssrContext.meta = _app.$meta(); // Keep asyncData for each matched component in ssrContext (used in app/utils.js via this.$ssrContext)

  ssrContext.asyncData = {};

  const beforeRender = async () => {
    // Call beforeNuxtRender() methods
    await Promise.all(ssrContext.beforeRenderFns.map(fn => promisify(fn, {
      Components,
      nuxtState: ssrContext.nuxt
    })));
  };

  const renderErrorPage = async () => {
    // Don't server-render the page in static target
    if (ssrContext.target === 'static') {
      ssrContext.nuxt.serverRendered = false;
    } // Load layout for error page


    const layout = (nuxt_error.options || nuxt_error).layout;
    const errLayout = typeof layout === 'function' ? layout.call(nuxt_error, app.context) : layout;
    ssrContext.nuxt.layout = errLayout || 'default';
    await _app.loadLayout(errLayout);

    _app.setLayout(errLayout);

    await beforeRender();
    return _app;
  };

  const render404Page = () => {
    app.context.error({
      statusCode: 404,
      path: ssrContext.url,
      message: 'This page could not be found'
    });
    return renderErrorPage();
  }; // Components are already resolved by setContext -> getRouteData (app/utils.js)


  const Components = getMatchedComponents(router.match(ssrContext.url));
  /*
  ** Call global middleware (nuxt.config.js)
  */

  let midd = [];
  midd = midd.map(name => {
    if (typeof name === 'function') {
      return name;
    }

    if (typeof nuxt_middleware[name] !== 'function') {
      app.context.error({
        statusCode: 500,
        message: 'Unknown middleware ' + name
      });
    }

    return nuxt_middleware[name];
  });
  await middlewareSeries(midd, app.context); // ...If there is a redirect or an error, stop the process

  if (ssrContext.redirected) {
    return noopApp();
  }

  if (ssrContext.nuxt.error) {
    return renderErrorPage();
  }
  /*
  ** Set layout
  */


  let layout = Components.length ? Components[0].options.layout : nuxt_error.layout;

  if (typeof layout === 'function') {
    layout = layout(app.context);
  }

  await _app.loadLayout(layout);

  if (ssrContext.nuxt.error) {
    return renderErrorPage();
  }

  layout = _app.setLayout(layout);
  ssrContext.nuxt.layout = _app.layoutName;
  /*
  ** Call middleware (layout + pages)
  */

  midd = [];
  layout = sanitizeComponent(layout);

  if (layout.options.middleware) {
    midd = midd.concat(layout.options.middleware);
  }

  Components.forEach(Component => {
    if (Component.options.middleware) {
      midd = midd.concat(Component.options.middleware);
    }
  });
  midd = midd.map(name => {
    if (typeof name === 'function') {
      return name;
    }

    if (typeof nuxt_middleware[name] !== 'function') {
      app.context.error({
        statusCode: 500,
        message: 'Unknown middleware ' + name
      });
    }

    return nuxt_middleware[name];
  });
  await middlewareSeries(midd, app.context); // ...If there is a redirect or an error, stop the process

  if (ssrContext.redirected) {
    return noopApp();
  }

  if (ssrContext.nuxt.error) {
    return renderErrorPage();
  }
  /*
  ** Call .validate()
  */


  let isValid = true;

  try {
    for (const Component of Components) {
      if (typeof Component.options.validate !== 'function') {
        continue;
      }

      isValid = await Component.options.validate(app.context);

      if (!isValid) {
        break;
      }
    }
  } catch (validationError) {
    // ...If .validate() threw an error
    app.context.error({
      statusCode: validationError.statusCode || '500',
      message: validationError.message
    });
    return renderErrorPage();
  } // ...If .validate() returned false


  if (!isValid) {
    // Render a 404 error page
    return render404Page();
  } // If no Components found, returns 404


  if (!Components.length) {
    return render404Page();
  } // Call asyncData & fetch hooks on components matched by the route.


  const asyncDatas = await Promise.all(Components.map(Component => {
    const promises = []; // Call asyncData(context)

    if (Component.options.asyncData && typeof Component.options.asyncData === 'function') {
      const promise = promisify(Component.options.asyncData, app.context);
      promise.then(asyncDataResult => {
        ssrContext.asyncData[Component.cid] = asyncDataResult;
        applyAsyncData(Component);
        return asyncDataResult;
      });
      promises.push(promise);
    } else {
      promises.push(null);
    } // Call fetch(context)


    if (Component.options.fetch && Component.options.fetch.length) {
      promises.push(Component.options.fetch(app.context));
    } else {
      promises.push(null);
    }

    return Promise.all(promises);
  })); // datas are the first row of each

  ssrContext.nuxt.data = asyncDatas.map(r => r[0] || {}); // ...If there is a redirect or an error, stop the process

  if (ssrContext.redirected) {
    return noopApp();
  }

  if (ssrContext.nuxt.error) {
    return renderErrorPage();
  } // Call beforeNuxtRender methods & add store state


  await beforeRender();
  return _app;
});

/***/ })
/******/ ]);
});

const createApp = /*@__PURE__*/server$1.getDefaultExportFromCjs(server);

var publicPath = "/_nuxt/";
var all = [
	"../server/index.spa.html",
	"../server/index.ssr.html",
	"3fb9f92.js",
	"59253ad.js",
	"603f7a2.js",
	"LICENSES",
	"d1f4970.js",
	"d83ea7a.js"
];
var initial = [
	"3fb9f92.js",
	"603f7a2.js",
	"d1f4970.js",
	"59253ad.js"
];
var async = [
	"d83ea7a.js"
];
var modules = {
	"34702175": [
		6
	],
	"47143130": [
		4
	],
	"51837672": [
		4
	],
	"60609559": [
		3
	],
	"61765918": [
		4
	],
	"75530490": [
		4
	],
	"162c4954": [
		6
	],
	ee0ef428: [
		4
	],
	"343d7ef0": [
		4
	],
	"3858d38e": [
		4
	],
	"68b1055d": [
		4
	],
	"1d50671e": [
		4
	],
	"4f4e5bd3": [
		4
	],
	"6ea4006f": [
		4
	],
	"4a654078": [
		4
	],
	"84fb5e24": [
		4
	],
	"6db570cc": [
		4
	],
	"7f68a552": [
		4
	],
	f6caee92: [
		4
	],
	"55d894bc": [
		4
	],
	"796af198": [
		4
	],
	"9d89cd60": [
		4
	],
	"7dd3c686": [
		4
	],
	"5232b5fa": [
		4
	],
	"56a2f1e4": [
		4
	],
	"786cd90d": [
		4
	],
	"66ef12a6": [
		4
	],
	f6ef1aca: [
		4
	],
	"50015b7a": [
		4
	],
	"5b7ab3b3": [
		4
	],
	"766254a1": [
		4
	],
	"5fe478d6": [
		6
	],
	"6be8ac5e": [
		6
	],
	"2907d948": [
		6
	],
	"396e363a": [
		6
	],
	"6cb3cc6a": [
		6
	],
	"283dd406": [
		6
	],
	"420f38c8": [
		6
	],
	"60f9818a": [
		6
	],
	"215831a3": [
		6
	],
	"353cda2c": [
		6
	],
	de60ffcc: [
		6
	],
	"0d108cee": [
		6
	],
	"6836c0f0": [
		6
	],
	"7120ff94": [
		6
	],
	"1d282426": [
		6
	],
	"2bc88d42": [
		6
	],
	"67af3f92": [
		4
	],
	f9e2458c: [
		4
	],
	"1ef6b7ec": [
		4
	],
	"0b647ec1": [
		4
	],
	cfc92476: [
		4
	],
	"8c1c1c9e": [
		4
	],
	e96aaf74: [
		4
	],
	"0eadf866": [
		4
	],
	b762d260: [
		4
	],
	f8c8986e: [
		4
	],
	"7d173c1e": [
		4
	],
	"77a67e68": [
		4
	],
	"5e792a57": [
		4
	],
	"641a3be2": [
		4
	],
	"2419e3ad": [
		4
	],
	"2ccc78f6": [
		4
	],
	"085dfa66": [
		4
	],
	f2992006: [
		4
	],
	"6871f241": [
		4
	],
	"51b4f28a": [
		4
	],
	c355ec88: [
		6
	],
	"21dd5e41": [
		4
	],
	"64fc0b89": [
		4
	],
	"72b84810": [
		4
	],
	"01694507": [
		4
	],
	"3e567728": [
		4
	],
	"1bd36da6": [
		4
	],
	"2d1647ec": [
		4
	],
	"334a6b81": [
		4
	],
	"0f34b68c": [
		4
	],
	ec8f07e6: [
		4
	],
	"17737d79": [
		4
	],
	db2bc0b2: [
		4
	],
	"72d69542": [
		4
	],
	"58bf0558": [
		4
	],
	fd2f4a8a: [
		4
	],
	"293776b6": [
		4
	],
	"1c8260e8": [
		4
	],
	"843ddbcc": [
		4
	],
	"7f9ab464": [
		4
	],
	e450e7f0: [
		4
	],
	"7cf9fb50": [
		4
	],
	"71e19b5d": [
		4
	],
	"18b44a65": [
		4
	],
	"4d181c2b": [
		4
	],
	"793d14f6": [
		4
	],
	"896cbcbc": [
		4
	],
	f4191fee: [
		4
	],
	"1b594142": [
		4
	],
	"5bee0a8a": [
		4
	],
	ba29851a: [
		4
	],
	"4054b1a6": [
		6
	],
	f6e01ece: [
		6
	],
	"4786c922": [
		6
	],
	"11fabf7a": [
		6
	],
	"29ca7551": [
		4
	],
	"5545a4c7": [
		4
	],
	d89a8ad6: [
		4
	],
	"2e64b80e": [
		4
	],
	ce073570: [
		4
	],
	"0302c0e3": [
		4
	],
	"14f839e5": [
		4
	],
	"60fe2b02": [
		4
	],
	"1404999d": [
		4
	],
	"1152d4c4": [
		4
	],
	"500e53f9": [
		4
	],
	"03e82bc6": [
		4
	],
	b9fff08a: [
		4
	],
	"59b2a674": [
		4
	],
	"004e39fe": [
		4
	],
	"69918a4a": [
		4
	],
	"7847cc40": [
		4
	],
	"8d2607ba": [
		4
	],
	"9e28a54e": [
		4
	],
	"6ffce626": [
		4
	],
	"67917af4": [
		4
	],
	"834cecd0": [
		4
	],
	"26167d52": [
		4
	],
	"0dda0492": [
		4
	],
	"7669fcdb": [
		4
	],
	"4b3ed47e": [
		4
	],
	d39b2c3e: [
		4
	],
	"2100946e": [
		4
	],
	"56f518c2": [
		4
	],
	"14ac9b83": [
		4
	],
	"10ee4624": [
		4
	],
	"20cdeb88": [
		4
	],
	"4fd5dade": [
		4
	],
	f78a1d16: [
		6
	],
	"31e0bf0e": [
		6
	],
	"5ab3b2c4": [
		6
	],
	"4cc1d7e5": [
		4
	],
	"83684d96": [
		4
	],
	"6e6f1e37": [
		4
	],
	"56e20dc1": [
		4
	],
	acc78892: [
		4
	],
	e3778114: [
		4
	],
	"7c9b6294": [
		4
	],
	"17f29643": [
		4
	],
	"7bfba0c4": [
		4
	],
	"1594fba3": [
		4
	],
	"101e23f3": [
		4
	],
	c0e3d6b6: [
		4
	],
	"2275a271": [
		4
	],
	"334174b8": [
		4
	],
	"1fdd068d": [
		4
	],
	"164538f4": [
		4
	],
	"20a35096": [
		4
	],
	"1dd69d92": [
		4
	],
	d512f8ce: [
		4
	],
	"7d93cf48": [
		4
	],
	"1e61292c": [
		4
	],
	"2afbe4da": [
		4
	],
	"2a9da143": [
		4
	],
	"1261d2b8": [
		4
	],
	"7d286e57": [
		4
	],
	"00a1b89d": [
		4
	],
	"74928b58": [
		4
	],
	"53460df6": [
		4
	],
	"828a7996": [
		4
	],
	e13a04e0: [
		4
	],
	"7711a180": [
		4
	],
	"8691fd46": [
		4
	],
	add18c96: [
		4
	],
	"5ece8ea8": [
		4
	],
	"01bfae3a": [
		4
	],
	"8c617f2a": [
		6
	],
	"18027e12": [
		6
	],
	"2bb4d88e": [
		3
	],
	"0f9930a8": [
		4
	],
	aee4f478: [
		4
	],
	"31bb0f4d": [
		4
	],
	"650a17a6": [
		6
	],
	"98d05360": [
		4
	],
	"561d1032": [
		6
	],
	"87e4ead6": [
		6
	],
	"6bdbcbcb": [
		6
	],
	"6944811c": [
		3
	],
	"5b3f947f": [
		3
	],
	cf19b8be: [
		3
	],
	"8e546d90": [
		3
	],
	"1f422ec8": [
		6
	],
	"66adf154": [
		4
	],
	"640fab4e": [
		4
	],
	"23e01bc7": [
		4
	],
	"3f1d13c3": [
		4
	],
	"53b90e0a": [
		4
	],
	cba2ff1c: [
		4
	],
	"58ed5e29": [
		4
	],
	"47e71fed": [
		4
	],
	"1c44921d": [
		4
	],
	"42e5bcd1": [
		4
	],
	"38ab08a2": [
		4
	],
	ca6ed086: [
		4
	],
	"03577c8c": [
		4
	],
	"07c40dc6": [
		4
	],
	"0164bb62": [
		4
	],
	"42c3940c": [
		4
	],
	"647c4456": [
		4
	],
	ae5bb54a: [
		4
	],
	"3bb151e8": [
		4
	],
	"124878b2": [
		4
	],
	"754dc958": [
		4
	],
	"508fb452": [
		4
	],
	"365f0ece": [
		4
	],
	b525c620: [
		4
	],
	c418b8ba: [
		4
	],
	"952b0ce8": [
		4
	],
	"5eb632de": [
		4
	],
	"0d3571df": [
		4
	],
	"5e266a89": [
		4
	],
	"2802bdce": [
		4
	],
	faf27c52: [
		4
	],
	"27cc2132": [
		4
	],
	"475171cd": [
		6
	],
	eac7ea6a: [
		6
	],
	"29ba21d9": [
		6
	],
	"767b1952": [
		6
	],
	"541c8697": [
		3
	],
	f8deb6cc: [
		4
	],
	"2fe3f40b": [
		4
	],
	"58a6c9d5": [
		4
	],
	bf3068de: [
		4
	],
	"101a4530": [
		4
	],
	"61870e9c": [
		4
	],
	a5877cb0: [
		4
	],
	"7c932dc8": [
		4
	],
	aa41e26a: [
		4
	],
	"0b4ddf4c": [
		4
	],
	"03eafbaa": [
		4
	],
	"4bfadf47": [
		4
	],
	"2ea1bf4c": [
		4
	],
	"5434d680": [
		4
	],
	c2f4456a: [
		4
	],
	"6212a450": [
		4
	],
	"8937cba2": [
		4
	],
	"15e46d27": [
		4
	],
	"9bde58fe": [
		4
	],
	"416e1a02": [
		4
	],
	"7f36c3ca": [
		4
	],
	"273b3030": [
		6
	],
	"586b15b3": [
		6
	],
	"53ae981f": [
		6
	],
	d4d4c1a6: [
		7
	],
	"7344b10b": [
		7
	],
	"005b1e66": [
		7
	],
	beecd204: [
		7
	],
	"6f0de7e5": [
		7
	],
	"12d612d0": [
		7
	],
	"33cb4ff2": [
		7
	],
	ac964808: [
		7
	]
};
var assetsMapping = {
	"6fca0322": [
		"3fb9f92.js"
	],
	"1a3ae26b": [
		"59253ad.js"
	],
	"085a35c4": [
		"603f7a2.js"
	],
	"7ea24c87": [
		"d1f4970.js"
	],
	"2a130dde": [
		"d83ea7a.js"
	]
};
const clientManifest = {
	publicPath: publicPath,
	all: all,
	initial: initial,
	async: async,
	modules: modules,
	assetsMapping: assetsMapping
};

var document_template = (params) => `<!DOCTYPE html>
<html ${params.HTML_ATTRS}>
  <head ${params.HEAD_ATTRS}>
    ${params.HEAD}
  </head>
  <body ${params.BODY_ATTRS}>
    ${params.APP}
  </body>
</html>
`;

function _interopDefault$2(e) {
  return e && typeof e === "object" && "default" in e ? e.default : e;
}
const renderer = createRenderer_1(_interopDefault$2(createApp), {
  clientManifest: _interopDefault$2(clientManifest),
  renderToString
});
const STATIC_ASSETS_BASE = "/_nuxt/static" + "/" + "1612567643";
const PAYLOAD_JS = "/payload.js";
async function renderMiddleware(req, res) {
  let url = req.url;
  let isPayloadReq = false;
  if (url.startsWith(STATIC_ASSETS_BASE) && url.endsWith(PAYLOAD_JS)) {
    isPayloadReq = true;
    url = url.substr(STATIC_ASSETS_BASE.length, url.length - STATIC_ASSETS_BASE.length - PAYLOAD_JS.length);
  }
  const ssrContext = {
    url,
    runtimeConfig: {
      public: server$1.config.public,
      private: server$1.config.private
    },
    ...req.context || {}
  };
  const rendered = await renderer.renderToString(ssrContext);
  const payload = ssrContext.payload || ssrContext.nuxt;
  {
    payload.staticAssetsBase = STATIC_ASSETS_BASE;
  }
  let data;
  if (isPayloadReq) {
    data = renderPayload(payload, url);
    res.setHeader("Content-Type", "text/javascript;charset=UTF-8");
  } else {
    data = renderHTML(payload, rendered, ssrContext);
    res.setHeader("Content-Type", "text/html;charset=UTF-8");
  }
  const error = ssrContext.nuxt && ssrContext.nuxt.error;
  res.statusCode = error ? error.statusCode : 200;
  res.end(data, "utf-8");
}
function renderHTML(payload, rendered, ssrContext) {
  const state = `<script>window.__NUXT__=${devalue_cjs(payload)}</script>`;
  const _html = rendered.html;
  const {htmlAttrs = "", bodyAttrs = "", headTags = "", headAttrs = ""} = ssrContext.head && ssrContext.head() || {};
  return document_template({
    HTML_ATTRS: htmlAttrs,
    HEAD_ATTRS: headAttrs,
    BODY_ATTRS: bodyAttrs,
    HEAD: headTags + rendered.renderResourceHints() + rendered.renderStyles() + (ssrContext.styles || ""),
    APP: _html + state + rendered.renderScripts()
  });
}
function renderPayload(payload, url) {
  return `__NUXT_JSONP__("${url}", ${devalue_cjs(payload)})`;
}

exports.renderMiddleware = renderMiddleware;;global.__timing__.logEnd('Load chunks/app/render');
