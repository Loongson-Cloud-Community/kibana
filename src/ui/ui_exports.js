import _ from 'lodash';
import minimatch from 'minimatch';

import UiAppCollection from './ui_app_collection';
import UiNavLinkCollection from './ui_nav_link_collection';

class UiExports {
  constructor({ urlBasePath }) {
    this.navLinks = new UiNavLinkCollection(this);
    this.apps = new UiAppCollection(this);
    this.aliases = {};
    this.urlBasePath = urlBasePath;
    this.exportConsumer = _.memoize(this.exportConsumer);
    this.consumers = [];
    this.bundleProviders = [];
  }

  consumePlugin(plugin) {
    plugin.apps = new UiAppCollection(this);

    var types = _.keys(plugin.uiExportsSpecs);
    if (!types) return false;

    var unkown = _.reject(types, this.exportConsumer, this);
    if (unkown.length) {
      throw new Error('unknown export types ' + unkown.join(', ') + ' in plugin ' + plugin.id);
    }

    for (let consumer of this.consumers) {
      consumer.consumePlugin && consumer.consumePlugin(plugin);
    }

    types.forEach((type) => {
      this.exportConsumer(type)(plugin, plugin.uiExportsSpecs[type]);
    });
  }

  addConsumer(consumer) {
    this.consumers.push(consumer);
  }

  exportConsumer(type) {
    for (let consumer of this.consumers) {
      if (!consumer.exportConsumer) continue;
      let fn = consumer.exportConsumer(type);
      if (fn) return fn;
    }

    switch (type) {
      case 'app':
      case 'apps':
        return (plugin, specs) => {
          const id = plugin.id;
          for (let spec of [].concat(specs || [])) {
            const app = this.apps.new({ id, ...spec });
            plugin.apps.add(app);
          }
        };

      case 'link':
      case 'links':
        return (plugin, spec) => {
          for (const spec of [].concat(spec || [])) {
            this.navLinks.new(spec);
          }
        };

      case 'visTypes':
      case 'fieldFormats':
      case 'spyModes':
      case 'chromeNavControls':
      case 'navbarExtensions':
      case 'settingsSections':
      case 'docViews':
      case 'sledgehammers':
        return (plugin, spec) => {
          this.aliases[type] = _.union(this.aliases[type] || [], spec);
        };

      case 'bundle':
        return (plugin, spec) => {
          this.bundleProviders.push(spec);
        };

      case 'aliases':
        return (plugin, specs) => {
          _.forOwn(specs, (spec, adhocType) => {
            this.aliases[adhocType] = _.union(this.aliases[adhocType] || [], spec);
          });
        };
    }
  }

  find(patterns) {
    var aliases = this.aliases;
    var names = _.keys(aliases);
    var matcher = _.partialRight(minimatch.filter, { matchBase: true });

    return _.chain(patterns)
    .map(function (pattern) {
      return names.filter(matcher(pattern));
    })
    .flattenDeep()
    .reduce(function (found, name) {
      return found.concat(aliases[name]);
    }, [])
    .value();
  }

  getAllApps() {
    let { apps } = this;
    return [...apps].concat(...apps.hidden);
  }

  getApp(id) {
    return this.apps.byId[id];
  }

  getHiddenApp(id) {
    return this.apps.hidden.byId[id];
  }

  getBundleProviders() {
    return this.bundleProviders;
  }
}

module.exports = UiExports;
