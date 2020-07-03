'use strict';

const Template = require('./template');

module.exports = {
    isTemplate: Template.isTemplate,

    parse(source, options) {
        return new Template(source, options);
    },
};
