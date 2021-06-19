//
// GBA Tools by Sean Connelly (@velipso), https://sean.cm
// The Unlicense License
// Project Home: https://github.com/velipso/gbasm
//

const fs = require('fs');
const path = require('path');

function isIdentStart(ch){
	return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

function isIdentBody(ch){
	return isIdentStart(ch) || (ch >= '0' && ch <= '9');
}

function lexer(fileName, data){
	var tokens = [];
	var i = 0;
	var state = 'start';
	var buf = '';
	var line = 1;
	var chr = 1;
	var beginLine = 0;
	var beginChr = 0;
	var intBase = 0;

	function tokenBegin(){
		beginLine = line;
		beginChr = chr;
	}

	function getPos(){
		return {fileName, beginLine, beginChr, endLine: line, endChr: chr};
	}

	function tokenError(error){
		tokens.push({pos: getPos(), kind: 'error', error});
	}
	function tokenIdent(ident){
		tokens.push({pos: getPos(), kind: 'ident', ident});
	}
	function tokenSingle(single){
		tokens.push({pos: getPos(), kind: 'single', single});
	}
	function tokenString(string){
		tokens.push({pos: getPos(), kind: 'string', string});
	}
	function tokenInt(intStr, intBase){
		tokens.push({pos: getPos(), kind: 'int', intStr, intBase});
	}

	while (i < data.length){
		var ch = data.charAt(i);
		var nch = i < data.length - 1 ? data.charAt(i + 1) : '';

		switch (state){
			case 'start':
				if (ch === '/' && nch === '/')
					state = 'line comment';
				else if (ch === '/' && nch === '*')
					state = 'block comment 1';
				else if (isIdentStart(ch)){
					tokenBegin();
					if (isIdentBody(nch)){
						buf = ch;
						state = 'ident';
					}
					else
						tokenIdent(ch);
				}
				else if (ch >= '0' && ch <= '9'){
					tokenBegin();
					intBase = 10;
					state = 'int';
					buf = '';
					if (ch === '0' && nch === 'x'){
						state = 'int skip';
						intBase = 16;
					}
					else if (ch === '0' && nch === 'c'){
						state = 'int skip';
						intBase = 8;
					}
					else if (ch === '0' && nch === 'b'){
						state = 'int skip';
						intBase = 2;
					}
					else if (nch >= '0' && nch <= '9')
						buf = ch;
					else{
						tokenInt(ch, 10);
						state = 'start';
					}
				}
				else if ('~!@#$%^&*()+={[}]|:;<,>.?/\n'.indexOf(ch) >= 0){
					tokenBegin();
					tokenSingle(ch);
				}
				else if (ch === '"'){
					tokenBegin();
					buf = '';
					state = 'string';
				}
				else if ('\r\t '.indexOf(ch) >= 0)
					/* do nothing */;
				else{
					tokenBegin();
					tokenError(`Unexpected character: ${ch}`);
				}
				break;
			case 'line comment':
				if (ch === '\n')
					state = 'start';
				break;
			case 'block comment 1':
				state = 'block comment 2';
				break;
			case 'block comment 2':
				if (ch === '*' && nch === '/')
					state = 'block comment 3';
				break;
			case 'block comment 3':
				state = 'start';
				break;
			case 'ident':
				buf += ch;
				if (!isIdentBody(nch)){
					tokenIdent(buf);
					state = 'start';
				}
				break;
			case 'string':
				if (ch === '\\')
					state = 'string escape';
				else if (ch === '"'){
					tokenString(buf);
					state = 'start';
				}
				else if (ch === '\r' || ch === '\n'){
					tokenError('Missing end of string');
					state = 'start';
				}
				else
					buf += ch;
				break;
			case 'string escape':
				if (ch === '\r' || ch === '\n'){
					tokenError('Missing end of string');
					state = 'start';
				}
				else{
					if (ch === '0')
						buf += '\0';
					else if (ch === 'r')
						buf += '\r';
					else if (ch === 'n')
						buf += '\n';
					else if (ch === 't')
						buf += '\t';
					else if (ch === '"' || ch === '\\')
						buf += ch;
					else
						tokenError(`Invalid escape code: \\${ch}`);
					state = 'string';
				}
				break;
			case 'int skip':
				state = 'int';
				break;
			case 'int':
				buf += ch;
				if (!isIdentBody(nch)){
					if (intBase === 10 && !/^[0-9]+$/.test(buf))
						tokenError(`Invalid decimal integer: ${buf}`);
					else if (intBase === 16 && !/^[0-9a-fA-F]+$/.test(buf))
						tokenError(`Invalid hex integer: 0x${buf}`);
					else if (intBase === 8 && !/^[0-7]+$/.test(buf))
						tokenError(`Invalid oct integer: 0c${buf}`);
					else if (intBase === 2 && !/^[01]$/.test(buf))
						tokenError(`Invalid binary integer: 0b${buf}`);
					else
						tokenInt(buf, intBase);
					state = 'start';
				}
				break;
		}

		i++;
		if (ch === '\n'){
			line++;
			chr = 1;
		}
		else
			chr++;
	}

	switch (state){
		case 'start':
		case 'line comment':
		case 'block comment 3':
		case 'ident':
		case 'int skip':
			break;
		case 'block comment 1':
		case 'block comment 2':
			tokenError('Missing end of block comment');
			break;
		case 'string':
		case 'string escape':
		case 'string error':
			tokenError('Missing end of string');
			break;
		case 'int':
			tokenError('Invalid integer');
			break;
	}

	return tokens;
}

function groupParse(tokens){
	var groups = [];
	var i = 0;
	var state = 'start';
	var header = [];
	var body = [];
	var braces = 0;
	var beginIndex = 0;
	var label = '';
	var file = '';
	var includeTok = false;
	var embedTok = false;

	function getPos(){
		return {beginIndex, endIndex: i};
	}

	function groupError(error, tok){
		groups.push({kind: 'error', error, tok});
	}
	function groupErrorInclude(){
		groupError('Invalid include command', includeTok);
	}
	function groupErrorEmbed(){
		groupError('Invalid embed command', embedTok);
	}
	function groupInclude(file){
		groups.push({kind: 'include', file});
	}
	function groupEmbed(label, file){
		groups.push({kind: 'embed', label, file});
	}
	function groupBody(header, body){
		groups.push({kind: 'body', header, body});
	}

	while (i < tokens.length){
		var tok = tokens[i];

		var isOpenBrace = tok.kind === 'single' && tok.single === '{';
		var isCloseBrace = tok.kind === 'single' && tok.single === '}';
		var isOpenParen = tok.kind === 'single' && tok.single === '(';
		var isCloseParen = tok.kind === 'single' && tok.single === ')';
		var isNewline = tok.kind === 'single' && tok.single === '\n';

		switch (state){
			case 'start':
				if (tok.kind === 'ident' && tok.ident.toLowerCase() === 'include'){
					includeTok = tok;
					state = 'include 1';
				}
				else if (tok.kind === 'ident' && tok.ident.toLowerCase() === 'embed'){
					embedTok = tok;
					state = 'embed 1';
				}
				else if (isOpenBrace){
					header = [];
					body = [];
					state = 'body';
				}
				else if (!isNewline){
					header = [tok];
					body = [];
					state = 'header';
				}
				break;
			case 'include 1':
				if (isOpenParen)
					state = 'include 2';
				else if (!isNewline){
					groupErrorInclude();
					i--;
					state = 'start';
				}
				break;
			case 'include 2':
				if (tok.kind === 'string'){
					file = tok.string;
					state = 'include 3';
				}
				else if (!isNewline){
					groupErrorInclude();
					i--;
					state = 'start';
				}
				break;
			case 'include 3':
				if (isCloseParen){
					groupInclude(file);
					state = 'start';
				}
				else if (!isNewline){
					groupErrorInclude();
					i--;
					state = 'start';
				}
				break;
			case 'embed 1':
				if (tok.kind === 'ident'){
					label = tok.ident;
					state = 'embed 2';
				}
				else if (!isNewline){
					groupErrorEmbed();
					i--;
					state = 'start';
				}
				break;
			case 'embed 2':
				if (isOpenParen)
					state = 'embed 3';
				else if (!isNewline){
					groupErrorEmbed();
					i--;
					state = 'start';
				}
				break;
			case 'embed 3':
				if (tok.kind === 'string'){
					file = tok.string;
					state = 'embed 4';
				}
				else if (!isNewline){
					groupErrorEmbed();
					i--;
					state = 'start';
				}
				break;
			case 'embed 4':
				if (isCloseParen){
					groupEmbed(label, file);
					state = 'start';
				}
				else if (!isNewline){
					groupErrorEmbed();
					i--;
					state = 'start';
				}
				break;
			case 'header':
				if (isOpenBrace)
					state = 'body';
				else if (!isNewline)
					header.push(tok);
				break;
			case 'body':
				if (isOpenBrace)
					braces++;
				else if (isCloseBrace){
					braces--;
					if (braces < 0){
						groupBody(header, body);
						state = 'start';
					}
				}
				else
					body.push(tok);
				break;
		}

		i++;
	}

	switch (state){
		case 'start':
			break;
		case 'include 1':
		case 'include 2':
		case 'include 3':
			groupErrorInclude();
			break;
		case 'embed 1':
		case 'embed 2':
		case 'embed 3':
		case 'embed 4':
			groupErrorEmbed();
			break;
		case 'header':
			groupError('Invalid command', header[0]);
			break;
		case 'body':
			groupError('Missing end brace for command body', tokens[tokens.length - 1]);
			break;
	}

	return groups;
}

function makeFile(cwd, fileName){
	if (fileName.startsWith('/') || fileName.startsWith('\\'))
		return fileName;
	return path.join(cwd, fileName);
}

function loadGroups(cwd, fileName, alreadyIncluded, debugTokens, debugGroups){
	var fullFile = makeFile(cwd, fileName);

	if (alreadyIncluded.includes(fullFile))
		return [{kind: 'error', error: `Circular include: ${fileName}`}];
	alreadyIncluded = alreadyIncluded.concat([fullFile]);

	var data = false;
	try {
		data = fs.readFileSync(fullFile, 'utf8');
	} catch (e) {
		console.error('Failed to read file:', fullFile);
		console.error(e);
		return 1;
	}

	var tokens = lexer(fileName, data);

	if (debugTokens){
		console.log('Tokens:');
		for (var i = 0; i < tokens.length; i++){
			var t = JSON.parse(JSON.stringify(tokens[i]));
			delete t.pos;
			var kind = t.kind;
			delete t.kind;
			console.log(kind, t);
		}
	}

	// parse tokens into groups
	var groups = groupParse(tokens);

	if (debugGroups){
		console.log('Groups:');
		logGroups(groups);
	}

	var result = [];
	for (var i = 0; i < groups.length; i++){
		var g = groups[i];
		if (g.kind === 'include'){
			result = result.concat(loadGroups(path.dirname(fullFile), g.file, alreadyIncluded,
				debugTokens, debugGroups));
		}
		else if (g.kind === 'embed'){
			var file = makeFile(path.dirname(fullFile), g.file);
			result.push({kind: 'TODO: convert to data', file});
		}
		else
			result.push(g);
	}

	return result;
}

function logGroups(groups){
	for (var i = 0; i < groups.length; i++)
		console.log(i, groups[i]);
}

function assemble(cwd, fileName, debugTokens, debugGroups){
	var groups = loadGroups(cwd, fileName, [], debugTokens, debugGroups);

	if (debugGroups){
		console.log('Final Groups:');
		logGroups(groups);
	}

	// TODO: create a symbol table
}

function main(argv){
	var usage = 0;
	var inputFile = false;
	var outputFile = false;
	var debugTokens = false;
	var debugGroups = false;

	for (var i = 0; i < argv.length; i++){
		if (argv[i] === '-i'){
			if (i < argv.length - 1){
				if (inputFile === false)
					inputFile = argv[++i];
				else{
					usage = 1;
					console.error('Can\'t specify more than one input file');
					break;
				}
			}
			else{
				usage = 1;
				console.error('Missing input file');
				break;
			}
		}
		else if (argv[i] === '-o'){
			if (i < argv.length - 1){
				if (outputFile === false)
					outputFile = argv[++i];
				else{
					usage = 1;
					console.error('Can\'t specify more than one output file');
					break;
				}
			}
			else{
				usage = 1;
				console.error('Missing output file');
				break;
			}
		}
		else if (argv[i] === '--debugTokens')
			debugTokens = true;
		else if (argv[i] === '--debugGroups')
			debugGroups = true;
		else{
			console.error('Unknown option:', argv[i]);
			usage = 1;
			break;
		}
	}

	// check for printing usage
	if (usage === 1 || inputFile === false || outputFile === false){
		console.log('Usage:\n  node assembler/src -i input.s -o output.gba');
		return usage;
	}

	// assemble!
	assemble(process.cwd(), inputFile, debugTokens, debugGroups);

	return 0;
}

process.exit(main(process.argv.slice(2)));
