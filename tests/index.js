'use strict';

const Dust = require('@botbind/dust');

const Template = require('../src');

describe('parse()', () => {

    it('should throw on incorrect parameters', () => {

        expect(() => Template.parse(1)).toThrow('Source must be a string');
        expect(() => Template.parse('\u0000')).toThrow('Source cannot contain reserved characters');
        expect(() => Template.parse('\u0001')).toThrow('Source cannot contain reserved characters');
        expect(() => Template.parse('\u0002')).toThrow('Source cannot contain reserved characters');
        expect(() => Template.parse('x', { wrap: 1 })).toThrow('Option wrap must be a non-empty string');
        expect(() => Template.parse('x', { wrap: '' })).toThrow('Option wrap must be a non-empty string');
        expect(() => Template.parse('x', { reference: 'x' })).toThrow('Option reference must be a function');
    });

    it('should be immutable', () => {

        const template = Template.parse('x');
        expect(Dust.clone(template)).toBe(template);
    });

    it('should resolve templates without "{"', () => {

        expect(Template.parse('x').resolve()).toBe('x');
        expect(Template.parse('x }').resolve()).toBe('x }');
    });

    it('should ignore mismatching "{}"', () => {

        expect(Template.parse('x {').resolve()).toBe('x {');
        expect(Template.parse('x { some content{').resolve()).toBe('x { some content{');
        expect(Template.parse('x {{some content{').resolve()).toBe('x {{some content{');
        expect(Template.parse('x {{x}').resolve({ x: 1 })).toBe('x {1');
        expect(Template.parse('x {{x}} {').resolve({ x: 1 })).toBe('x {1} {');
    });

    it('should throw on empty expressions', () => {

        expect(() => Template.parse('Wrong {}')).toThrow('Expression must not be empty');
    });

    it('should resolve references', () => {

        const template = Template.parse('This is {x}');

        expect(template.resolve({ x: 1 })).toBe('This is 1');
        expect(template.resolve({ x: 2 })).toBe('This is 2');
        expect(template.resolve({ x: 'x' })).toBe('This is x');
        expect(template.resolve({})).toBe('This is null');
        expect(template.resolve()).toBe('This is null');
    });

    it('should resolve deep properties', () => {

        const template = Template.parse('This is {x.y.0}');
        expect(template.resolve({ x: { y: [1] } })).toBe('This is 1');
    });

    it('should resolve references with wildcard character', () => {

        const template = Template.parse('This is {[x.*.y]}');
        expect(template.resolve({ x: [{ y: 1 }, { y: 2 }, { y: 3 }] })).toBe('This is 1, 2, 3');
    });

    it('should resolve ambiguous references', () => {

        const template = Template.parse('This is {[0.1]}');
        expect(template.resolve([[0, 1]])).toBe('This is 1');
    });

    it('should resolve multiple references', () => {

        const template = Template.parse('This is {x}, {y} and {z.0}');
        expect(template.resolve({ x: 1, y: 2, z: [3] })).toBe('This is 1, 2 and 3');
    });

    it('should resolve single expression', () => {

        const template = Template.parse('{x}');

        expect(template.resolve({ x: 1 })).toBe(1);
        expect(template.resolve({ x: 'x' })).toBe('x');
        expect(template.resolve({ x: null })).toBe(null);
    });

    it('should resolve static expressions', () => {

        expect(Template.parse('{1}').resolve()).toBe(1);
        expect(Template.parse('{"x"}').resolve()).toBe('x');
    });

    it('should resolve expressions without references', () => {

        expect(Template.parse('{1 + 2}').resolve()).toBe(3);
        expect(Template.parse('{1 + "x"}').resolve()).toBe('1x');
    });

    it('should calculate -', () => {

        const template = Template.parse('{-x}');
        expect(template.resolve({ x: 1 })).toBe(-1);
    });

    it('should handle --', () => {

        const template = Template.parse('{x - -1}');
        expect(template.resolve({ x: 1 })).toBe(2);
    });

    it('should handle calculations with ambiguous references', () => {

        const template = Template.parse('This is {[0.1] + 1}');
        expect(template.resolve([[0, 1]])).toBe('This is 2');
    });

    it('should handle multiple operators in the correct order', () => {

        const template = Template.parse('This is {x + 3 / 3}');

        expect(template.resolve({ x: 1 })).toBe('This is 2');
        expect(template.resolve({ x: 'x' })).toBe('This is x1');
    });

    it('should handle strings in double quotes', () => {

        const template = Template.parse('This is {"x"}');
        expect(template.resolve()).toBe('This is x');
    });

    it('should handle strings in single quotes', () => {

        const template = Template.parse('This is {\'x\'}');
        expect(template.resolve()).toBe('This is x');
    });

    it('should handle empty strings', () => {

        const template = Template.parse('This is {""}');
        expect(template.resolve()).toBe('This is ');
    });

    it('should handle sub expression', () => {

        const template = Template.parse('This is {(x + 3) / 3}');
        expect(template.resolve({ x: 1 })).toBe(`This is ${4 / 3}`);
    });

    it('should resolve expressions with multiple sub expressions', () => {

        const template = Template.parse('This is {(x * (1 + 2)) / 3}');
        expect(template.resolve({ x: 1 })).toBe('This is 1');
    });

    it('should resolve constants', () => {

        const template = Template.parse('This is {x * (PI + E)}');
        expect(template.resolve({ x: 2 })).toBe(`This is ${(Math.PI + Math.E) * 2}`);
    });

    it('should resolve functions', () => {

        const template = Template.parse('This is {sin(x)}');
        expect(template.resolve({ x: 1 })).toBe(`This is ${Math.sin(1)}`);
    });

    it('should resolve functions with multiple arguments', () => {

        const template = Template.parse('This is {hypot(1, 2, x)}');
        expect(template.resolve({ x: 3 })).toBe(`This is ${Math.hypot(1, 2, 3)}`);
    });

    it('should resolve functions with ambiguous arguments', () => {

        const template = Template.parse('This is {sin([0.1])}');
        expect(template.resolve([[0, 1]])).toBe(`This is ${Math.sin(1)}`);
    });

    it('should resolve nested functions', () => {

        const template = Template.parse('This is {sin(cos(x))}');
        expect(template.resolve({ x: 1 })).toBe(`This is ${Math.sin(Math.cos(1))}`);
    });

    it('should resolve expressions with functions of ambiguous names', () => {

        const template = Template.parse('This is {[0.1]()}', { functions: { 0.1: () => 12345 } });

        expect(template.resolve()).toBe('This is 12345');
    });

    describe('Operators', () => {

        it('should calculate +', () => {

            const template = Template.parse('{x + y}');

            expect(template.resolve({ x: 1, y: 2 })).toBe(3);
            expect(template.resolve({ y: 2 })).toBe(2);
            expect(template.resolve({ x: 1 })).toBe(1);
            expect(template.resolve({ x: null, y: 2 })).toBe(2);
            expect(template.resolve({ x: 1, y: null })).toBe(1);

            expect(template.resolve({ x: '1', y: '2' })).toBe('12');
            expect(template.resolve({ x: 1, y: '2' })).toBe('12');
            expect(template.resolve({ x: '1', y: 2 })).toBe('12');
            expect(template.resolve({ x: null, y: '2' })).toBe('2');
            expect(template.resolve({ x: '1', y: null })).toBe('1');
        });

        it('should calculate -', () => {

            const template = Template.parse('{x - y}');

            expect(template.resolve({ x: 1, y: 2 })).toBe(-1);
            expect(template.resolve({ y: 2 })).toBe(-2);
            expect(template.resolve({ x: 1 })).toBe(1);
            expect(template.resolve({ x: null, y: 2 })).toBe(-2);
            expect(template.resolve({ x: 1, y: null })).toBe(1);

            expect(template.resolve({ x: '1', y: '2' })).toBe(-1);
            expect(template.resolve({ x: 1, y: '2' })).toBe(-1);
            expect(template.resolve({ x: '1', y: 2 })).toBe(-1);
            expect(template.resolve({ x: null, y: '2' })).toBe(-2);
            expect(template.resolve({ x: '1', y: null })).toBe(1);
        });

        it('should calculate *', () => {

            const template = Template.parse('{x * y}');

            expect(template.resolve({ x: 1, y: 2 })).toBe(2);
            expect(template.resolve({ y: 2 })).toBe(0);
            expect(template.resolve({ x: 1 })).toBe(0);
            expect(template.resolve({ x: null, y: 2 })).toBe(0);
            expect(template.resolve({ x: 1, y: null })).toBe(0);

            expect(template.resolve({ x: '1', y: '2' })).toBe(2);
            expect(template.resolve({ x: 1, y: '2' })).toBe(2);
            expect(template.resolve({ x: '1', y: 2 })).toBe(2);
            expect(template.resolve({ x: null, y: '2' })).toBe(0);
            expect(template.resolve({ x: '1', y: null })).toBe(0);
        });

        it('should calculate /', () => {

            const template = Template.parse('{x / y}');

            expect(template.resolve({ x: 4, y: 2 })).toBe(2);
            expect(template.resolve({ y: 2 })).toBe(0);
            expect(template.resolve({ x: 4 })).toBe(Infinity);
            expect(template.resolve({ x: null, y: 2 })).toBe(0);
            expect(template.resolve({ x: 4, y: null })).toBe(Infinity);

            expect(template.resolve({ x: '4', y: '2' })).toBe(2);
            expect(template.resolve({ x: 4, y: '2' })).toBe(2);
            expect(template.resolve({ x: '4', y: 2 })).toBe(2);
            expect(template.resolve({ x: null, y: '2' })).toBe(0);
            expect(template.resolve({ x: '4', y: null })).toBe(Infinity);
        });

        it('should calculate %', () => {

            const template = Template.parse('{x % y}');

            expect(template.resolve({ x: 5, y: 3 })).toBe(2);
            expect(template.resolve({ y: 5 })).toBe(0);
            expect(template.resolve({ x: 4 })).toBe(NaN);
            expect(template.resolve({ x: null, y: 2 })).toBe(0);
            expect(template.resolve({ x: 4, y: null })).toBe(NaN);

            expect(template.resolve({ x: '5', y: '3' })).toBe(2);
            expect(template.resolve({ x: 5, y: '3' })).toBe(2);
            expect(template.resolve({ x: '5', y: 3 })).toBe(2);
            expect(template.resolve({ x: null, y: '3' })).toBe(0);
            expect(template.resolve({ x: '5', y: null })).toBe(NaN);
        });

        it('should calculate ^', () => {

            const template = Template.parse('{x ^ y}');

            expect(template.resolve({ x: 2, y: 3 })).toBe(8);
            expect(template.resolve({ y: 3 })).toBe(0);
            expect(template.resolve({ x: 2 })).toBe(1);
            expect(template.resolve({ x: null, y: 2 })).toBe(0);
            expect(template.resolve({ x: 4, y: null })).toBe(1);

            expect(template.resolve({ x: '2', y: '3' })).toBe(8);
            expect(template.resolve({ x: 2, y: '3' })).toBe(8);
            expect(template.resolve({ x: '2', y: 3 })).toBe(8);
            expect(template.resolve({ x: null, y: '3' })).toBe(0);
            expect(template.resolve({ x: '2', y: null })).toBe(1);
        });

        it('should compare <=', () => {

            const template = Template.parse('{x <= y}');

            expect(template.resolve({ x: 2, y: 3 })).toBe(true);
            expect(template.resolve({ x: 3, y: 3 })).toBe(true);
            expect(template.resolve({ x: 2 })).toBe(false);
            expect(template.resolve({ x: null, y: 2 })).toBe(true);
            expect(template.resolve({ x: 4, y: null })).toBe(false);

            expect(template.resolve({ x: '2', y: '3' })).toBe(true);
            expect(template.resolve({ x: 2, y: '3' })).toBe(true);
            expect(template.resolve({ x: '2', y: 3 })).toBe(true);
            expect(template.resolve({ x: null, y: '3' })).toBe(true);
            expect(template.resolve({ x: '2', y: null })).toBe(false);
        });

        it('should compare <', () => {

            const template = Template.parse('{x < y}');

            expect(template.resolve({ x: 2, y: 3 })).toBe(true);
            expect(template.resolve({ x: 3, y: 3 })).toBe(false);
            expect(template.resolve({ x: 2 })).toBe(false);
            expect(template.resolve({ x: null, y: 2 })).toBe(true);
            expect(template.resolve({ x: 4, y: null })).toBe(false);

            expect(template.resolve({ x: '2', y: '3' })).toBe(true);
            expect(template.resolve({ x: 2, y: '3' })).toBe(true);
            expect(template.resolve({ x: '2', y: 3 })).toBe(true);
            expect(template.resolve({ x: null, y: '3' })).toBe(true);
            expect(template.resolve({ x: '2', y: null })).toBe(false);
        });

        it('should compare >=', () => {

            const template = Template.parse('{x >= y}');

            expect(template.resolve({ x: 2, y: 3 })).toBe(false);
            expect(template.resolve({ x: 3, y: 3 })).toBe(true);
            expect(template.resolve({ x: 2 })).toBe(true);
            expect(template.resolve({ x: null, y: 2 })).toBe(false);
            expect(template.resolve({ x: 4, y: null })).toBe(true);

            expect(template.resolve({ x: '2', y: '3' })).toBe(false);
            expect(template.resolve({ x: 2, y: '3' })).toBe(false);
            expect(template.resolve({ x: '2', y: 3 })).toBe(false);
            expect(template.resolve({ x: null, y: '3' })).toBe(false);
            expect(template.resolve({ x: '2', y: null })).toBe(true);
        });

        it('should compare >', () => {

            const template = Template.parse('{x > y}');

            expect(template.resolve({ x: 2, y: 3 })).toBe(false);
            expect(template.resolve({ x: 3, y: 3 })).toBe(false);
            expect(template.resolve({ x: 2 })).toBe(true);
            expect(template.resolve({ x: null, y: 2 })).toBe(false);
            expect(template.resolve({ x: 4, y: null })).toBe(true);

            expect(template.resolve({ x: '2', y: '3' })).toBe(false);
            expect(template.resolve({ x: 2, y: '3' })).toBe(false);
            expect(template.resolve({ x: '2', y: 3 })).toBe(false);
            expect(template.resolve({ x: null, y: '3' })).toBe(false);
            expect(template.resolve({ x: '2', y: null })).toBe(true);
        });

        it('should compare ==', () => {

            const template = Template.parse('{x == y}');

            expect(template.resolve({ x: 2, y: 3 })).toBe(false);
            expect(template.resolve({ x: 3, y: 3 })).toBe(true);
            expect(template.resolve({ x: 2 })).toBe(false);
            expect(template.resolve({ x: null, y: 2 })).toBe(false);
            expect(template.resolve({ x: 4, y: null })).toBe(false);

            expect(template.resolve({ x: '2', y: '3' })).toBe(false);
            expect(template.resolve({ x: 2, y: '3' })).toBe(false);
            expect(template.resolve({ x: '2', y: 3 })).toBe(false);
            expect(template.resolve({ x: null, y: '3' })).toBe(false);
            expect(template.resolve({ x: '2', y: null })).toBe(false);
        });

        it('should compare !=', () => {

            const template = Template.parse('{x != y}');

            expect(template.resolve({ x: 2, y: 3 })).toBe(true);
            expect(template.resolve({ x: 3, y: 3 })).toBe(false);
            expect(template.resolve({ x: 2 })).toBe(true);
            expect(template.resolve({ x: null, y: 2 })).toBe(true);
            expect(template.resolve({ x: 4, y: null })).toBe(true);

            expect(template.resolve({ x: '2', y: '3' })).toBe(true);
            expect(template.resolve({ x: 2, y: '3' })).toBe(true);
            expect(template.resolve({ x: '2', y: 3 })).toBe(true);
            expect(template.resolve({ x: null, y: '3' })).toBe(true);
            expect(template.resolve({ x: '2', y: null })).toBe(true);
        });

        it('should apply &&', () => {

            const template = Template.parse('{x && y}');

            expect(template.resolve({ x: 0, y: 3 })).toBe(0);
            expect(template.resolve({ x: 1, y: 3 })).toBe(3);
            expect(template.resolve({ x: 2 })).toBe(null);
            expect(template.resolve({ x: null, y: 2 })).toBe(null);
            expect(template.resolve({ x: 4, y: null })).toBe(null);

            expect(template.resolve({ x: '2', y: '3' })).toBe('3');
            expect(template.resolve({ x: 2, y: '3' })).toBe('3');
            expect(template.resolve({ x: '2', y: 3 })).toBe(3);
            expect(template.resolve({ x: null, y: '3' })).toBe(null);
            expect(template.resolve({ x: '2', y: null })).toBe(null);
        });

        it('should apply ||', () => {

            const template = Template.parse('{x || y}');

            expect(template.resolve({ x: 0, y: 3 })).toBe(3);
            expect(template.resolve({ x: 1, y: 3 })).toBe(1);
            expect(template.resolve({ x: 2 })).toBe(2);
            expect(template.resolve({ x: null, y: 2 })).toBe(2);
            expect(template.resolve({ x: 4, y: null })).toBe(4);

            expect(template.resolve({ x: '2', y: '3' })).toBe('2');
            expect(template.resolve({ x: 2, y: '3' })).toBe(2);
            expect(template.resolve({ x: '2', y: 3 })).toBe('2');
            expect(template.resolve({ x: null, y: '3' })).toBe('3');
            expect(template.resolve({ x: '2', y: null })).toBe('2');
        });
    });

    describe('Functions', () => {

        describe('if()', () => {

            it('should return the correct branch', () => {

                const template = Template.parse('{if(x == "someValue", 1, 2)}');
                expect(template.resolve({ x: 'someValue' })).toBe(1);
                expect(template.resolve({ x: 'someDifferentValue' })).toBe(2);
            });

            it('should handle !', () => {

                const template = Template.parse('{if(!x, 1, 2)}');
                expect(template.resolve({ x: true })).toBe(2);
                expect(template.resolve({ x: false })).toBe(1);
            });
        });
    });

    it('should resolve complex expressions', () => {

        const template = Template.parse('This is {sin((x + 1)/cos(3))}');
        expect(template.resolve({ x: 1 })).toBe(`This is ${Math.sin(2 / Math.cos(3))}`);
    });

    it('should allow passing custom functions', () => {

        const template = Template.parse('This is {myFunction()}', { functions: { myFunction: () => 12345 } });
        expect(template.resolve()).toBe('This is 12345');
    });

    it('should override existing functions', () => {

        const template = Template.parse('This is {random()}', { functions: { random: () => 12345 } });
        expect(template.resolve()).toBe('This is 12345');
    });

    it('should allow passing custom constants', () => {

        const template = Template.parse('This is {SOME_CONSTANT}', { constants: { SOME_CONSTANT: 12345 } });
        expect(template.resolve()).toBe('This is 12345');
    });

    it('should override existing constants', () => {

        const template = Template.parse('This is {PI}', { constants: { PI: 3.14 } });
        expect(template.resolve()).toBe('This is 3.14');
    });

    it('should throw on invalid operators', () => {

        expect(() => Template.parse('This is {x | y}')).toThrow('Expression contains invalid operator |');
    });

    it('should throw on invalid operator positioning', () => {

        expect(() => Template.parse('This is {x ++ y}')).toThrow('Expression contains an operator in an invalid position');
    });

    it('should throw on missing operators', () => {

        expect(() => Template.parse('This is {x y}')).toThrow('Expression missing expected operator');
    });

    it('should throw on invalid functions', () => {

        expect(() => Template.parse('This is {myFunction()}', { functions: { myFunction: 1 } })).toThrow('myFunction must be a function');
    });

    it('should throw on invalid constants', () => {

        expect(() => Template.parse('This is {SOME_CONSTANT}', { constants: { SOME_CONSTANT: {} } })).toThrow('SOME_CONSTANT must be a boolean, number, string or null');
    });

    it('should throw on mismatching parentheses', () => {

        expect(() => Template.parse('This is {sin(}')).toThrow('Parentheses do not match');
        expect(() => Template.parse('This is {cos(sin()}')).toThrow('Parentheses do not match');
        expect(() => Template.parse('This is {)}')).toThrow('Parentheses do not match');
    });

    it('should escape groups', () => {

        expect(Template.parse('Escaped \\{a}').resolve()).toBe('Escaped {a}');
        expect(Template.parse('Escaped {a\\}}').resolve({ 'a}': 1 })).toBe('Escaped 1');
        expect(Template.parse('Escaped \\{{a}}').resolve({ a: 1 })).toBe('Escaped {1}');
        expect(Template.parse('Escaped {a} \\{b}').resolve({ a: 1 })).toBe('Escaped 1 {b}');
    });

    it('should ignore "\\" if not followed by a "{" or "}"', () => {

        expect(Template.parse('This is \\').resolve()).toBe('This is \\');
        expect(Template.parse('This is {a\\b}').resolve({ 'a\\b': 1 })).toBe('This is 1');
    });

    it('should escape "\\"', () => {

        expect(Template.parse('Escaped \\\\{a}').resolve({ a: 1 })).toBe('Escaped \\1');
        expect(Template.parse('Escaped {a\\\\}').resolve({ 'a\\': 1 })).toBe('Escaped 1');
    });

    it('should escape paths', () => {

        const template = Template.parse('Escaped path {x\\.y.y}');
        expect(template.resolve({ 'x.y': { y: 1 } })).toBe('Escaped path 1');
    });

    it('should resolve complex escape sequences', () => {

        const template = Template.parse('This is \\ \\{ very complex }, \\\\\\{{x\\.y\\z.t\\\\\\}}}');
        expect(template.resolve({ 'x.y\\z': { 't\\}': 1 } })).toBe('This is \\ { very complex }, \\{1}');
    });

    it('should throw on invalid custom references', () => {

        expect(() => Template.parse('{x}', { reference: () => 'x' })).toThrow('Option reference must return a function');
    });

    it('should use custom references', () => {

        const template = Template.parse('Custom reference {x}, {y}', {
            reference: (path) => {

                return (context) => context[`prefix-${path}`];
            },
        });

        expect(template.resolve({ 'prefix-x': 1, 'prefix-y': 2 })).toBe('Custom reference 1, 2');
    });

    it('should display arbitrary values as strings', () => {

        const template = Template.parse('This is {x}');

        expect(template.resolve({ x: null })).toBe('This is null');
        expect(template.resolve({ x: 1 })).toBe('This is 1');
        expect(template.resolve({ x: false })).toBe('This is false');
        expect(template.resolve({ x: Symbol('x') })).toBe('This is Symbol(x)');
        expect(template.resolve({ x() { } })).toBe('This is function x() {}');
        expect(template.resolve({ x: class X { } })).toBe('This is class X {}');
        expect(template.resolve({ x: [1, 2, 3] })).toBe('This is 1, 2, 3');
        expect(template.resolve({ x: new Set([1, 2, {}]) })).toBe('This is 1, 2, {}');
        expect(template.resolve({ x: new Map([[{}, 1], ['x', 'y']]) })).toBe('This is { {} => 1, x => y }');
        expect(template.resolve({ x: { y: 1, z: 'x' } })).toBe('This is { y: 1, z: x }');

        const original = Date.prototype.toString;
        Date.prototype.toString = () => 'My date';

        expect(template.resolve({ x: new Date() })).toBe('This is My date');

        Date.prototype.toString = original;

        class X {
            toString() {

                return 'Custom toString';
            }
        }

        expect(template.resolve({ x: new X() })).toBe('This is Custom toString');
    });

    it('should display nested templates', () => {

        const template = Template.parse('This is template {x}');
        expect(template.resolve({ x: Template.parse('This is {x}') })).toBe('This is template "This is {x}"');
    });

    it('should display nested templates with custom wrap', () => {

        const template = Template.parse('This is template {x}');
        expect(template.resolve({ x: Template.parse('This is {x}', { wrap: '\'' }) })).toBe('This is template \'This is {x}\'');
    });

    it('should display circular references', () => {

        const template = Template.parse('This is {x}');
        const x = {};
        x.x = x;

        expect(template.resolve({ x })).toBe('This is { x: [Circular] }');
    });

    it('should work with example string', () => {

        const template = Template.parse('My first name is {first} and my full name is {first + " " + last}');
        expect(template.resolve({ first: 'John', last: 'Doe' })).toBe('My first name is John and my full name is John Doe');
    });
});

describe('isTemplate()', () => {

    it('should return true for templates', () => {

        expect(Template.isTemplate(null)).toBe(false);
        expect(Template.isTemplate('x')).toBe(false);
        expect(Template.isTemplate(Template.parse('x'))).toBe(true);
        expect(Template.isTemplate(Template.parse('{x}'))).toBe(true);
    });
});
