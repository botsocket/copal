# Documentation

## Introduction

Template is a library for string format and interpolation.

## Installation

Template is available on npm:

```bash
npm install @botbind/template
```

## Usage

```js
const Template = require('@botbind/template');

const template = Template.parse('My first name is {first} and my full name is {first + " " + last}');

template.resolve({ first: 'John', last: 'Doe' }); // My first name is John and my full name is John Doe
```

## API

-   [`parse()`](#parsesource-options)
    -   [`template.source`](#templatesource)
    -   [`template.resolve()`](#templateresolvecontext)
-   [`isTemplate()`](#istemplatevalue)

### `parse(source, [options])`

Parses a source string to a template where:

-   `source`: The source string to parse.
-   `options`: Optional options where:
    -   `reference`: An optional factory function of signature `function (path) {}` that returns a resolver of signature `function (context) {}`. Refer to [`template.resolve()`](#templateresolvecontext) for example usage.
    -   `wrap`: An optional string that is used to wrap the template if nested inside another. Defaults to `"`.
    -   `functions`: An optional hash of function names and their implementations.
    -   `constants`: An optional hash of constants and their values (can be of type number, boolean, string or `null`).

The template syntax consists of expressions and raw strings. Each expression must be wrapped within `{}` braces and failing to match them will result in the expression being returned as is:

```js
const template = Template.parse('This is {x}');
template.resolve({ x: 1 }); // This is 1

const template2 = Template.parse('x {');
template2.resolve(); // x {
```

Expressions use a simple mathematical syntax such as `(x + y * 2) / 3` where named variables (`x`, `y`) are dot-separated path references resolved from the given context. Most references can be used as is, but some can create ambiguity for the parser and must be enclosed within `[]` braces, for example paths that contain reserved operators or array indices.

```js
const template = Template.parse('This is {x + 1}');
template.resolve({ x: 1 }); // This is 2

const template2 = Template.parse('This is {[0.1] + 1}'); // 0.1 is misinterpreted as a number instead of a reference
template2.resolve([[0, 1]]); // This is 2

const template3 = Template.parse('This is {[x.*.y]}'); // x.*.y is misinterpreted as a multiplcation instead of a reference
template3.resolve({ x: [{ y: 1 }, { y: 2 }, { y: 3 }] }); // This is 1, 2, 3
```

Javascript `Math` methods and constants are supported out of the box:

```js
const template = Template.parse('This is {x * (PI + E)}');
template.resolve({ x: 2 }); // This is (2 * (Math.PI + Math.E))

const template2 = Template.parse('This is {sin(x)}');
template2.resolve({ x: 1 }); // This is (Math.sin(1))
```

To override the provided functions or constants, use the `functions` or `constants` option:

```js
const template = Template.parse('This is {PI}', { constants: { PI: 3.14 } });
template.resolve(); // This is 3.14

const template2 = Template.parse('This is {random()}', { 
    functions: { 
        random() {
            return 12345;
        },
    }, 
});

template2.resolve(); // This is 12345
```

Expressions can only operate on `null`, strings, booleans and numbers. If a reference or a function returns `undefined`, `null` will be used instead. Internal implementation relies on native calculation so string concatenations, `NaN`s and `Infinity`s are expected (with the exception of `null + "x"` producing `"x"` instead of `"nullx"`). Supported operators are: `^`, `**`, `*`, `/`, `%`, `+`, `-`, `<`, `<=`, `>`, `>=`, `==`, `!=`, `&&`, `||` (in this order of precedence).

To escape an expression, use `\\` before the `{` brace.

```js
const template = Template.parse('{if(x == "someValue", 1, 2)}'); 
template.resolve({ x: 'someValue' }); // 1
template.resolve({ x: 'somOtherValue' }); // 2

const template2 = Template.parse('Escaped path {x\\.y.y}'); 
template2.resolve({ 'x.y': { y: 1 } }); // Escaped path 1

const template3 = Template.parse('Escaped \\{a}');
template3.resolve({ a: 1 }); // Escaped {a}

const template4 = Template.parse('Escaped \\{{a}}');
template4.resolve({ a: 1 }); // Escaped {1}

const template5 = Template.parse('Escaped {a\\}}'); 
template5.resolve({ 'a}': 1 }); // Escaped 1
```

[Back to top](#api)

#### `template.source`

The source of the template.

```js
const template = Template.parse('{x}');

template.source; // {x}
```

[Back to top](#api)

#### `template.resolve(context)`

Evaluates expressions and resolves the current template where:

-   `context`: The context to lookup.

```js
const template = Template.parse('This is {x + 1}');

template.resolve({ x: 2 }); // This is 3
```

A custom resolver can be provided to customize how references are resolved:

```js
const template = Template.parse('Custom reference {x}, {y}', {
    reference: (path) => {
        return (context) => context[`prefix-${path}`];
    },
});

template.resolve({ 'prefix-x': 1, 'prefix-y': 2 }); // Custom reference 1, 2
```

[Back to top](#api)

### `isTemplate(value)`

Checks if a value is a valid template where:

-   `value`: The value to check.

```js
Template.isTemplate(Template.parse('x')); // true
```

[Back to top](#api)
