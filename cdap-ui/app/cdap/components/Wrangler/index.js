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

import React, { Component } from 'react';
import WranglerTopPanel from 'components/Wrangler/TopPanel';
import WranglerTable from 'components/Wrangler/WranglerTable';
import WranglerSidePanel from 'components/Wrangler/WranglerSidePanel';
import WranglerCLI from 'components/Wrangler/WranglerCLI';
import MyWranglerApi from 'api/wrangler';

import WranglerStore from 'components/Wrangler/store';
import WranglerActions from 'components/Wrangler/store/WranglerActions';

require('./Wrangler.scss');

export default class Wrangler extends Component {
  constructor(props) {
    super(props);
  }

  componentWillMount() {
    let params = {
      namespace: 'default',
      workspaceId: 'test',
      limit: 100
    };

    MyWranglerApi.execute(params)
      .subscribe((res) => {
        WranglerStore.dispatch({
          type: WranglerActions.setData,
          payload: {
            data: res.value,
            headers: res.header
          }
        });
      }, (err) => {
        console.log('Init Error', err);
      });
  }

  render() {
    return (
      <div className="wrangler-container">
        <WranglerTopPanel />

        <div className="row wrangler-body">
          <WranglerTable />

          <WranglerSidePanel />
        </div>

        <WranglerCLI />

      </div>
    );
  }
}
