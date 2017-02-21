'use strict';

const fs = require('fs');
const Path = require('path');
const vm = require('vm');

const AFE = {
	TAG: '(<??|??>|<?|?>)'
	, BOM: /^\uFEFF/
	, mode: { js: 0, html: 1 }
}
var cache = {};

/**
 * renderFile
 * @param {String}		path
 * @param {Object}		data
 * @param {Object}		option
 * @param {Function}	callback
 */
function renderFile() {
	if (arguments.length < 2) { return; }
	var file = arguments[0]
		, data = (arguments.length > 2) ? arguments[1] : {}
		, opt = (arguments.length > 3) ? arguments[2] : {}
		, cb = arguments[Math.min(3, arguments.length - 1)];
	defaultOptions(opt);
	run();

	function run() {
		opt.internals.__first_afe = file;
		opt.internals.__include = function (file) {
			if (file.indexOf('..') >= 0) { return new Error('Parent dir was disabled.'); }
			file = Path.join(opt.root, file);
			if (!Path.extname(file)) {
				file += '.afe';
			}
			var cjs = cache[file]
			if (!cjs) {
				console.log('==>load afe:', file);
				try {
					var data = fs.readFileSync(file);
				} catch (e) {
					console.log('readFileSync error:', e);
					console.log(e instanceof Error);
					return e;
				}
				var afe = data.toString().replace(AFE.BOM, '');
				var js = coding(cut(afe));

				//console.log(js);
				cjs = new vm.Script(js);
				cache[file] = cjs;
			}
			cjs.runInContext(opt.ctx);
			//return js;
		};
		/*opt.internals.__end = function (err, html) {
			cb(err, html);
		};*/
		Object.assign(opt.ctx, opt.internals);
		if (!vm.isContext(opt.ctx)) {
			console.log(vm.isContext(opt.ctx));
			vm.createContext(opt.ctx);
		}
		opt.ctx.global = opt.ctx;
		var html = Launch(opt.ctx);
		cb(void 0, html);
		//var fn = new Function('$, escapeHtml, include', js);
		//var rv = fn.call(opt.ctx, {}, escapeHtml, function () { });
		//console.log(rv);
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
		//console.log('--arr:', arr);
		return arr;
	}
	function coding(blocks) {
		var d = opt.delimiter;
		var embed = false;	//	true for js mode, false for html mode.
		var code = [];
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
						__emit('\n');
						//}
					} else {
						__append(blk);
					}
					break;
			}
		});
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
		return code.join('');
	}
}

function defaultOptions(opt) {
	opt.root = opt.root || Path.join(__dirname, 'views');
	opt.delimiter = opt.delimiter || '?';
	opt.ctx = opt.ctx || {};
	opt.timeout = opt.timeout || 1000 * 9;
	opt.internals = {
		escapeHtml: escapeHtml
		, console: console
	};
}
const init_src = `
var __html = [];
function __append(raw) { __html.push(raw); }
function html(raw) { __html.push(raw); }
function echo(raw) { __html.push(escapeHtml(raw)); }
function include(f) {
	var jsc = __include(f);
	if (jsc) {
		//echo(jsc.toString());
	}
}

include(__first_afe);
global.__html.join('');
`;
var jscInitGlobal = new vm.Script(init_src);
function Launch(ctx) {
	return jscInitGlobal.runInContext(ctx);
}

function escapeHtml(raw) {
	const escapeMap = {
		'<': '&lt;'
		, '>': '&gt;'
		, '"': '&#34;'
		, "'": '&#39;'
		, '&': '&amp;'
	};
	var mark = /[&<>\'"]/g;
	function replacer(c) {
		return escapeMap[c] || c;
	}
	return String(raw).replace(mark, replacer);
}

module.exports.renderFile = renderFile;
