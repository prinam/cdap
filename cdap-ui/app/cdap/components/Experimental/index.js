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

import React, {Component} from 'react';

require('./Experimental.scss');

export default class Experimental extends Component {
  render() {
    let url = 'http://localhost:11011/tracker/ns/default/entity/streams/testStream1/usage?iframe=true';
    let encodedSource = encodeURIComponent(url);

    url += `&sourceUrl=${encodedSource}`;

    return (
      <div className="experimental-container text-xs-center">
        <h1> iframe </h1>

        <div className="iframe-container">
          <iframe
            src={url}
            width="80%"
            height="100%"
            frameBorder="0"
          >
          </iframe>
        </div>
      </div>
    );
  }
}
