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
import shortid from 'shortid';
import classnames from 'classnames';
import MyWranglerApi from 'api/wrangler';

require('./WranglerSidePanel.scss');

export default class WranglerSidePanel extends Component {
  constructor(props) {
    super(props);

    let storeState = WranglerStore.getState().wrangler;

    this.state = {
      activeTab: 1,
      deleteHover: null,
      headers: storeState.headers.map((head) => {
        let obj = {
          name: head,
          uniqueId: shortid.generate()
        };
        return obj;
      }),
      directives: storeState.directives.map((directive) => {
        let obj = {
          name: directive,
          uniqueId: shortid.generate()
        };
        return obj;
      }),
      summary: {}
    };

    this.getSummary();

    WranglerStore.subscribe(() => {
      let state = WranglerStore.getState().wrangler;

      this.setState({
        headers: state.headers.map((head) => {
          let obj = {
            name: head,
            uniqueId: shortid.generate()
          };
          return obj;
        }),
        directives: state.directives.map((directive) => {
          let obj = {
            name: directive,
            uniqueId: shortid.generate()
          };
          return obj;
        })
      });

      this.getSummary();
    });
  }

  getSummary() {
    let state = WranglerStore.getState().wrangler;
    let params = {
      namespace: 'default',
      workspaceId: 'test',
      limit: 100,
      directive: state.directives
    };

    MyWranglerApi.summary(params)
      .subscribe((res) => {
        let nonNullMap = {};
        state.headers.forEach((head) => {
          nonNullMap[head] = res.value.statistics[head].general['non-null'];
        });
        this.setState({summary: nonNullMap});
      }, (err) => {
        console.log('error fetching summary', err);
      });
  }

  setActiveTab(tab) {
    this.setState({activeTab: tab});
  }

  deleteDirective(index) {
    let directives = WranglerStore.getState().wrangler.directives;

    let newDirectives = directives.slice(0, index);

    let params = {
      namespace: 'default',
      workspaceId: 'test',
      limit: 100,
      directive: newDirectives
    };

    MyWranglerApi.execute(params)
      .subscribe((res) => {
        this.setState({
          deleteHover: null
        });

        WranglerStore.dispatch({
          type: WranglerActions.setDirectives,
          payload: {
            data: res.value,
            headers: res.header,
            directives: newDirectives
          }
        });
      }, (err) => {
        // Should not ever come to this.. this is only if backend
        // fails somehow
        console.log('Error deleting directives', err);
      });
  }

  onMouseEnter(index) {
    this.setState({deleteHover: index});
  }
  onMouseLeave() {
    this.setState({deleteHover: null});
  }

  renderColumns() {
    if (this.state.headers.length === 0) {
      return (
        <h5 className="empty-message text-xs-center">
          No Columns
        </h5>
      );
    }

    return (
      <div className="tab-content">
        <table className="table">
          <thead>
            <th>#</th>
            <th>Name</th>
            <th>Quality</th>
          </thead>
          <tbody>
            {
              this.state.headers.map((head, index) => {
                return (
                  <tr key={head.uniqueId}>
                    <td>{index + 1}</td>
                    <td>{head.name}</td>
                    <td>{this.state.summary[head.name]}%</td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>
    );
  }

  renderDirectives() {
    if (this.state.directives.length === 0) {
      return (
        <h5 className="empty-message text-xs-center">
          No Directives
        </h5>
      );
    }

    return (
      <div className="tab-content">
        <table className="table">
          <thead>
            <th>#</th>
            <th>Directive</th>
            <th></th>
          </thead>

          <tbody>
            {
              this.state.directives.map((directive, index) => {
                return (
                  <tr
                    className={classnames({
                      'inactive': this.state.deleteHover !== null && index >= this.state.deleteHover
                    })}
                    key={directive.uniqueId}
                  >
                    <td>{index + 1}</td>
                    <td>{directive.name}</td>
                    <td>
                      <span
                        className="fa fa-times"
                        onClick={this.deleteDirective.bind(this, index)}
                        onMouseEnter={this.onMouseEnter.bind(this, index)}
                        onMouseLeave={this.onMouseLeave.bind(this)}
                      />
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>
    );
  }

  renderTabContent() {
    switch (this.state.activeTab) {
      case 1:
        return this.renderDirectives();
      case 2:
        return this.renderColumns();
      default:
        return null;
    }
  }

  render() {
    return (
      <div className="col-xs-3 wrangler-side-panel">
        <div className="tabs">
          <div className="tabs-headers">
            <div
              className={classnames('tab', { 'active': this.state.activeTab === 1 })}
              onClick={this.setActiveTab.bind(this, 1)}
            >
              Directives ({this.state.directives.length})
            </div>
            <div
              className={classnames('tab', { 'active': this.state.activeTab === 2 })}
              onClick={this.setActiveTab.bind(this, 2)}
            >
              Columns ({this.state.headers.length})
            </div>
          </div>

          {this.renderTabContent()}
        </div>
      </div>
    );
  }
}
