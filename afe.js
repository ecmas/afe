'use strict';

const fs = require('fs');
const Path = require('path');
const vm = require('vm');

const AFE = {
	TAG: '(<??|??>|<?|?>)'
	, extname: '.afe'
	, BOM: /^\uFEFF/
	, mode: { js: 0, html: 1 }
	, sandbox: vm.createContext()
}
var cache = {};	//	Used for cache vm.Script objects, key is the script full path.

function reset() {
	cache = {};
	AFE.sandbox = vm.createContext();
}

//	this will run in sandbox.
function ctxInitFunc() {
	const escapeMap = {
		'<': '&lt;'
		, '>': '&gt;'
		, '"': '&#34;'
		, "'": '&#39;'
		, '&': '&amp;'
	};
	function escapeHtml(raw) {
		var mark = /[&<>\'"]/g;
		function replacer(c) {
			return escapeMap[c] || c;
		}
		return String(raw).replace(mark, replacer);
	}
	var __html = [];	//	output data.
	var __cache = {};	//	function cache.
	var __this = {};
	function __append(raw) { __html.push(raw); }
	function html(raw) { __html.push(raw); }	//	raw echo.
	function echo(raw) { __html.push(escapeHtml(raw)); }	//	escaped echo
	function include(f, arg) {
		var func = __cache[f]	//	TODO: case insensitive problem.
			, jsc, module;
		if (!func) {
			func = {
				jsc: __include(f)
				, module: { exports: {} }
			};
			__cache[f] = func;
		}
		jsc = func.jsc;
		module = func.module;
		if ('function' === typeof jsc) {
			//	disable global access via |this|.
			jsc.call(__this, arg, $, __append, echo, html, include, module, module.exports, console);
			return module.exports;
		}
		throw jsc;
	}

	if ('function' === typeof blk) {
		blk();
	}
	include(__first_afe);
	return __html.join('');
}

const init_src = `(${ctxInitFunc.toString()})();`;
const jscInitGlobal = new vm.Script(init_src);	//	init for each render.

/**
 * renderFile
 * @param {String}		path
 * @param {Object}		data
 * @param {Object}		option
 * @param {Function}	callback
 */
function renderFile() {
	if (arguments.length < 2) { throw new Error('renderFile argument error.'); }
	var file = arguments[0]
		, $ = (arguments.length > 2) ? arguments[1] : {}
		, opt = (arguments.length > 3) ? arguments[2] : {}
		, cb = arguments[Math.min(3, arguments.length - 1)];
	try {
		render(file, $, opt, cb);
	} catch (e) {
		cb(e);
	}
}

function render(file, $, opt, cb) {
	defaultOptions(opt);
	run();

	function run() {
		opt.internals.__first_afe = file;
		opt.internals.__include = function (file) {
			if (file.indexOf('..') >= 0) { return new Error('Parent dir was disabled.'); }
			file = Path.join(opt.root, file);
			if (!Path.extname(file)) {
				file += AFE.extname;
			}
			var cjs = cache[file]
			if (!cjs) {
				//console.log('==>load afe:', file);
				try {
					var data = fs.readFileSync(file);
				} catch (e) {
					console.log('readFileSync error:', e);
					console.log(e instanceof Error);
					return e;
				}
				var afe = data.toString().replace(AFE.BOM, '');
				var js = coding(cut(afe));

				cjs = new vm.Script(js);
				cache[file] = cjs;
			}
			return cjs.runInContext(opt.ctx);
		};
		if (!vm.isContext(opt.ctx)) {
			opt.ctx = AFE.sandbox;
		}
		Object.assign(opt.ctx, opt.internals);
		opt.ctx.global = opt.ctx;
		opt.ctx.$ = $;
		var html = Launch(opt.ctx);
		cb(void 0, html);
	}
	function cut(afe) {
		var delimiter = opt.delimiter.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
		var pat = AFE.TAG.replace(/\?/g, delimiter)
			, rgx = new RegExp(pat, 'g')
			, arr = []
			, rv = rgx.exec(afe)
			, last = 0;
		while (rv) {
			arr.push(afe.slice(last, rv.index));
			arr.push(rv[1]);
			last = rv.index + rv[1].length;
			rv = rgx.exec(afe);
		}
		if (last < afe.length) {
			arr.push(afe.slice(last));
		}
		return arr;
	}
	function coding(blocks) {
		var d = opt.delimiter;
		var embed = false;	//	true for js mode, false for html mode.
		var code = [];
		__emit(`(function($$, $, __append, echo, html, include, module, exports, console){`);
		blocks.forEach(function (blk) {
			switch (blk) {
				case '<' + d:	//	entering js mode.
					if (embed) {
						throw new Error('Re-enter js mode');
					}
					embed = !embed;
					break;
				case d + '>':
					if (!embed) {
						throw new Error('Re-leave js mode');
					}
					embed = !embed;
					break;
				case '<' + d + d:
					__append('<' + d);
					break;
				case d + d + '>':
					__append(d + '>');
					break;
				default:
					if (embed) {
						__emit(blk);
						//if (/\/\/.*$/.test(blk)) {
						//__emit('\n');
						//}
					} else {
						__append(blk);
					}
					break;
			}
		});
		__emit('})');
		function __emit(js) {
			code.push(js);
		}
		function __append(html) {
			html = html.replace(/\\/g, '\\\\')
				.replace(/\n/g, '\\n')
				.replace(/\r/g, '\\r')
				.replace(/"/g, '\\"');
			code.push('__append("' + html + '");');
		}
		return code.join('\n');
	}
	function defaultOptions(opt) {
		opt.root = opt.root || Path.join(__dirname, 'views');
		opt.delimiter = opt.delimiter || '?';
		opt.ctx = opt.ctx || {};
		//opt.timeout = opt.timeout || 1000 * 9;
		opt.internals = {
			console: console
		};
	}

	function Launch(ctx) {
		return jscInitGlobal.runInContext(ctx);
	}
}


module.exports.renderFile = renderFile;
module.exports.reset = reset;
