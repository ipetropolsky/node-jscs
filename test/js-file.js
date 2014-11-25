var assert = require('assert');
var esprima = require('esprima');
var harmonyEsprima = require('esprima-harmony-jscs');
var JsFile = require('../lib/js-file');
var sinon = require('sinon');

describe('modules/js-file', function() {

    function createJsFile(sources) {
        return new JsFile(
            'example.js',
            sources,
            esprima.parse(sources, {loc: true, range: true, comment: true, tokens: true})
        );
    }

    function createHarmonyJsFile(sources) {
        return new JsFile(
            'example.js',
            sources,
            harmonyEsprima.parse(sources, {loc: true, range: true, comment: true, tokens: true})
        );
    }

    describe('constructor', function() {

        it('should accept empty token tree', function() {
            var file = new JsFile(null, 'Hello\nWorld', null);
            assert(Array.isArray(file.getTokens()));
            assert.equal(file.getTokens().length, 0);
        });

        // Testing esprima token fix
        // https://code.google.com/p/esprima/issues/detail?id=481
        describe('Keywords -> Identifier fixing', function() {
            it('should affect object keys tokens', function() {
                var str = '({' +
                    'break: true, export: true, return: true, case: true, for: true, switch: true, comment: true,' +
                    'function: true, this: true, continue: true, if: true, typeof: true, default: true, import: true,' +
                    'var: true, delete: true, in: true, void: true, do: true, label: true, while: true, else: true,' +
                    'new: true, with: true, catch: true, try: true, finally: true' +
                    '})';
                createJsFile(str).getTokens().forEach(function(token) {
                    assert(token.type !== 'Keyword');
                });
            });

            it('should affect member access tokens', function() {
                var str = 'o.break(); o.export(); o.return(); o.case(); o.for(); o.switch(); o.comment();' +
                    'o.function(); o.this(); o.continue(); o.if(); o.typeof(); o.default(); o.import();' +
                    'o.var(); o.delete(); o.in(); o.void(); o.do(); o.label(); o.while(); o.else();' +
                    'o.new(); o.with(); o.catch(); o.try(); o.finally();';
                createJsFile(str).getTokens().forEach(function(token) {
                    assert(token.type !== 'Keyword');
                });
            });

            it('should not affect valid nested constructions', function() {
                createJsFile('if (true) { if (false); }').getTokens().forEach(function(token) {
                    if (token.value === 'if') {
                        assert(token.type === 'Keyword');
                    }
                });
            });
        });
    });

    describe('isEnabledRule', function() {
        it('should always return true when no control comments are used', function() {
            var file = createJsFile(['var x = "1";', 'x++;', 'x--;'].join('\n'));
            assert(file.isEnabledRule('validateQuoteMarks', 1));
            assert(file.isEnabledRule('validateQuoteMarks', 2));
            assert(file.isEnabledRule('validateQuoteMarks', 3));
        });

        it('should always return false when jscs is disabled', function() {
            var file = createJsFile(['// jscs: disable', 'var x = "1";', 'x++;', 'x--;'].join('\n'));
            assert(!file.isEnabledRule('validateQuoteMarks', 2));
            assert(!file.isEnabledRule('validateQuoteMarks', 3));
            assert(!file.isEnabledRule('validateQuoteMarks', 4));
        });

        it('should return true when jscs is reenabled', function() {
            var file = createJsFile([
                '// jscs: disable',
                'var x = "1";',
                '// jscs: enable',
                'x++;',
                'x--;'
            ].join('\n'));
            assert(!file.isEnabledRule('validateQuoteMarks', 2));
            assert(file.isEnabledRule('validateQuoteMarks', 4));
            assert(file.isEnabledRule('validateQuoteMarks', 5));
        });

        it('should ignore other comments', function() {
            var file = createJsFile([
                '// jscs: disable',
                'var x = "1";',
                '// jscs: enable',
                'x++;',
                '// hello world',
                'x--;'
            ].join('\n'));
            assert(!file.isEnabledRule('validateQuoteMarks', 2));
            assert(file.isEnabledRule('validateQuoteMarks', 4));
            assert(file.isEnabledRule('validateQuoteMarks', 6));
        });

        it('should accept block comments', function() {
            var file = createJsFile([
                '/* jscs: disable */',
                'var x = "1";',
                '/* jscs: enable */',
                'x++;',
                'x--;'
            ].join('\n'));
            assert(!file.isEnabledRule('validateQuoteMarks', 2));
            assert(file.isEnabledRule('validateQuoteMarks', 4));
            assert(file.isEnabledRule('validateQuoteMarks', 5));
        });

        it('should only enable the specified rule', function() {
            var file = createJsFile([
                '// jscs: disable',
                'var x = "1";',
                '// jscs: enable validateQuoteMarks',
                'x++;',
                '// jscs: enable',
                'x--;'
            ].join('\n'));
            assert(!file.isEnabledRule('validateQuoteMarks', 2));
            assert(file.isEnabledRule('validateQuoteMarks', 4));
            assert(file.isEnabledRule('newRule', 7));
        });

        it('should ignore leading and final comma', function() {
            var file = createJsFile([
                '// jscs: disable',
                'var x = "1";',
                '// jscs: enable ,validateQuoteMarks,',
                'x++;'
            ].join('\n'));
            assert(!file.isEnabledRule('validateQuoteMarks', 2));
            assert(file.isEnabledRule('validateQuoteMarks', 4));
        });

        it('should only disable the specified rule', function() {
            var file = createJsFile([
                '// jscs: disable validateQuoteMarks',
                'var x = "1";',
                '// jscs: enable newRule',
                'x++;',
                '// jscs: enable',
                'x--;'
            ].join('\n'));
            assert(!file.isEnabledRule('validateQuoteMarks', 2));
            assert(!file.isEnabledRule('validateQuoteMarks', 4));
            assert(file.isEnabledRule('validateQuoteMarks', 7));
        });
    });

    describe('iterateNodesByType', function() {
        it('should handle ES6 export keyword', function() {
            var spy = sinon.spy();
            createHarmonyJsFile('export function foo() { var a = "b"; };')
                .iterateNodesByType('VariableDeclaration', spy);
            assert(spy.calledOnce);
        });
    });

    describe('iterateTokenByValue',  function() {
        it('should find token by value', function() {
            createJsFile('if (true);').iterateTokenByValue(')', function(token, index, tokens) {
                assert(token.value === ')');
                assert(index === 3);
                assert(Array.isArray(tokens));
            });
        });

        it('should find tokens by value', function() {
            createJsFile('if (true);').iterateTokenByValue([')', '('], function(token, index, tokens) {
                assert(token.value === ')' || token.value === '(');
                assert(index === 3 || index === 1);
                assert(Array.isArray(tokens));
            });
        });

        it('should not find string value', function() {
            var spy = sinon.spy();
            createJsFile('"("').iterateTokenByValue('(', spy);
            assert(!spy.calledOnce);
        });

        it('should not take only own propeties', function() {
            var spy = sinon.spy();
            createJsFile('test.toString').iterateTokenByValue('(', spy);
            assert(!spy.calledOnce);
        });
    });

    describe('getNodeByRange', function() {
        it('should get node by range for function declaration', function() {
            assert.equal(createJsFile('function foo(a,b) {}').getNodeByRange(16).type, 'FunctionDeclaration');
        });

        it('should get node by range for function expression', function() {
            assert.equal(createJsFile('foo(a,b)').getNodeByRange(7).type, 'CallExpression');
        });

        it('should get node by range for function expression inside "if" statement', function() {
            assert.equal(createJsFile('if(true){foo(a,b)}').getNodeByRange(16).type, 'CallExpression');
        });

        it('should get node by range for function expression with additional parentheses', function() {
            assert.equal(createJsFile('foo(1,(2))').getNodeByRange(9).type, 'CallExpression');
        });

        it('should return empty object', function() {
            assert.equal(createJsFile('foo(1,2)').getNodeByRange(20).type, undefined);
        });

        it('should not throw on regexp', function() {
            var file = createJsFile('/^/');
            try {
                file.getNodeByRange(1);
                assert(true);
            } catch (e) {
                assert(false);
            }
        });
    });

    describe('findNextToken', function() {
        var file = createJsFile('switch(varName){case"yes":a++;break;}');

        it('should find the first next token when only the type is specified', function() {
            var switchToken = file.getTokens()[0];
            assert.equal(switchToken.type, 'Keyword');
            assert.equal(switchToken.value, 'switch');

            var nextToken = file.findNextToken(switchToken, 'Identifier');
            assert.equal(nextToken.type, 'Identifier');
            assert.equal(nextToken.value, 'varName');

            nextToken = file.findNextToken(switchToken, 'Keyword');
            assert.equal(nextToken.type, 'Keyword');
            assert.equal(nextToken.value, 'case');

            nextToken = file.findNextToken(switchToken, 'Punctuator');
            assert.equal(nextToken.type, 'Punctuator');
            assert.equal(nextToken.value, '(');
        });

        it('should find the first next token when both type and value are specified', function() {
            var switchToken = file.getTokens()[0];
            assert.equal(switchToken.type, 'Keyword');
            assert.equal(switchToken.value, 'switch');

            var nextToken = file.findNextToken(switchToken, 'Identifier', 'varName');
            assert.equal(nextToken.type, 'Identifier');
            assert.equal(nextToken.value, 'varName');

            nextToken = file.findNextToken(switchToken, 'Keyword', 'case');
            assert.equal(nextToken.type, 'Keyword');
            assert.equal(nextToken.value, 'case');

            nextToken = file.findNextToken(switchToken, 'Punctuator', '(');
            assert.equal(nextToken.type, 'Punctuator');
            assert.equal(nextToken.value, '(');
        });

        it('should find the correct next token when both type and value are specified', function() {
            var switchToken = file.getTokens()[0];
            assert.equal(switchToken.type, 'Keyword');
            assert.equal(switchToken.value, 'switch');

            var nextToken = file.findNextToken(switchToken, 'Keyword', 'break');
            assert.equal(nextToken.type, 'Keyword');
            assert.equal(nextToken.value, 'break');

            nextToken = file.findNextToken(switchToken, 'Punctuator', '{');
            assert.equal(nextToken.type, 'Punctuator');
            assert.equal(nextToken.value, '{');

            nextToken = file.findNextToken(switchToken, 'Punctuator', ':');
            assert.equal(nextToken.type, 'Punctuator');
            assert.equal(nextToken.value, ':');

            nextToken = file.findNextToken(switchToken, 'Punctuator', '}');
            assert.equal(nextToken.type, 'Punctuator');
            assert.equal(nextToken.value, '}');
        });

        it('should not find any token if it does not exist', function() {
            var switchToken = file.getTokens()[0];
            assert.equal(switchToken.type, 'Keyword');
            assert.equal(switchToken.value, 'switch');

            var nextToken = file.findNextToken(switchToken, 'Keyword', 'if');
            assert.equal(nextToken, undefined);

            nextToken = file.findNextToken(switchToken, 'Numeric');
            assert.equal(nextToken, undefined);

            nextToken = file.findNextToken(switchToken, 'Boolean');
            assert.equal(nextToken, undefined);

            nextToken = file.findNextToken(switchToken, 'Null');
            assert.equal(nextToken, undefined);
        });
    });

    describe('findPrevToken', function() {
        var file = createJsFile('switch(varName){case"yes":a++;break;}');
        var tokens = file.getTokens();

        it('should find the first previous token when only the type is specified', function() {
            var lastToken = tokens[tokens.length - 1];
            assert.equal(lastToken.type, 'Punctuator');
            assert.equal(lastToken.value, '}');

            var previousToken = file.findPrevToken(lastToken, 'Identifier');
            assert.equal(previousToken.type, 'Identifier');
            assert.equal(previousToken.value, 'a');

            previousToken = file.findPrevToken(lastToken, 'Keyword');
            assert.equal(previousToken.type, 'Keyword');
            assert.equal(previousToken.value, 'break');

            previousToken = file.findPrevToken(lastToken, 'Punctuator');
            assert.equal(previousToken.type, 'Punctuator');
            assert.equal(previousToken.value, ';');
        });

        it('should find the first previous token when both type and value are specified', function() {
            var lastToken = tokens[tokens.length - 1];
            assert.equal(lastToken.type, 'Punctuator');
            assert.equal(lastToken.value, '}');

            var previousToken = file.findPrevToken(lastToken, 'Identifier', 'a');
            assert.equal(previousToken.type, 'Identifier');
            assert.equal(previousToken.value, 'a');

            previousToken = file.findPrevToken(lastToken, 'Keyword', 'break');
            assert.equal(previousToken.type, 'Keyword');
            assert.equal(previousToken.value, 'break');

            previousToken = file.findPrevToken(lastToken, 'Punctuator', ';');
            assert.equal(previousToken.type, 'Punctuator');
            assert.equal(previousToken.value, ';');
        });

        it('should find the correct previous token when both type and value are specified', function() {
            var lastToken = tokens[tokens.length - 1];
            assert.equal(lastToken.type, 'Punctuator');
            assert.equal(lastToken.value, '}');

            var previousToken = file.findPrevToken(lastToken, 'Keyword', 'case');
            assert.equal(previousToken.type, 'Keyword');
            assert.equal(previousToken.value, 'case');

            previousToken = file.findPrevToken(lastToken, 'Punctuator', '{');
            assert.equal(previousToken.type, 'Punctuator');
            assert.equal(previousToken.value, '{');

            previousToken = file.findPrevToken(lastToken, 'Punctuator', ':');
            assert.equal(previousToken.type, 'Punctuator');
            assert.equal(previousToken.value, ':');

            previousToken = file.findPrevToken(lastToken, 'Punctuator', '(');
            assert.equal(previousToken.type, 'Punctuator');
            assert.equal(previousToken.value, '(');
        });

        it('should not find any token if it does not exist', function() {
            var lastToken = tokens[tokens.length - 1];
            assert.equal(lastToken.type, 'Punctuator');
            assert.equal(lastToken.value, '}');

            var previousToken = file.findPrevToken(lastToken, 'Keyword', 'if');
            assert.equal(previousToken, undefined);

            previousToken = file.findPrevToken(lastToken, 'Numeric');
            assert.equal(previousToken, undefined);

            previousToken = file.findPrevToken(lastToken, 'Boolean');
            assert.equal(previousToken, undefined);

            previousToken = file.findPrevToken(lastToken, 'Null');
            assert.equal(previousToken, undefined);
        });

        it('should find prev token', function() {
            file = createJsFile('if (true);');

            var trueToken = file.getTokens()[2];
            assert.equal(trueToken.type, 'Boolean');
            assert.equal(trueToken.value, 'true');

            var ifToken = file.findPrevToken(trueToken, 'Keyword');
            assert.equal(ifToken.type, 'Keyword');
            assert.equal(ifToken.value, 'if');

            ifToken = file.findPrevToken(trueToken, 'Keyword', 'if');
            assert.equal(ifToken.type, 'Keyword');
            assert.equal(ifToken.value, 'if');
        });
    });

    describe('findNextOperatorToken', function() {
        it('should should return next punctuator', function() {
            var file = createJsFile('x = y;');
            var token = file.findNextOperatorToken(file.getTokens()[0], '=');
            assert.equal(token.type, 'Punctuator');
            assert.equal(token.value, '=');
            assert.equal(token.range[0], 2);
        });

        it('should should return next operator-keyword', function() {
            var file = createJsFile('x instanceof y;');
            var token = file.findNextOperatorToken(file.getTokens()[0], 'instanceof');
            assert.equal(token.type, 'Keyword');
            assert.equal(token.value, 'instanceof');
            assert.equal(token.range[0], 2);
        });

        it('should should return undefined for non-found token', function() {
            var file = createJsFile('x = y;');
            var token = file.findNextOperatorToken(file.getTokens()[0], '-');
            assert(token === undefined);
        });
    });

    describe('findPrevOperatorToken', function() {
        it('should should return next punctuator', function() {
            var file = createJsFile('x = y;');
            var token = file.findPrevOperatorToken(file.getTokens()[2], '=');
            assert.equal(token.type, 'Punctuator');
            assert.equal(token.value, '=');
            assert.equal(token.range[0], 2);
        });

        it('should should return next operator-keyword', function() {
            var file = createJsFile('x instanceof y;');
            var token = file.findPrevOperatorToken(file.getTokens()[2], 'instanceof');
            assert.equal(token.type, 'Keyword');
            assert.equal(token.value, 'instanceof');
            assert.equal(token.range[0], 2);
        });

        it('should should return undefined for non-found token', function() {
            var file = createJsFile('x = y;');
            var token = file.findPrevOperatorToken(file.getTokens()[2], '-');
            assert(token === undefined);
        });
    });

    describe('getTokenByRangeStart', function() {
        it('should return token for specified start position', function() {
            var str = 'if (true) { x++; }';
            var file = new JsFile(null, str, esprima.parse(str, {loc: true, range: true, tokens: true}));

            var ifToken = file.getTokenByRangeStart(0);
            assert.equal(ifToken.type, 'Keyword');
            assert.equal(ifToken.value, 'if');

            var incToken = file.getTokenByRangeStart(12);
            assert.equal(incToken.type, 'Identifier');
            assert.equal(incToken.value, 'x');
        });

        it('should return undefined if token was not found', function() {
            var str = 'if (true) { x++; }';
            var file = new JsFile(null, str, esprima.parse(str, {loc: true, range: true, tokens: true}));

            var token = file.getTokenByRangeStart(1);
            assert(token === undefined);
        });
    });

    describe('getTokenByRangeEnd', function() {
        it('should return token for specified end position', function() {
            var str = 'if (true) { x++; }';
            var file = new JsFile(null, str, esprima.parse(str, {loc: true, range: true, tokens: true}));

            var ifToken = file.getTokenByRangeEnd(2);
            assert.equal(ifToken.type, 'Keyword');
            assert.equal(ifToken.value, 'if');

            var incToken = file.getTokenByRangeEnd(13);
            assert.equal(incToken.type, 'Identifier');
            assert.equal(incToken.value, 'x');
        });

        it('should return undefined if token was not found', function() {
            var str = 'if (true) { x++; }';
            var file = new JsFile(null, str, esprima.parse(str, {loc: true, range: true, tokens: true}));

            var token = file.getTokenByRangeEnd(3);
            assert(token === undefined);
        });
    });

    describe('getFirstNodeToken', function() {
        it('should return token for specified node', function() {
            var str = 'if (true) { while (true) x++; }';
            var file = new JsFile(null, str, esprima.parse(str, {loc: true, range: true, tokens: true}));

            var ifToken = file.getFirstNodeToken(file.getNodesByType('IfStatement')[0]);
            assert.equal(ifToken.type, 'Keyword');
            assert.equal(ifToken.value, 'if');

            var incToken = file.getFirstNodeToken(file.getNodesByType('UpdateExpression')[0]);
            assert.equal(incToken.type, 'Identifier');
            assert.equal(incToken.value, 'x');
        });
    });

    describe('getLastNodeToken', function() {
        it('should return token for specified node', function() {
            var str = 'if (true) { while (true) x++; }';
            var file = new JsFile(null, str, esprima.parse(str, {loc: true, range: true, tokens: true}));

            var ifToken = file.getLastNodeToken(file.getNodesByType('IfStatement')[0]);
            assert.equal(ifToken.type, 'Punctuator');
            assert.equal(ifToken.value, '}');

            var incToken = file.getLastNodeToken(file.getNodesByType('UpdateExpression')[0]);
            assert.equal(incToken.type, 'Punctuator');
            assert.equal(incToken.value, '++');
        });
    });
});
