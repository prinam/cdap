/*
 * Copyright © 2017 Cask Data, Inc.
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

import DataSourceConfigurer from 'services/datasource/DataSourceConfigurer';
import {apiCreator} from 'services/resource-helper';

let dataSrc = DataSourceConfigurer.getInstance();
const wranglerServicePath = '/namespaces/:namespace/apps/wrangler/services/service/methods';
const basepath = `${wranglerServicePath}/workspaces/:workspaceId`;

const MyWranglerApi = {
  create: apiCreator(dataSrc, 'PUT', 'REQUEST', basepath),
  delete: apiCreator(dataSrc, 'DELETE', 'REQUEST', basepath),
  upload: apiCreator(dataSrc, 'POST', 'REQUEST', `${basepath}/upload`),
  execute: apiCreator(dataSrc, 'GET', 'REQUEST', `${basepath}/execute`),
  summary: apiCreator(dataSrc, 'GET', 'REQUEST', `${basepath}/summary`),
  getSchema: apiCreator(dataSrc, 'GET', 'REQUEST', `${basepath}/schema`),
  getUsage: apiCreator(dataSrc, 'GET', 'REQUEST', `${wranglerServicePath}/usage`)
};

export default MyWranglerApi;
