const execFileSync = require('child_process').execFileSync;
const path = require('path');

module.exports = {
    /**
     * Private handlebars rendering engine for preview templates
     *
     * @type {HandlebarsAdapter}
     */
    handlebars: null,
    /**
     * Main rendering method
     *
     * @param {String} str Template string
     * @param {Object} context Rendering context
     * @param {Object} views Views
     * @return {String} Rendered template
     */
    render(str, context) { // , views
        // If this is the component itself
        if (context.component) {
            return execFileSync('php', [
                path.resolve(context.typo3, 'typo3/cli_dispatch.phpsh'),
                'extbase',
                'component:render',
                context.component,
            ], { env: { TYPO3_FRACTAL: 1 } }).toString();
        }

        // Else: This must be a (handlebars) preview template
        return this.handlebars.render(null, str, context);
    },
};
