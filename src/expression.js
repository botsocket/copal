'use strict';

const Assert = require('@botbind/dust/src/assert');

const internals = {
    operators: ['+', '-', '*', '/', '%', '^', '**', '<=', '>=', '==', '<', '>', '!=', '&&', '||'],
    operatorCharacters: ['!', '^', '*', '/', '%', '+', '-', '<', '=', '>', '&', '|'],
    operatorsOrder: [['^', '**'], ['*', '/', '%'], ['+', '-'], ['<', '<=', '>', '>='], ['==', '!='], ['&&'], ['||']],
    operatorPrefixes: ['!', 'n'],

    literals: {
        '"': '"',
        '\'': '\'',
        '[': ']',
    },
    numberRx: /^\d+(?:\.\d+)?$/,
};

module.exports = internals.Expression = class {
    constructor(expr, settings) {
        this.settings = settings;

        this.resolved = null;
        this.parts = null;
        this.parse(expr);
    }

    parse(expr) {
        const parts = [];
        let current = '';
        let parens = 0;
        let literal = false;

        const flush = (lastParen) => {
            Assert(!parens, 'Parentheses do not match');

            const last = parts[parts.length - 1];

            if (!last &&
                !current &&
                !lastParen) {

                return;
            }

            // Functions

            if (last &&
                last.type === 'reference' &&
                lastParen) {

                last.type = 'function';
                last.value = this.fn(last.value, current);
                current = '';
                return;
            }

            // Sub expression

            if (lastParen) {
                parts.push({ type: 'expression', value: new internals.Expression(current, this.settings) });
                current = '';
                return;
            }

            // Literals

            if (literal) {
                if (literal === ']') { // Ambiguous reference
                    parts.push({ type: 'reference', value: current });
                    current = '';
                    return;
                }

                // Strings

                parts.push({ type: 'constant', value: current });
                current = '';
                return;
            }

            // Operators

            if (internals.operatorCharacters.includes(current)) {
                if (last &&
                    last.type === 'operator' &&
                    internals.operators.includes(last.value + current)) { // 2 character operators

                    last.value += current;
                    current = '';
                    return;
                }

                parts.push({ type: 'operator', value: current });
                current = '';
                return;
            }

            // Numbers

            if (internals.numberRx.test(current)) {
                parts.push({ type: 'constant', value: parseFloat(current) });
                current = '';
                return;
            }

            // Constants

            const constant = this.settings.constants[current];
            if (constant !== undefined) {
                Assert(constant === null || ['boolean', 'number', 'string'].includes(typeof constant), current, 'must be a boolean, number, string or null');

                parts.push({ type: 'constant', value: constant });
                current = '';
                return;
            }

            // References

            if (current) {
                parts.push({ type: 'reference', value: current });
                current = '';
            }
        };

        for (const char of expr) {
            if (parens) {
                if (char === '(') {
                    parens++;
                }

                if (char === ')') {
                    parens--;
                    if (!parens) {
                        flush(true);
                        continue;
                    }
                }

                current += char;
                continue;
            }

            Assert(char !== ')', 'Parentheses do not match');

            if (literal) {
                if (char === literal) {
                    flush();
                    literal = false;
                    continue;
                }

                current += char;
                continue;
            }

            if (internals.literals[char]) {
                literal = internals.literals[char];
                continue;
            }

            if (internals.operatorCharacters.includes(char)) {
                flush();
                current = char;
                flush();
                continue;
            }

            if (char === ' ') {
                flush();
                continue;
            }

            if (char === '(') {
                flush();
                parens++;
                continue;
            }

            current += char;
        }

        flush();

        // Replace "-" with n

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const previous = parts[i - 1];
            if (part.type !== 'operator' ||
                part.value !== '-' ||
                (previous && previous.type !== 'operator')) {

                continue;
            }

            parts[i] = { type: 'operator', value: 'n' };
        }

        // Identify static expressions

        if (parts.length === 1 &&
            parts[0].type === 'constant') {

            this.resolved = parts[0].value;
            return;
        }

        // Validate order

        let operator = false;
        for (const part of parts) {
            if (part.type === 'operator') {
                if (internals.operatorPrefixes.includes(part.value)) {
                    continue;
                }

                Assert(internals.operators.includes(part.value), 'Expression contains invalid operator', part.value);
                Assert(operator, 'Expression contains an operator in an invalid position');
            }
            else {
                Assert(!operator, 'Expression missing expected operator');
            }

            operator = !operator;
        }

        // Process parts

        this.parts = parts.map((part) => {
            // Prefix operators

            if (part.type === 'operator') {
                return internals.operatorPrefixes.includes(part.value) ? part : part.value;
            }

            // Constants, functions, expressions

            if (part.type !== 'reference') {
                return part.value;
            }

            // Reference

            const resolver = this.settings.reference(part.value);
            Assert(typeof resolver === 'function', 'Option reference must return a function');

            return resolver;
        });
    }

    fn(name, raw) {
        const fn = this.settings.functions[name];

        Assert(typeof fn === 'function', name, 'must be a function');

        let args = [];
        let current = '';
        let parens = 0;
        let literal = false;

        if (raw) {
            const flush = () => {
                Assert(!parens, 'Parentheses do not match');

                args.push(current);
                current = '';
            };

            for (const char of raw) {
                if (literal) {
                    current += char;
                    if (char === literal) {
                        literal = false;
                    }

                    continue;
                }

                if (internals.literals[char] &&
                    !parens) {

                    literal = internals.literals[char];
                    current += char;
                    continue;
                }

                if (char === '(') {
                    parens++;
                }

                if (char === ')') {
                    parens--;
                }

                if (char === ',' &&
                    !parens) {

                    flush();
                    continue;
                }

                current += char;
            }

            flush();
        }

        args = args.map((arg) => new internals.Expression(arg, this.settings));

        return (context) => {
            const resolved = args.map((arg) => arg.resolve(context));
            return fn.call(context, ...resolved);
        };
    }

    resolve(context) {
        if (!this.parts) {
            return this.resolved;
        }

        const parts = [...this.parts];

        // Prefix operators

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (part &&
                part.type === 'operator') {

                const value = internals.resolve(parts[i + 1], context);
                parts.splice(i + 1, 1);

                if (part.value === '!') {
                    parts[i] = !value;
                    continue;
                }

                parts[i] = -value;
                continue;
            }
        }

        // Left-right operators

        for (const set of internals.operatorsOrder) {
            let i = 1;
            while (i < parts.length - 1) {
                const operator = parts[i];
                if (!set.includes(operator)) {
                    i += 2;
                    continue;
                }

                const left = internals.resolve(parts[i - 1], context);
                const right = internals.resolve(parts[i + 1], context);
                const result = internals.calculate(left, right, operator);

                parts.splice(i, 2);
                parts[i - 1] = result;
            }
        }

        return internals.resolve(parts[0], context);
    }
};

internals.resolve = function (part, context) {
    if (typeof part === 'function') {
        const resolved = part(context);
        return resolved === undefined ? null : resolved;
    }

    if (part instanceof internals.Expression) {
        return part.resolve(context);
    }

    return part;
};

internals.calculate = function (left, right, operator) {
    if ((typeof left === 'string' || typeof right === 'string') &&
        operator === '+') {

        left = left === null || left === undefined ? '' : left;
        right = right === null || right === undefined ? '' : right;
        return left + right;
    }

    switch (operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return left / right;
        case '%': return left % right;
        case '^':
        case '**': return left ** right;
        case '<=': return left <= right;
        case '<': return left < right;
        case '>=': return left >= right;
        case '>': return left > right;
        case '==': return left === right;
        case '!=': return left !== right;
        case '&&': return left && right;
        case '||': return left || right;
    }
};
