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
import shortid from 'shortid';

require('./WranglerTable.scss');

export default class WranglerTable extends Component {
  constructor(props) {
    super(props);

    let storeState = WranglerStore.getState().wrangler;

    this.state = {
      headers: storeState.data,
      data: storeState.headers
    };

    this.sub = WranglerStore.subscribe(() => {
      let state = WranglerStore.getState().wrangler;

      this.setState({
        data: state.data,
        headers: state.headers
      });
    });
  }

  componentWillUnmount() {
    this.sub();
  }

  render() {
    let headers = this.state.headers;
    let data = this.state.data;

    if (data.length === 0) {
      return (
        <div className="wrangler-table empty">
          <h4 className="text-xs-center">No Data</h4>
          <h5 className="text-xs-center">Please create workspace and upload data</h5>
        </div>
      );
    }

    return (
      <div className="wrangler-table">
        <table className="table table-bordered table-striped">
          <thead className="thead-inverse">
            {
              headers.map((head) => {
                return <th key={head}>{head}</th>;
              })
            }
          </thead>
          <tbody>
            {
              data.map((row) => {
                return (
                  <tr key={shortid.generate()}>
                    {headers.map((head) => {
                      return <td key={shortid.generate()}><div>{row[head]}</div></td>;
                    })}
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>
    );
  }
}
