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
import WranglerStore from 'components/Wrangler/store';
import MyWranglerApi from 'api/wrangler';
import shortid from 'shortid';
import ColumnsTabRow from 'components/Wrangler/WranglerSidePanel/ColumnsTabRow';

export default class ColumnsTab extends Component {
  constructor(props) {
    super(props);

    this.state = {
      columns: {},
      headers: []
    };

    this.sub = WranglerStore.subscribe(this.getSummary.bind(this));

    this.getSummary();
  }

  componentWillUnmount() {
    this.sub();
  }

  getSummary() {
    let state = WranglerStore.getState().wrangler;
    if (!state.workspaceId) { return; }

    let params = {
      namespace: 'default',
      workspaceId: state.workspaceId,
      limit: 100,
      directive: state.directives
    };

    MyWranglerApi.summary(params)
      .subscribe((res) => {
        let columns = {};

        state.headers.forEach((head) => {
          columns[head] = {
            general: res.value.statistics[head].general,
            types: res.value.statistics[head].types,
            isValid: res.value.validation[head].valid
          };
        });

        this.setState({
          columns,
          headers: state.headers.map((res) => {
            let obj = {
              name: res,
              uniqueId: shortid.generate()
            };
            return obj;
          })
        });
      }, (err) => {
        console.log('error fetching summary', err);
      });
  }

  render() {
    return (
      <div className="columns-tab">
        {
          this.state.headers.map((head, index) => {
            return (
              <ColumnsTabRow
                rowInfo={this.state.columns[head.name]}
                columnName={head.name}
                index={index}
                key={head.uniqueId}
              />
            );
          })
        }
      </div>
    );
  }
}
