/* eslint-disable global-require, import/no-dynamic-require, no-console */

const Adapter = require('@frctl/fractal').Adapter;
const path = require('path');
const fs = require('fs');
const execFileSync = require('child_process').execFileSync;
const slug = require('slug');
const mkdirp = require('mkdirp').sync;

let typo3path = null;
let app;

/**
 * Configure a component
 *
 * @param {String} configPath Component configuration path
 * @param {Object} component Component properties
 */
function configureComponent(configPath, component) {
    let config;
    try {
        config = require(configPath);

        // If this is the default variant
        if (!component.variant) {
            config.title = component.name;
            config.status = component.status;
            config.context.type = component.type;
        }
    } catch (e) {
        config = {
            title: component.name,
            status: component.status,
            context: {
                type: component.type,
            },
            variants: [],
        };
    }

    // Remove the variant if already present
    const variant = component.variant || 'default';
    config.variants = config.variants.filter(vt => vt.name !== variant);

    // Register the variant
    config.variants.push({
        name: variant,
        context: {
            config: component.config,
            parameters: component.parameters || {},
            request: component.request,
            component: component.class,
        },
    });

    // Write the configuration file
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
}

/**
 * Register a component
 *
 * @param {Object} component Component
 */
function registerComponent(component) {
    const componentName = slug(component.name, { lower: true });
    const componentPath = component.path.slice(0).map(p => slug(p, { lower: true }));
    const componentDirectory = path.join(app.components.get('path'), path.join.apply(null, componentPath), componentName);

    // Create the component directory
    try {
        if (!fs.statSync(componentDirectory).isDirectory()) {
            throw new Error(`Could not create component directory ${componentDirectory}`);
        }
    } catch (e) {
        if (!mkdirp(componentDirectory)) {
            throw new Error(`Could not create component directory ${componentDirectory}`);
        }
    }
    if (!fs.statSync(componentDirectory).isDirectory() && !mkdirp(componentDirectory)) {
        throw new Error(`Could not create component directory ${componentDirectory}`);
    }

    // Write out the template file
    const componentVariantName = componentName + (component.variant ? `--${slug(component.variant, { lower: true })}` : '');
    const componentTemplate = path.join(componentDirectory, `${componentVariantName}.${component.extension}`);
    fs.writeFileSync(componentTemplate, component.template);

    // Write out the README file
    if (component.notice) {
        const componentNotice = path.join(componentDirectory, 'README.md');
        fs.writeFileSync(componentNotice, component.notice);
    }

    // Configure the component
    configureComponent(path.join(componentDirectory, `${componentName}.config.json`), component);
}

/**
 * Process a component
 *
 * @param {Object} component Component
 */
function processComponent(component) {
    let name = component.name;
    if (component.variant) {
        name += ` (${component.variant})`;
    }
    const pathName = component.path.slice(0);
    pathName.push(name);

    // If the component is invalid
    if (!component.valid) {
        console.log(`Skipping invalid component: ${pathName.join('/')}`);
        return;
    }

    console.log(`Creating component: ${pathName.join('/')}`);
    registerComponent(component);
}

/**
 * Update the components by extracting them from a TYPO3 instance
 *
 * @param {Array} args Arguments
 * @param {Function} done Callback
 */
const update = function update(args, done) {
    app = this.fractal;
    const t3path = args.typo3path || typo3path;
    const typo3cli = path.join(t3path, 'typo3/cli_dispatch.phpsh');

    try {
        if (fs.statSync(typo3cli).isFile()) {
            const components = JSON.parse(
                execFileSync('php', [path.resolve(t3path, 'typo3/cli_dispatch.phpsh'), 'extbase', 'component:discover']).toString());
            for (const component of components) {
                processComponent(component);
            }

            // Write the general shared context
            const context = { context: { typo3: path.resolve(t3path) } };
            fs.writeFileSync(path.resolve(app.components.get('path'), 'components.config.json'), JSON.stringify(context, null, 4));
        }
        done();
    } catch (e) {
        console.log(e);
        done(e);
    }
};

/**
 * Configure the TYPO3 default path
 *
 * @param {String} t3path TYPO3 default path
 */
const configure = function configure(t3path) {
    typo3path = t3path;
};

/**
 * TYPO3 template rendering engine
 */
class TYPO3Adapter extends Adapter {
    render(componentPath, str, context) { // , meta
        const views = {};
        this.views.forEach(view => (views[view.handle] = view.content));
        return Promise.resolve(this.engine.render(str, context, views));
    }
}

/**
 * TYPO3 template engine
 */
const engine = function engine() {
    return {
        register(source) { // , app
            return new TYPO3Adapter(require('./lib/typo3.js'), source);
        },
    };
};

module.exports = {
    update,
    engine,
    configure,
};
