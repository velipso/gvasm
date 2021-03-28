(function(global){

function hex8(v){
	return ('0' + v.toString(16)).substr(-2);
}
function hex16(v){
	return ('000' + v.toString(16)).substr(-4);
}
function hex32(v){
	return ('0000000' + v.toString(16)).substr(-8);
}

function reader(data){
	var pc = 0;
	return {
		u8: function(){
			return data[pc++];
		},
		u16le: function(){
			var v1 = data[pc++];
			var v2 = data[pc++];
			return (v1 << 8) | v2;
		},
		u16be: function(){
			var v2 = data[pc++];
			var v1 = data[pc++];
			return (v1 << 8) | v2;
		},
		u32le: function(){
			var v1 = data[pc++];
			var v2 = data[pc++];
			var v3 = data[pc++];
			var v4 = data[pc++];
			return ((v1 << 23) * 2) + ((v2 << 16) | (v3 << 8) | v4);
		},
		u32be: function(){
			var v4 = data[pc++];
			var v3 = data[pc++];
			var v2 = data[pc++];
			var v1 = data[pc++];
			return ((v1 << 23) * 2) + ((v2 << 16) | (v3 << 8) | v4);
		},
		pc: function(){
			return pc;
		}
	};
}

function parseARM(op){
	var cond = (['EQ', 'NE', 'CS', 'CC', 'MI', 'PL', 'VS', 'VC', 'HI', 'LS', 'GE', 'LT', 'GT', 'LE',
		'AL', 'NV'])[(op >> 28) & 0xF];
	var condT = cond === 'AL' ? '' : cond;
	op = op & 0x0FFFFFFF;
	var category = 'Unknown';
	var inst = {};
	var text = '.dw 0x' + hex32(op);

	// xxxx 0000 00xx xxxx xxxx xxxx 1001 xxxx
	if ((op & 0x0FC000F0) === 0x00000090){
		category = 'Multiply (accumulate)';
	}
	// xxxx 0000 1xxx xxxx xxxx xxxx 1001 xxxx
	else if ((op & 0x0F8000F0) === 0x00800090){
		category = 'Multiply (accumulate) long';
	}
	// xxxx 0001 0010 1111 1111 1111 0001 xxxx
	else if ((op & 0x0FFFFFF0) === 0x012FFF10){
		category = 'Branch and exchange';
	}
	// xxxx 0001 0x00 xxxx xxxx 0000 1001 xxxx
	else if ((op & 0x0FB00FF0) === 0x01000090){
		category = 'Single data swap';
	}
	// xxxx 000x x0xx xxxx xxxx 0000 1011 xxxx
	else if ((op & 0x0E400FF0) === 0x000000B0){
		category = 'Halfword data transfer, register offset';
	}
	// xxxx 000x x1xx xxxx xxxx xxxx 1011 xxxx
	else if ((op & 0x0E4000F0) === 0x004000B0){
		category = 'Halfword data transfer, immediate offset';
	}
	// xxxx 000x xxxx xxxx xxxx xxxx 11x1 xxxx
	else if ((op & 0x0E0000D0) === 0x000000D0){
		category = 'Singed data transfer (byte/halfword)';
	}
	// xxxx 00xx xxxx xxxx xxxx xxxx xxxx xxxx
	else if ((op & 0x0C000000) === 0x00000000){
		category = 'Data processing and PSR transfer';
	}
	// xxxx 01xx xxxx xxxx xxxx xxxx xxxx xxxx
	else if ((op & 0x0C000000) === 0x04000000){
		category = 'Load/store register/unsigned byte';
		// xxxx xxIP UBWL Rn:4 Rd:4 addrMode:12
		// 0000 0101 1001
		// Rn = 1111 (r15/pc)
		// Rd = 1101 (r13)
		// addrMode = 0001 1010 0000
		var I = (op & 0x02000000) !== 0;
		var P = (op & 0x01000000) !== 0;
		var U = (op & 0x00800000) !== 0;
		var byte = (op & 0x00400000) !== 0;
		var W = (op & 0x00200000) !== 0;
		var L = (op & 0x00100000) !== 0;
		var Rn = (op >> 16) & 0xF;
		var Rd = (op >> 12) & 0xF;
		var addrMode = op & 0xFFF;

	}
	// xxxx 011x xxxx xxxx xxxx xxxx xxx1 xxxx
	else if ((op & 0x0E000010) === 0x06000010){
		category = 'Undefined';
	}
	// xxxx 100x x0xx xxxx xxxx xxxx xxxx xxxx
	else if ((op & 0x0E400000) === 0x08000000){
		category = 'Block data transfer';
	}
	// xxxx 101x xxxx xxxx xxxx xxxx xxxx xxxx
	else if ((op & 0x0E000000) === 0x0A000000){
		category = 'Branch';
		var offset = (op & 0x00FFFFFF) << 2;
		var link = (op & 0x01000000) === 0x01000000;
		text = (link ? 'BL' : 'B') + condT + ' #' + offset;
		inst = {
			kind: 'Branch',
			link: link,
			offset: offset
		};
	}
	// xxxx 110x xxxx xxxx xxxx xxxx xxxx xxxx
	else if ((op & 0x0E000000) === 0x0C000000){
		category = 'Coprocessor data transfer';
	}
	// xxxx 1110 xxxx xxxx xxxx xxxx xxx0 xxxx
	else if ((op & 0x0F000010) === 0x0E000000){
		category = 'Coprocessor data operation';
	}
	// xxxx 1110 xxxx xxxx xxxx xxxx xxx1 xxxx
	else if ((op & 0x0F000010) === 0x0E000010){
		category = 'Coprocessor register transfer';
	}
	// xxxx 1111 xxxx xxxx xxxx xxxx xxxx xxxx
	else if ((op & 0x0F000000) === 0x0F000000){
		category = 'Software interrupt';
	}

	return {
		cond: cond,
		category: category,
		text: text,
		inst: inst
	};
}

global.disassembleGBA = function(data){
	var read = reader(data);

	// read the header
	var header = {};
	header.branch = (function(){
		var branch = read.u32be();
		return {
			value: branch,
			hex: hex32(branch),
			parse: parseARM(branch)
		};
	})();
	header.logo = (function(){
		var logo = [];
		for (var i = 0; i < 156; i++)
			logo.push(read.u8());
		return logo;
	})();

	return {
		header: header
	};
};

global.disassembleBIOS = function(data){
	var read = reader(data);
	var ops = [];

	for (var i = 0; i < 100; i++)
		ops.push(parseARM(read.u32be()));

	return {
		ops: ops
	};
};

})(window);
