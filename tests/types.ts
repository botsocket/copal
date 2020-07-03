import Template = require('../src');

let guard: unknown;

Template.parse('');
Template.parse('', {});
Template.parse('', {
    wrap: '"',

    reference: (path) => {
        const newPath = Number(path);
        return (context: number[]) => context[newPath];
    },

    functions: {
        x: () => 1,
    },

    constants: {
        a: null,
        b: 1,
        c: 'x',
        d: true,
    },
});

guard = 1;
if (Template.isTemplate(guard)) {
    guard.resolve({ x: 1 });
    guard.resolve([1, 2, 3]);
    guard.resolve();
}

Template.parse('').source;
