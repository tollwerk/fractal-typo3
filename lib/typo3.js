const request = require('request-promise');

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
     * @return {Promise} Request promise
     */
    compile(str, context) { // , views
        return request({
            method: context.request.method,
            uri: context.typo3,
            qs: Object.assign(context.request.arguments, {
                tx_twcomponentlibrary_component: { component: context.component },
                type: 2400,
            }),
            headers: {
                'User-Agent': 'Fractal'
            },
        });
    },
};
