function decode_row(rowstr) { return parseInt(unfix_row(rowstr),10) - 1; }
function encode_row(row) { return "" + (row + 1); }
function fix_row(cstr) { return cstr.replace(/([A-Z]|^)(\d+)$/,"$1$$$2"); }
function unfix_row(cstr) { return cstr.replace(/\$(\d+)$/,"$1"); }

function decode_col(colstr) { var c = unfix_col(colstr), d = 0, i = 0; for(; i !== c.length; ++i) d = 26*d + c.charCodeAt(i) - 64; return d - 1; }
function encode_col(col) { var s=""; for(++col; col; col=Math.floor((col-1)/26)) s = String.fromCharCode(((col-1)%26) + 65) + s; return s; }
function fix_col(cstr) { return cstr.replace(/^([A-Z])/,"$$$1"); }
function unfix_col(cstr) { return cstr.replace(/^\$([A-Z])/,"$1"); }

function split_cell(cstr) { return cstr.replace(/(\$?[A-Z]*)(\$?\d*)/,"$1,$2").split(","); }
function decode_cell(cstr) { var splt = split_cell(cstr); return { c:decode_col(splt[0]), r:decode_row(splt[1]) }; }
function encode_cell(cell) { return encode_col(cell.c) + encode_row(cell.r); }
function fix_cell(cstr) { return fix_col(fix_row(cstr)); }
function unfix_cell(cstr) { return unfix_col(unfix_row(cstr)); }
function decode_range(range) { var x =range.split(":").map(decode_cell); return {s:x[0],e:x[x.length-1]}; }
function encode_range(cs,ce) {
	if(ce === undefined || typeof ce === 'number') return encode_range(cs.s, cs.e);
	if(typeof cs !== 'string') cs = encode_cell(cs); if(typeof ce !== 'string') ce = encode_cell(ce);
	return cs == ce ? cs : cs + ":" + ce;
}

function safe_decode_range(range) {
	var o = {s:{c:0,r:0},e:{c:0,r:0}};
	var idx = 0, i = 0, cc = 0;
	var len = range.length;
	for(idx = 0; i < len; ++i) {
		if((cc=range.charCodeAt(i)-64) < 1 || cc > 26) break;
		idx = 26*idx + cc;
	}
	o.s.c = --idx;

	for(idx = 0; i < len; ++i) {
		if((cc=range.charCodeAt(i)-48) < 0 || cc > 9) break;
		idx = 10*idx + cc;
	}
	o.s.r = --idx;

	if(i === len || range.charCodeAt(++i) === 58) { o.e.c=o.s.c; o.e.r=o.s.r; return o; }

	for(idx = 0; i != len; ++i) {
		if((cc=range.charCodeAt(i)-64) < 1 || cc > 26) break;
		idx = 26*idx + cc;
	}
	o.e.c = --idx;

	for(idx = 0; i != len; ++i) {
		if((cc=range.charCodeAt(i)-48) < 0 || cc > 9) break;
		idx = 10*idx + cc;
	}
	o.e.r = --idx;
	return o;
}

function safe_format_cell(cell, v) {
	if(cell.z !== undefined) try { return (cell.w = SSF.format(cell.z, v)); } catch(e) { }
	if(!cell.XF) return v;
	try { return (cell.w = SSF.format(cell.XF.ifmt||0, v)); } catch(e) { return ''+v; }
}

function format_cell(cell, v) {
	if(cell == null || cell.t == null) return "";
	if(cell.w !== undefined) return cell.w;
	if(v === undefined) return safe_format_cell(cell, cell.v);
	return safe_format_cell(cell, v);
}

function sheet_to_json(sheet, opts){
	var val, row, range, header = 0, offset = 1, r, hdr = [], isempty, R, C, v;
	var o = opts != null ? opts : {};
	var raw = o.raw;
	if(sheet == null || sheet["!ref"] == null) return [];
	range = o.range !== undefined ? o.range : sheet["!ref"];
	if(o.header === 1) header = 1;
	else if(o.header === "A") header = 2;
	else if(Array.isArray(o.header)) header = 3;
	switch(typeof range) {
		case 'string': r = safe_decode_range(range); break;
		case 'number': r = safe_decode_range(sheet["!ref"]); r.s.r = range; break;
		default: r = range;
	}
	if(header > 0) offset = 0;
	var rr = encode_row(r.s.r);
	var cols = new Array(r.e.c-r.s.c+1);
	var out = new Array(r.e.r-r.s.r-offset+1);
	var outi = 0;
	for(C = r.s.c; C <= r.e.c; ++C) {
		cols[C] = encode_col(C);
		val = sheet[cols[C] + rr];
		switch(header) {
			case 1: hdr[C] = C; break;
			case 2: hdr[C] = cols[C]; break;
			case 3: hdr[C] = o.header[C - r.s.c]; break;
			default:
				if(val === undefined) continue;
				hdr[C] = format_cell(val);
		}
	}

	for (R = r.s.r + offset; R <= r.e.r; ++R) {
		rr = encode_row(R);
		isempty = true;
		if(header === 1) row = [];
		else {
			row = {};
			if(Object.defineProperty) Object.defineProperty(row, '__rowNum__', {value:R, enumerable:false});
			else row.__rowNum__ = R;
		}
		for (C = r.s.c; C <= r.e.c; ++C) {
			val = sheet[cols[C] + rr];
			if(val === undefined || val.t === undefined) continue;
			v = val.v;
			switch(val.t){
				case 'e': continue;
				case 's': break;
				case 'b': case 'n': break;
				default: throw 'unrecognized type ' + val.t;
			}
			if(v !== undefined) {
				row[hdr[C]] = raw ? v : format_cell(val,v);
				isempty = false;
			}
		}
		if(isempty === false || header === 1) out[outi++] = row;
	}
	out.length = outi;
	return out;
}

function sheet_to_row_object_array(sheet, opts) { return sheet_to_json(sheet, opts != null ? opts : {}); }

function sheet_to_csv(sheet, opts) {
	var out = "", txt = "", qreg = /"/g;
	var o = opts == null ? {} : opts;
	if(sheet == null || sheet["!ref"] == null) return "";
	var r = safe_decode_range(sheet["!ref"]);
	var FS = o.FS !== undefined ? o.FS : ",", fs = FS.charCodeAt(0);
	var RS = o.RS !== undefined ? o.RS : "\n", rs = RS.charCodeAt(0);
	var row = "", rr = "", cols = [];
	var i = 0, cc = 0, val;
	var R = 0, C = 0;
	for(C = r.s.c; C <= r.e.c; ++C) cols[C] = encode_col(C);
	for(R = r.s.r; R <= r.e.r; ++R) {
		row = "";
		rr = encode_row(R);
		for(C = r.s.c; C <= r.e.c; ++C) {
			val = sheet[cols[C] + rr];
			txt = val !== undefined ? ''+format_cell(val) : "";
			for(i = 0, cc = 0; i !== txt.length; ++i) if((cc = txt.charCodeAt(i)) === fs || cc === rs || cc === 34) {
				txt = "\"" + txt.replace(qreg, '""') + "\""; break; }
			row += (C === r.s.c ? "" : FS) + txt;
		}
		out += row + RS;
	}
	return out;
}
var make_csv = sheet_to_csv;

function sheet_to_formulae(sheet) {
	var cmds, y = "", x, val="";
	if(sheet == null || sheet["!ref"] == null) return "";
	var r = safe_decode_range(sheet['!ref']), rr = "", cols = [], C;
	cmds = new Array((r.e.r-r.s.r+1)*(r.e.c-r.s.c+1));
	var i = 0;
	for(C = r.s.c; C <= r.e.c; ++C) cols[C] = encode_col(C);
	for(var R = r.s.r; R <= r.e.r; ++R) {
		rr = encode_row(R);
		for(C = r.s.c; C <= r.e.c; ++C) {
			y = cols[C] + rr;
			x = sheet[y];
			val = "";
			if(x === undefined) continue;
			if(x.f != null) val = x.f;
			else if(x.w !== undefined) val = "'" + x.w;
			else if(x.v === undefined) continue;
			else val = ""+x.v;
			cmds[i++] = y + "=" + val;
		}
	}
	cmds.length = i;
	return cmds;
}
function sheet_add_json(_ws/*:?Worksheet*/, js/*:Array<any>*/, opts)/*:Worksheet*/ {
	var o = opts || {};
	var offset = +!o.skipHeader;
	var ws/*:Worksheet*/ = _ws || ({}/*:any*/);
	var _R = 0, _C = 0;
	if(ws && o.origin != null) {
		if(typeof o.origin == 'number') _R = o.origin;
		else {
			var _origin/*:CellAddress*/ = typeof o.origin == "string" ? decode_cell(o.origin) : o.origin;
			_R = _origin.r; _C = _origin.c;
		}
	}
	var cell/*:Cell*/;
	var range/*:Range*/ = ({s: {c:0, r:0}, e: {c:_C, r:_R + js.length - 1 + offset}}/*:any*/);
	if(ws['!ref']) {
		var _range = safe_decode_range(ws['!ref']);
		range.e.c = Math.max(range.e.c, _range.e.c);
		range.e.r = Math.max(range.e.r, _range.e.r);
		if(_R == -1) { _R = range.e.r + 1; range.e.r = _R + js.length - 1 + offset; }
	}
	var hdr/*:Array<string>*/ = o.header || [], C = 0;

	js.forEach(function (JS, R/*:number*/) {
		keys(JS).forEach(function(k) {
			if((C=hdr.indexOf(k)) == -1) hdr[C=hdr.length] = k;
			var v = JS[k];
			var t = 'z';
			var z = "";
			if(v && typeof v === 'object' && !(v instanceof Date)){
				ws[encode_cell({c:_C + C,r:_R + R + offset})] = v;
			} else {
				if(typeof v == 'number') t = 'n';
				else if(typeof v == 'boolean') t = 'b';
				else if(typeof v == 'string') t = 's';
				else if(v instanceof Date) {
					t = 'd';
					if(!o.cellDates) { t = 'n'; v = datenum(v); }
					z = o.dateNF || SSF._table[14];
				}
				ws[encode_cell({c:_C + C,r:_R + R + offset})] = cell = ({t:t, v:v}/*:any*/);
				if(z) cell.z = z;
			}
		});
	});
	range.e.c = Math.max(range.e.c, _C + hdr.length - 1);
	var __R = encode_row(_R);
	if(offset) for(C = 0; C < hdr.length; ++C) ws[encode_col(C + _C) + __R] = {t:'s', v:hdr[C]};
	ws['!ref'] = encode_range(range);
	return ws;
}
function json_to_sheet(js/*:Array<any>*/, opts)/*:Worksheet*/ { return sheet_add_json(null, js, opts); }

var utils = {
	sheet_add_json: sheet_add_json,
	json_to_sheet: json_to_sheet,
	encode_col: encode_col,
	encode_row: encode_row,
	encode_cell: encode_cell,
	encode_range: encode_range,
	decode_col: decode_col,
	decode_row: decode_row,
	split_cell: split_cell,
	decode_cell: decode_cell,
	decode_range: decode_range,
	format_cell: format_cell,
	get_formulae: sheet_to_formulae,
	make_csv: sheet_to_csv,
	make_json: sheet_to_json,
	make_formulae: sheet_to_formulae,
	sheet_to_csv: sheet_to_csv,
	sheet_to_json: sheet_to_json,
	sheet_to_formulae: sheet_to_formulae,
	sheet_to_row_object_array: sheet_to_row_object_array
};




