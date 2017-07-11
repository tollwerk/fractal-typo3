# fractal-typo3

> TYPO3 component library adapter for Fractal

About
-----

This Node.js module extends [Fractal](http://fractal.build/) and helps you build and document a web component library from within the Open Source CMS [TYPO3](https://typo3.org/). It is the counterpart to the [TYPO3 component library extension](https://github.com/tollwerk/TYPO3-ext-tw_componentlibrary).


Usage
-----

### Installation

To add *fractal-typo3* to your project, run

```bash
npm install --save fractal-typo3
```

in your project root directory. For things to work you will also want to enable the [TYPO3 component library extension](https://github.com/tollwerk/TYPO3-ext-tw_componentlibrary) in your TYPO3 instance.

### Configuration

Add the following settings to your [`fractal.js`](http://fractal.build/guide/project-settings) configuration in order to use TYPO3 as component source and rendering engine:

```js
const path = require('path');
const fractal = module.exports = require('@frctl/fractal').create();
const typo3 = require('fractal-typo3');

// Configure the absolute URL of your TYPO3 frontend
typo3.configure('web', 'http://example.com');

// Configure Fractal's component base directory
fractal.components.set('path', path.join(__dirname, 'fractal', 'components'));

// Set the directory for static assets to your TYPO3 root directory
fractal.web.set('static.path', path.join(__dirname, 'web'));

// Configure Fractal to use TYPO3 as template engine
fractal.components.engine(typo3.engine);
fractal.components.set('ext', '.t3s');

// Register the 'update-typo3' custom command
fractal.cli.command('update-typo3', typo3.update, {
    description: 'Update the components by extracting them from a TYPO3 instance (defaults to "web")'
});
```

Make sure that your server knows how to resolve the absolute URL to your TYPO3 frontend. You might need to add an entry to your [hosts](https://en.wikipedia.org/wiki/Hosts_(file)) file for this to work.

### Component extraction from TYPO3

To update your component library by extracting the component declarations from TYPO3, run

```bash
fractal update-typo3
```

You should see a list of components that were created:

```bash
√ Generic/Hero
√ Generic/Collapsible
√ Generic/Definition List
√ Generic/Menu/Button
√ Generic/Menu/Breadcrumb
√ Generic/Menu/Main
...
```

You might need to restart your Fractal server to update the Web UI. Every time you navigate to a component, TYPO3 will be called as template engine to render your component. The component output is **created ad hoc from your genuine TYPO3 code** — no cached intermediate files involved!

Contributing
------------

Found a bug or have a feature request? [Please have a look at the known issues](https://github.com/tollwerk/TYPO3-ext-tw_componentlibrary/issues) first and open a new issue if necessary. Please see [contributing](CONTRIBUTING.md) and [conduct](CONDUCT.md) for details.

Security
--------

If you discover any security related issues, please email joschi@kuphal.net instead of using the issue tracker.

Credits
-------

- [Joschi Kuphal][author-url]
- [All Contributors](../../contributors)

License
-------

Copyright © 2017 [Joschi Kuphal][author-url] / joschi@kuphal.net. Licensed under the terms of the [MIT license](LICENSE.txt).

[author-url]: https://jkphl.is
