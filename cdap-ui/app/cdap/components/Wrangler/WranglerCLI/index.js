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
import WranglerActions from 'components/Wrangler/store/WranglerActions';
import MyWranglerApi from 'api/wrangler';
import classnames from 'classnames';
require('./WranglerCLI.scss');

export default class WranglerCLI extends Component {
  constructor(props) {
    super(props);

    this.state = {
      directiveInput: '',
      error: null
    };

    this.handleDirectiveChange = this.handleDirectiveChange.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  handleDirectiveChange(e) {
    this.setState({directiveInput: e.target.value});
  }

  handleKeyDown(e) {
    if (e.keyCode !== 13) { return; }

    this.execute();
  }


  execute() {
    if (this.state.directiveInput.length === 0) { return; }

    let store = WranglerStore.getState().wrangler;
    let updatedDirectives = store.directives.concat([this.state.directiveInput]);

    let params = {
      namespace: 'default',
      workspaceId: 'test',
      limit: 100,
      directive: updatedDirectives
    };

    MyWranglerApi.execute(params)
      .subscribe((res) => {
        this.setState({
          error: null,
          directiveInput: ''
        });

        WranglerStore.dispatch({
          type: WranglerActions.setDirectives,
          payload: {
            data: res.value,
            headers: res.header,
            directives: updatedDirectives
          }
        });
      }, (err) => {
        this.setState({
          error: err.message || err.response.message
        });
      });

  }

  render() {
    return (
      <div className="wrangler-cli">
        <div
          className={classnames('power-mode', { 'error': this.state.error })}
        >
          {!this.state.error ? 'Power Mode' : this.state.error}
        </div>

        <div className="input-container">
          <strong>Directive: /&gt;</strong>
          <div className="directive-input">
            <input
              type="text"
              className="form-control"
              value={this.state.directiveInput}
              onChange={this.handleDirectiveChange}
              onKeyDown={this.handleKeyDown}
            />
          </div>

        </div>
      </div>
    );
  }
}
