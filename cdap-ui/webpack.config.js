/*
 * Copyright © 2016 Cask Data, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

var cdapWebpackConfig = require('./webpack.config.cdap.js');
var loginWebpackConfig = require('./webpack.config.login.js');
var wranglerWebpackConfig = require('./webpack.config.wrangler.js');
var commonWebpackConfig = require('./webpack.config.common.js');

var multiConfigs = [];
// Forces dev to use `npm run cdap-dev-build-w` during development,
// This will prevent repeatedly building the common library shared between webapps
// Its bad because both common & cdap webpacks will trigger a build when common stuff changes.
if (process.env.NODE_ENV === 'development') {
  multiConfigs = [
    cdapWebpackConfig,
    loginWebpackConfig,
    wranglerWebpackConfig
  ];
} else {
  multiConfigs = [
    cdapWebpackConfig,
    loginWebpackConfig,
    wranglerWebpackConfig,
    commonWebpackConfig
  ];
}

module.exports = multiConfigs;
