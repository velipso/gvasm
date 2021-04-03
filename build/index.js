
const condition = {
	s: 4,
	k: 'enum',
	sym: 'cond',
	enum: [
		'eq', 'ne', 'cs/hs', 'cc/lo', 'mi', 'pl', 'vs', 'vc',
		'hi', 'ls', 'ge', 'lt', 'gt', 'le', '/al', 'nv'
	]
};

const ops = [
//
// BRANCH
//
{
	arm: true,
	ref: '4.3',
	category: 'Branch',
	codeParts: [
		{s: 4, k: 'register', sym: 'Rn'},
		{s: 24, k: 'value', v: 0x12fff1},
		condition
	],
	syntax: ['bx$cond $Rn']
}, {
	arm: true,
	ref: '4.4',
	category: 'Branch',
	codeParts: [
		{s: 24, k: 'offset', sym: 'offset'},
		{s: 1, k: 'enum', sym: 'link', enum: ['', 'l']},
		{s: 3, k: 'value', v: 9},
		condition
	],
	syntax: ['b$link $offset']
},

//
// DATA PROCESSING
//
{
	arm: true,
	ref: '4.5,4.5.2,4.5.8.1',
	category: 'Data Processing',
	codeParts: [
		{s: 4, k: 'register', sym: 'Rm'},
		{s: 1, k: 'value', v: 0},
		{s: 2, k: 'value', sym: 'shift', v: 0}, // shift = lsl
		{s: 5, k: 'value', sym: 'amount', v: 0}, // amount = 0
		{s: 4, k: 'register', sym: 'Rd'},
		{s: 4, k: 'ignored', sym: 'Rn', v: 0}, // Rn is ignored for mov/mvn
		{s: 1, k: 'enum', sym: 's', enum: ['', 's']},
		{s: 4, k: 'enum', sym: 'oper', enum: [
			false, false, false, false, false, false, false, false,
			false, false, false, false, false, 'mov', false, 'mvn'
		]},
		{s: 1, k: 'value', sym: 'immediate', v: 0}, // immediate = 0
		{s: 2, k: 'value', v: 0},
		condition
	],
	syntax: [
		'$oper$cond$s $Rd, $Rm',
		'$oper$cond$s $Rd, $Rm, lsr #0',
		'$oper$cond$s $Rd, $Rm, asr #0',
		'$oper$cond$s $Rd, $Rm, ror #0'
	]
}, {
	todo: true
	// shift=lsr, amount=0, syntax for shift should be `lsr #32`
}, {
	todo: true
	// shift=asr, amount=0, syntax for shift should be `asr #32`
}, {
	todo: true
	// shift=ror, amount=0, syntax for shift should be `rrx`
}, {
	arm: true,
	ref: '4.5,4.5.2,4.5.8.1',
	category: 'Data Processing',
	codeParts: [
		{s: 4, k: 'register', sym: 'Rm'},
		{s: 1, k: 'value', v: 0},
		{s: 2, k: 'enum', sym: 'shift', enum: ['lsl/asl', 'lsr', 'asr', 'ror']},
		{s: 5, k: 'immediate', sym: 'amount'},
		{s: 4, k: 'register', sym: 'Rd'},
		{s: 4, k: 'ignored', sym: 'Rn', v: 0}, // Rn is ignored for mov/mvn
		{s: 1, k: 'enum', sym: 's', enum: ['', 's']},
		{s: 4, k: 'enum', sym: 'oper', enum: [
			false, false, false, false, false, false, false, false,
			false, false, false, false, false, 'mov', false, 'mvn'
		]},
		{s: 1, k: 'value', sym: 'immediate', v: 0}, // immediate = 0
		{s: 2, k: 'value', v: 0},
		condition
	],
	syntax: ['$oper$cond$s $Rd, $Rm, $shift #$amount']
}, {
	todo: true
	// mov/mvn where immediate=1, <Op2>=#expression
}, {
	arm: true,
	ref: '4.5,4.5.2,4.5.8.2',
	category: 'Data Processing',
	codeParts: [
		{s: 4, k: 'register', sym: 'Rm'},
		{s: 1, k: 'value', v: 0},
		{s: 2, k: 'value', sym: 'shift', v: 0}, // shift = lsl
		{s: 5, k: 'value', sym: 'amount', v: 0}, // amount = 0
		{s: 4, k: 'ignored', sym: 'Rd', v: 0}, // Rd is ignored for tst/teq/cmp/cmn
		{s: 4, k: 'register', sym: 'Rn'},
		{s: 1, k: 'value', sym: 's', v: 1}, // s is always 1 for tst/teq/cmp/cmn
		{s: 4, k: 'enum', sym: 'oper', enum: [
			false, false, false, false, false, false, false, false,
			'tst', 'teq', 'cmp', 'cmn', false, false, false, false
		]},
		{s: 1, k: 'value', sym: 'immediate', v: 0}, // immediate = 0
		{s: 2, k: 'value', v: 0},
		condition
	],
	syntax: [
		'$oper$cond $Rn, $Rm',
		'$oper$cond $Rn, $Rm, lsr #0',
		'$oper$cond $Rn, $Rm, asr #0',
		'$oper$cond $Rn, $Rm, ror #0'
	]
}, {
	todo: true
	// shift=lsr, amount=0, syntax for shift should be `lsr #32`
}, {
	todo: true
	// shift=asr, amount=0, syntax for shift should be `asr #32`
}, {
	todo: true
	// shift=ror, amount=0, syntax for shift should be `rrx`
}, {
	arm: true,
	ref: '4.5,4.5.8.2',
	category: 'Data Processing',
	codeParts: [
		{s: 4, k: 'register', sym: 'Rm'},
		{s: 1, k: 'value', v: 0},
		{s: 2, k: 'enum', sym: 'shift', enum: ['lsl/asl', 'lsr', 'asr', 'ror']},
		{s: 5, k: 'immediate', sym: 'amount'},
		{s: 4, k: 'ignored', v: 0}, // Rd is ignored for tst/teq/cmp/cmn
		{s: 4, k: 'register', sym: 'Rn'},
		{s: 1, k: 'value', sym: 's', v: 1}, // s is always 1 for tst/teq/cmp/cmn
		{s: 4, k: 'enum', sym: 'oper', enum: [
			false, false, false, false, false, false, false, false,
			'tst', 'teq', 'cmp', 'cmn', false, false, false, false
		]},
		{s: 1, k: 'value', sym: 'immediate', v: 0}, // immediate = 0
		{s: 2, k: 'value', v: 0},
		condition
	],
	syntax: ['$oper$cond $Rn, $Rm, $shift #$amount']
}, {
	todo: true
	// tst/teq/cmp/cmn where immediate=1, <Op2>=#expression
}, {
	todo: true
	// and,eor,sub,rsb,add,adc,sbc,rsc,orr,bic where immediate=0, shift=lsl, amount=0
}, {
	todo: true
	// shift=lsr, amount=0, syntax for shift should be `lsr #32`
}, {
	todo: true
	// shift=asr, amount=0, syntax for shift should be `asr #32`
}, {
	todo: true
	// shift=ror, amount=0, syntax for shift should be `rrx`
}, {
	todo: true
	// and,eor,sub,rsb,add,adc,sbc,rsc,orr,bic where immediate=0, shift=lsl, amount=0
}, {
	todo: true
	// shift=lsr, amount=0, syntax for shift should be `lsr #32`
}, {
	todo: true
	// shift=asr, amount=0, syntax for shift should be `asr #32`
}, {
	todo: true
	// shift=ror, amount=0, syntax for shift should be `rrx`
}, {
	todo: true
	// and,eor,sub,rsb,add,adc,sbc,rsc,orr,bic where immediate=0, catch all
}, {
	todo: true
	// and,eor,sub,rsb,add,adc,sbc,rsc,orr,bic where immediate=1
}

//
// PSR TRANSFER
//
];

function check(it){
	var result = true;
	var my = {
		ch: (k, hint, fn) => {
			if (!fn(it[k])){
				result = false;
				console.error('Expecting', k, 'to be', hint, 'but instead got', it[k]);
			}
			return my;
		},
		bool: k => my.ch(k, 'bool', v => typeof v === 'boolean'),
		str: k => my.ch(k, 'str', v => typeof v === 'string'),
		strList: k => my.ch(k, 'strList', v => Array.isArray(v) && v.every(i => typeof i === 'string')),
		int: k => my.ch(k, 'sint', v => typeof v === 'number' && Math.floor(v) === v),
		pint: k => my.ch(k, 'pint', v => typeof v === 'number' && Math.floor(v) === v && v > 0),
		uint: k => my.ch(k, 'uint', v => typeof v === 'number' && Math.floor(v) === v && v >= 0),
		enum: k => my.ch(k, 'enum', v => Array.isArray(v) && v.length > 0 &&
			v.every(w => w === false || typeof w === 'string')),
		inc: (k, e) => my.ch(k, `inc ${e}`, v => e.includes(v)),
		reg: (k, r) => my.ch(k, `reg ${r}`, v => r.test(v)),
		list: (k, c) => my.ch(k, 'list', v => Array.isArray(v) && v.every(i => c(check(i)))),
		adt: (k, o) => my.ch(k, `adt ${Object.keys(o)}`,
			v => typeof o[v] === 'function' && o[v](my)),
		done: () => {
			if (!result)
				console.error('Failed validation for:', it);
		}
	};
	return my;
}

ops.filter(op => !op.todo).forEach(op => check(op)
	.bool('arm')
	.reg('ref', /^[0-9]+(\.[0-9]+)*(,[0-9]+(\.[0-9]+)*)*$/)
	.inc('category', [
		'Branch',
		'Data Processing'
	])
	.strList('syntax')
	.list('codeParts', p => p
		.pint('s')
		.adt('k', {
			register: p => p.str('sym') && /^[a-zA-Z0-9_]*$/.test(p.sym) &&
				p.sym !== 'op' && p.sym !== 'asm', // reserved symbols
			value: p => p.uint('v'),
			enum: p => p.str('sym').enum('enum') && p.enum.length === (1 << p.s),
			ignored: p => p.uint('v'),
			immediate: p => p.str('sym'),
			offset: p => true
		})
	)
	.done()
);

//
// Disassembler
//

const hex = n => `0x${n.toString(16)}`;
const hex32 = n => '0x' + `0000000${n.toString(16)}`.substr(-8);

const out = [];

out.push('function registerStr(r){');
out.push('\tif (r === 13) return "sp";');
out.push('\tif (r === 14) return "lr";');
out.push('\tif (r === 15) return "pc";');
out.push('\treturn `r${r}`;');
out.push('}');

out.push('');

out.push('function parseARM(op){');
ops.filter(op => !op.todo && op.arm).forEach((op, opi) => {
	// create a bit mask
	var mask = 0;
	var mval = 0;
	var bpos = 0;
	op.codeParts.forEach(p => {
		if (p.k === 'value'){
			mask += ((1 << p.s) - 1) << bpos;
			mval += p.v << bpos;
		}
		bpos += p.s;
	});

	out.push(`\tdo if ((op & ${hex32(mask)}) === ${mval === 0 ? 0 : hex32(mval)}){`);
	out.push(`\t\t// [${opi}] ${op.category}`);

	bpos = 0;
	op.codeParts.forEach(p => {
		switch (p.k){
			case 'register':
			case 'enum':
			case 'immediate':
			case 'offset':
				out.push(`\t\tconst ${p.sym} = ${
					bpos === 0 ? 'op' : `(op >> ${bpos})`
				} & ${hex((1 << p.s) - 1)}; // ${p.k}`);
				if (p.k === 'enum' && p.enum.some(e => e === false)){
					out.push('\t\tif (');
					var ranges = [];
					p.enum.forEach((e, ei) => {
						if (e !== false)
							return;
						if (ranges.length <= 0 ||
							ranges[ranges.length - 1][1] !== ei - 1)
							ranges.push([ei, ei]);
						else
							ranges[ranges.length - 1][1] = ei;
					});
					var last = false;
					ranges.forEach(r => {
						if (last !== false)
							out.push(`${last} ||`);
						if (r[0] === r[1])
							last = `\t\t\t${p.sym} === ${r[0]}`;
						else
							last = `\t\t\t(${p.sym} >= ${r[0]} && ${p.sym} < ${r[1] + 1})`;
					});
					out.push(last);
					out.push(`\t\t) break; // invalid enum ${p.sym}`);
				}
				break;
			case 'value':
			case 'ignored':
				break;
		}
		bpos += p.s;
	});
	// construct syntax
	out.push('\t\tlet asm = "";');
	let syntax = op.syntax[0];
	while (syntax !== ''){
		const d = syntax.indexOf('$');
		if (d === 0){
			const sym = syntax.match(/^\$([a-zA-Z0-9_]*)/)[1];
			const p = op.codeParts.find(p => p.sym === sym);
			if (!p)
				console.error(`Invalid symbol "${sym}" in syntax "${op.syntax}"`);
			else{
				switch (p.k){
					case 'register':
						out.push(`\t\tasm += registerStr(${sym});`);
						break;
					case 'enum': {
						let el = 'if     ';
						p.enum.filter(e => e !== false).forEach((e, ei) => {
							const es = e.split('/')[0];
							if (es !== ''){
								out.push(`\t\t${el} (${sym} === ${ei}) asm += ${
									JSON.stringify(es)
								};`);
								el = 'else if';
							}
						});
					} break;
					case 'immediate':
					case 'offset': // TODO: figure out offsetting labels???
						out.push(`\t\tasm += ${sym};`);
						break;
					default:
						console.error(`Invalid symbol "${sym}" in syntax "${op.syntax}"`);
						break;
				}
			}
			syntax = syntax.substr(sym.length + 1);
		}
		else{
			out.push(`\t\tasm += ${JSON.stringify(d < 0 ? syntax : syntax.substr(0, d))};`);
			if (d < 0)
				break;
			syntax = syntax.substr(d);
		}
	}
	out.push('\t\treturn asm;');
	out.push('\t} while (false);');
});
out.push('\treturn false;');
out.push('}');

//
// Assembler
//

out.push('');

out.push('function generateARM(asm){');
out.push('\tasm = asm.trim().replace(/\\s+/g, " ").toLowerCase();');
out.push('\treturn false;');
out.push('}');
//console.log(out.join('\n'));
