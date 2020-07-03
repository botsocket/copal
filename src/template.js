'use strict';

const Assert = require('@botbind/dust/src/assert');
const Get = require('@botbind/dust/src/get');

const Expression = require('./expression');

const internals = {
    classRx: /^\s*class\s/,
    template: Symbol('template'),
};

internals.constants = {};

internals.functions = {
    if: (condition, then, otherwise) => {
        return condition ? then : otherwise;
    },
};

// Setup constants and functions

internals.setup = function () {
    const keys = Object.getOwnPropertyNames(Math);
    for (const key of keys) {
        const prop = Math[key];

        if (typeof prop === 'function') {
            internals.functions[key] = prop;
            continue;
        }

        internals.constants[key] = prop;
    }
};

internals.setup();

module.exports = internals.Template = class {
    constructor(source, options = {}) {
        Assert(typeof source === 'string', 'Source must be a string');
        Assert(!source.includes('\u0000') && !source.includes('\u0001') && !source.includes('\u0002'), 'Source cannot contain reserved characters');
        Assert(options.wrap === undefined || (options.wrap && typeof options.wrap === 'string'), 'Option wrap must be a non-empty string');
        Assert(options.reference === undefined || typeof options.reference === 'function', 'Option reference must be a function');

        this.source = source;

        this._settings = {
            ...options,
            wrap: options.wrap || '"',
            reference: options.reference || internals.ref,
            functions: { ...internals.functions, ...options.functions },
            constants: { ...internals.constants, ...options.constants },
        };

        this._resolved = source;
        this._parts = null;
        this._parse();
    }

    _parse() {
        if (!this.source.includes('{')) {
            return;
        }

        // Encode escape sequences

        const encoded = internals.encode(this.source);

        // Split based on "{"s

        const parts = internals.split(encoded);

        // Process parts

        const processed = [];
        const head = parts.shift();
        if (head) {
            processed.push(internals.decode(head));
        }

        let dynamic = false;
        for (const part of parts) {
            const end = part.indexOf('}');

            if (end === -1) { // Ignore mismatching brackets
                processed.push(`{${internals.decode(part)}`);
                continue;
            }

            // Parse expression

            const expr = part.slice(0, end);
            Assert(expr, 'Expression must not be empty');

            processed.push(new Expression(internals.decode(expr), this._settings));
            dynamic = true;

            // Collect the rest of the string after "}"

            const rest = part.slice(end + 1);
            if (rest) {
                processed.push(internals.decode(rest));
            }
        }

        if (!dynamic) {
            this._resolved = processed.join('');
            return;
        }

        this._parts = processed;
    }

    resolve(context = {}) {
        if (!this._parts) {
            return this._resolved;
        }

        if (this._parts.length === 1) {
            return internals.resolve(this._parts[0], context);
        }

        const parts = this._parts.map((part) => {
            return internals.display(internals.resolve(part, context));
        });

        return parts.join('');
    }

    toString() {
        const wrap = this._settings.wrap;
        return wrap + this.source + wrap;
    }

    static isTemplate(value) {
        if (!value) {
            return false;
        }

        return Boolean(value[internals.template]);
    }
};

internals.Template.prototype[internals.template] = true;
internals.Template.prototype.immutable = true;

internals.ref = function (path) {
    return (context) => Get(context, path);
};

internals.encode = function (source) {
    return source
        .replace(/\\\\/g, '\u0000')
        .replace(/\\{/g, '\u0001')
        .replace(/\\}/g, '\u0002');
};

internals.decode = function (source) {
    return source
        .replace(/\u0000/g, '\\')
        .replace(/\u0001/g, '{')
        .replace(/\u0002/g, '}');
};

internals.split = function (source) {
    const parts = [];
    let current = '';

    const flush = () => {
        parts.push(current);
        current = '';
    };

    for (const char of source) {
        if (char === '{') {
            flush();
            continue;
        }

        current += char;
    }

    flush();

    return parts;
};

internals.resolve = function (value, context) {
    if (typeof value === 'string') {
        return value;
    }

    return value.resolve(context);
};

internals.display = function (value, seen = new WeakSet()) {
    if (value === null) {
        return 'null';
    }

    const type = typeof value;

    if (type !== 'function' &&
        type !== 'object') {

        return value.toString();
    }

    if (type === 'function') {
        if (internals.classRx.test(value.toString())) {
            return `class ${value.name} {}`;
        }

        return `function ${value.name}() {}`;
    }

    if (seen.has(value)) {
        return '[Circular]';
    }

    seen.add(value);

    if (value instanceof Set) {
        value = [...value];

        // Continue as array
    }

    if (Array.isArray(value)) {
        return value.map((item) => internals.display(item, seen)).join(', ');
    }

    if (value instanceof Map) {
        const entries = [];
        for (const [key, item] of value) {
            entries.push(`${internals.display(key, seen)} => ${internals.display(item, seen)}`);
        }

        return internals.wrap(entries);
    }

    if (value.toString !== Object.prototype.toString) {
        return value.toString();
    }

    const entries = [];
    for (const key of Object.keys(value)) {
        const item = value[key];
        entries.push(`${key}: ${internals.display(item, seen)}`);
    }

    return internals.wrap(entries);
};

internals.wrap = function (entries) {
    const space = entries.length ? ' ' : '';
    return `{${space}${entries.join(', ')}${space}}`;
};
