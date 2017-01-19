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
 * @param {String} componentPath Component path
 */
function configureComponent(configPath, component, componentPath) {
    let config;
    try {
        config = require(configPath);

        // If this is the default variant
        if (!component.variant) {
            config.title = component.name;
            config.status = component.status;
            config.context = config.context || {};
            config.context.type = component.type;
        }

        config.variants = config.variants || [];

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

    // Register the preview component
    if (component.preview) {
        config.preview = `@${[...componentPath, slug(component.name, { lower: true }), 'preview'].join('-')}`;
    }

    // Remove the variant if already present
    const variant = component.variant || 'default';
    config.variants = config.variants.filter(vt => vt.name !== variant);

    // Register the variant
    config.variants.push({
        name: variant,
        label: component.label || ((variant === 'default') ? component.name : variant),
        context: {
            config: component.config,
            parameters: component.parameters || {},
            request: component.request,
            component: component.class,
        },
    });

    config.variants = config.variants.sort((a, b) => {
        const aName = a.label.toLowerCase();
        const bName = b.label.toLowerCase();
        if (aName > bName) {
            return 1;
        }
        return (aName < bName) ? -1 : 0;
    });
    config.variants.forEach((v, i) => v.order = i);

    // Write the configuration file
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
}

/**
 * Create and pre-configure a directory
 *
 * @param {String} dirPrefix Path prefix
 * @param {Array} dirPath Directory path
 * @return {boolean} Directory been created and pre-configured
 */
function createCollection(dirPrefix, dirPath) {
    const dir = dirPath.shift();
    const absDir = path.join(dirPrefix, dir);

    console.log('Creating ' + absDir);

    // Create the collection directory
    try {
        if (!fs.statSync(absDir).isDirectory()) {
            throw new Error('1');
        }
    } catch (e) {
        try {
            if (!mkdirp(absDir)) {
                throw new Error('2');
            }
        } catch (f) {
            return false;
        }
    }

    // Configure the collection prefix
    const configPath = path.join(absDir, `${dir}.config.json`);
    const prefix = path.relative(app.components.get('path'), absDir).split(path.sep).join('-');
    let config;
    try {
        config = require(configPath);
        config.prefix = prefix;
    } catch (e) {
        config = { prefix };
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));

    // Recurse
    return dirPath.length ? createCollection(absDir, dirPath) : true;
}

/**
 * Register a component
 *
 * @param {Object} component Component
 */
function registerComponent(component) {
    const componentName = slug(component.name, { lower: true });
    const componentPath = component.path.slice(0).map(p => slug(p, { lower: true }));
    const componentParent = path.join(app.components.get('path'), ...componentPath);
    const componentDirectory = path.join(componentParent, componentName);

    // Create the component directory
    if (!createCollection(app.components.get('path'), [...componentPath, componentName])) {
        throw new Error(`Could not create component directory ${componentDirectory}`);
    }

    // Write out the template file
    const componentVariantName = componentName + (component.variant ? `--${slug(component.variant, { lower: true })}` : '');
    const componentTemplate = path.join(componentDirectory, `${componentVariantName}.${component.extension}`);
    fs.writeFileSync(componentTemplate, component.template);

    // Write out the preview template
    if (component.preview) {
        fs.writeFileSync(path.join(componentParent, `_${componentName}-preview.t3s`), component.preview);
    }

    // Write out the README file
    if (component.notice) {
        fs.writeFileSync(path.join(componentDirectory, 'README.md'), component.notice);
    }

    // Configure the component
    configureComponent(path.join(componentDirectory, `${componentName}.config.json`), component, componentPath);
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
        register(source, gapp) {
            const typo3Engine = require('./lib/typo3.js');
            const handlebars = require('@frctl/handlebars');
            typo3Engine.handlebars = handlebars({}).register(source, gapp);
            typo3Engine.handlebars.load();
            return new TYPO3Adapter(typo3Engine, source); // , gapp
        },
    };
};

module.exports = {
    update,
    engine,
    configure,
};
