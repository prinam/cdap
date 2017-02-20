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
import WranglerAutoComplete from 'components/Wrangler/AutoComplete';
require('./WranglerCLI.scss');

export default class WranglerCLI extends Component {
  constructor(props) {
    super(props);

    this.state = {
      directiveInput: '',
      error: null,
      autoCompleteOpen: false
    };

    this.handleDirectiveChange = this.handleDirectiveChange.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.toggleAutoComplete = this.toggleAutoComplete.bind(this);
    this.dismissError = this.dismissError.bind(this);
  }

  componentDidMount() {
    if (this.directiveRef) {
      this.directiveRef.focus();
    }
  }

  handleDirectiveChange(e) {
    this.setState({
      directiveInput: e.target.value,
      autoCompleteOpen: true
    });
  }

  handleKeyDown(e) {
    if (e.keyCode !== 13) { return; }

    let split = this.state.directiveInput.split(' ');
    if (split.length === 1 || split[1].length === 0) { return; }

    this.execute();
  }

  toggleAutoComplete() {
    this.setState({autoCompleteOpen: !this.state.autoCompleteOpen});
  }

  execute() {
    if (this.state.directiveInput.length === 0) { return; }

    let store = WranglerStore.getState().wrangler;
    let updatedDirectives = store.directives.concat([this.state.directiveInput]);

    let workspaceId = store.workspaceId;

    let params = {
      namespace: 'default',
      workspaceId: workspaceId,
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

  dismissError() {
    this.setState({error: null});
  }

  renderError() {
    if (!this.state.error) { return null; }

    return (
      <div className="error-bar">
        <span className="content">
          {this.state.error}
        </span>

        <span
          className="fa fa-times float-xs-right"
          onClick={this.dismissError}
        />
      </div>
    );
  }

  render() {
    return (
      <div className="wrangler-cli">

        {this.renderError()}

        <WranglerAutoComplete
          input={this.state.directiveInput}
          onRowClick={this.handleDirectiveChange}
          inputRef={this.directiveRef}
          toggle={this.toggleAutoComplete}
          isOpen={this.state.autoCompleteOpen}
          hasError={this.state.error}
        />

        <div className="input-container">
          <strong>$</strong>
          <div className="directive-input">
            <input
              type="text"
              className="form-control mousetrap"
              id="directive-input"
              value={this.state.directiveInput}
              onChange={this.handleDirectiveChange}
              onKeyDown={this.handleKeyDown}
              ref={(ref) => this.directiveRef = ref}
            />
          </div>
        </div>
      </div>
    );
  }
}
