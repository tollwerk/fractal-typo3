const request = require('sync-request');

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
            const query = Object.assign(context.request.arguments, {
                tx_twcomponentlibrary_component: { component: context.component },
                type: 9999,
            });
            return request(context.request.method, context.typo3, {
                qs: query,
                headers: {
                    'X-Fractal-TYPO3': 1,
                },
            }).getBody();
        }

        // Else: This must be a (handlebars) preview template
        return this.handlebars.render(null, str, context);
    },
};
