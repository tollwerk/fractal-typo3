/* eslint-disable global-require, import/no-dynamic-require, no-console, no-underscore-dangle */

const Adapter = require('@frctl/fractal').Adapter;
const path = require('path');
const fs = require('fs');
const execFileSync = require('child_process').execFileSync;
const slug = require('slug');
const mkdirp = require('mkdirp').sync;
const chalk = require('chalk');
const deleteEmpty = require('delete-empty');
const url = require('url');

const files = [];
let typo3path = null;
let typo3url = null;
let typo3bin = false;
let app;

/**
 * Write a file to disc
 *
 * @param {String} path File path
 * @param {String} content File content
 */
function writeFile(file, content) {
    fs.writeFileSync(file, content);
    files.push(path.relative(app.components.get('path'), file));
}

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
    config.variants.forEach((v, i) => {
        config.variants[i].order = i;
    });

    // Write the configuration file
    writeFile(configPath, JSON.stringify(config, null, 4));

    // If there's a component note
    if ((variant === 'default') && component.notice) {
        const readme = path.join(path.dirname(configPath), 'README.md');
        writeFile(readme, component.notice);
    }
}

/**
 * Create and pre-configure a directory
 *
 * @param {String} dirPrefix Path prefix
 * @param {Array} dirPath Directory path
 * @param {Array} dirConfigs Local directory configurations
 * @return {boolean} Directory been created and pre-configured
 */
function createCollection(dirPrefix, dirPath, dirConfigs) {
    const dir = dirPath.shift();
    const dirConfig = dirConfigs.shift() || {};
    const absDir = path.join(dirPrefix, dir);

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
    const configPath = path.join(absDir, `${dir.replace(/^\d{2}-/, '')}.config.json`);
    const prefix = path.relative(app.components.get('path'), absDir).split(path.sep).map(p => p.replace(/^\d{2}-/, '')).join('-');

    // console.log(configPath, dirConfig);

    let config;
    try {
        config = require(configPath);
        config.prefix = prefix;
    } catch (e) {
        config = { prefix };
    }
    ['label'].forEach(c => {
        if (c in dirConfig) {
            config[c] = dirConfig[c];
        }
    })
    console.log(config);
    writeFile(configPath, JSON.stringify(config, null, 4));

    // Recurse
    return dirPath.length ? createCollection(absDir, dirPath, dirConfigs) : true;
}

/**
 * Register a component
 *
 * @param {Object} component Component
 */
function registerComponent(component) {
    console.log(component);
    const componentName = slug(component.name, { lower: true });
    const componentLocalConfig = (component.local instanceof Array) ? component.local : [];
    while (componentLocalConfig.length < component.path.length) {
        componentLocalConfig.push([]);
    }
    const componentPath = component.path.slice(0).map(p => slug(p, { lower: true }));
    const componentRealPath = componentPath.map((p, i) => {
        return componentLocalConfig[i].dirsort ?
            `${(new String(componentLocalConfig[i].dirsort)).padStart(2, '0')}-${p}` : p;
    });
    const componentParent = path.join(app.components.get('path'), ...componentRealPath);
    const componentDirectory = path.join(componentParent, componentName);

    // Create the component directory
    if (!createCollection(app.components.get('path'), [...componentRealPath, componentName], componentLocalConfig)) {
        throw new Error(`Could not create component directory ${componentDirectory}`);
    }

    // Write out the template file
    const componentVariantName = componentName + (component.variant ? `--${slug(component.variant, { lower: true })}` : '');
    const componentTemplate = path.join(componentDirectory, `${componentVariantName}.${component.extension}`);
    writeFile(componentTemplate, component.template);

    // Write out the preview template
    if (component.preview) {
        writeFile(path.join(componentParent, `_${componentName}-preview.t3s`), component.preview);
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
        console.log(`${chalk.bold.red('X')} ${pathName.join('/')}`);
        return;
    }

    console.log(`${chalk.green('√')} ${pathName.join('/')}`);
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

    let typo3cli = path.join(typo3path, '../vendor/bin/typo3');
    let typo3args = ['extbase', 'component:discover'];
    try {
        if (fs.statSync(typo3cli).isFile()) {
            typo3args.shift();
        }
    } catch (e) {
        typo3cli = path.join(typo3path, 'typo3/cli_dispatch.phpsh');
    }

    try {
        if (fs.statSync(typo3cli).isFile()) {
            typo3args.unshift(typo3cli);
            const componentsJSON = execFileSync('php', typo3args).toString();
            const components = JSON.parse(componentsJSON);
            for (const component of components) {
                processComponent(component);
            }

            // Write the general shared context
            const context = { context: { typo3: typo3url } };
            writeFile(path.resolve(app.components.get('path'), 'components.config.json'), JSON.stringify(context, null, 4));

            // See if there's a component file manifest
            const manifest = path.resolve(app.components.get('path'), 'components.files.json');
            try {
                if (fs.statSync(manifest).isFile()) {
                    const currentFiles = new Set(files);
                    const prevFiles = new Set(JSON.parse(fs.readFileSync(manifest)));

                    // Delete all redundant files
                    [...prevFiles].filter(f => !currentFiles.has(f)).forEach(f => fs.unlinkSync(path.resolve(app.components.get('path'), f)));
                }
            } catch (e) {
                // Ignore errors
            } finally {
                writeFile(manifest, JSON.stringify(files));
                deleteEmpty.sync(app.components.get('path'));
            }
        }
        done();
    } catch (e) {
        console.log(e);
        done(e);
    }
};

/**
 * Encode an object as URI parameters
 *
 * @param {Object} params Parameter object
 * @param {String} prefix Parameter prefix
 * @return {Array} Encoded URI parameters
 */
const encodeURIParams = function encodeURIParams(params, prefix) {
    let parts = [];
    for (const name in params) {
        if (Object.prototype.hasOwnProperty.call(params, name)) {
            const paramName = prefix ? (`${prefix}[${encodeURIComponent(name)}]`) : encodeURIComponent(name);
            if (typeof params[name] === 'object') {
                parts = Array.prototype.concat.apply(parts,
                    encodeURIParams(params[name], paramName));
            } else {
                parts.push(`${paramName}=${encodeURIComponent(params[name])}`);
            }
        }
    }
    return parts;
};

/**
 * Create and return the graph URL for a particular component
 *
 * @param {Component} component Component
 */
const componentGraphUrl = function componentGraphUrl(component) {
    const context = ('variants' in component) ? component.variants().default().context : component.context;
    const graphUrl = url.parse(context.typo3);
    graphUrl.search = `?${encodeURIParams(Object.assign(context.request.arguments, {
        tx_twcomponentlibrary_component: { component: context.component },
        type: 2401,
    })).join('&')}`;
    return url.format(graphUrl);
};

/**
 * Configure the TYPO3 connection
 *
 * @param {String} t3path TYPO3 default path
 * @param {String} t3url TYPO3 base URL
 * @param {Theme} t3theme TYPO3 theme
 */
const configure = function configure(t3path, t3url, t3theme) {
    typo3path = t3path;
    typo3url = t3url;

    // If a Fractal theme is given
    if ((typeof t3theme === 'object') && (typeof t3theme.options === 'function')) {
        t3theme.addLoadPath(path.resolve(__dirname, 'lib', 'views'));

        // Add the graph panel
        const options = t3theme.options();
        if (options.panels.indexOf('graph') < 0) {
            options.panels.push('graph');
        }
        t3theme.options(options);
        t3theme.addListener('init', (engine) => {
            engine._engine.addFilter('componentGraphUrl', componentGraphUrl);
        });
    }
};

/**
 * TYPO3 template rendering engine
 */
class TYPO3Adapter extends Adapter {
    /**
     * Render a component
     *
     * @param {String} componentPath Component path
     * @param {String} str Template string
     * @param {Object} context Rendering context
     * @return {Promise} Rendering promise
     */
    render(componentPath, str, context) { // , meta
        if (context.component) {
            const views = {};
            this.views.forEach(view => (views[view.handle] = view.content));
            return this.engine.compile(str, context, views);
        }

        return this.engine.handlebars.render(null, str, context);
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
