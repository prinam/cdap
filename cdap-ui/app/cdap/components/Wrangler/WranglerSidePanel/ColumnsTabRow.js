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

import React, { Component, PropTypes } from 'react';
import classnames from 'classnames';

export default class ColumnsTabRow extends Component {
  constructor(props) {
    super(props);

    this.state = {
      expanded: false
    };

    this.toggleRowExpand = this.toggleRowExpand.bind(this);
  }

  toggleRowExpand() {
    this.setState({expanded: !this.state.expanded});
  }

  renderExpanded() {
    if (!this.state.expanded) { return null; }

    return (
      <div className="expanded-row">
        <pre>{JSON.stringify(this.props.rowInfo, null, 4)}</pre>
      </div>
    );
  }

  render() {
    return (
      <div className="columns-tab-row">
        <div
          className={classnames('row-header', {
            'expanded': this.state.expanded,
            'invalid': !this.props.rowInfo.isValid
          })}
          onClick={this.toggleRowExpand}
        >
          {this.props.index + 1}. {this.props.columnName}
        </div>

        {this.renderExpanded()}
      </div>
    );
  }
}

ColumnsTabRow.propTypes = {
  rowInfo: PropTypes.object,
  index: PropTypes.number,
  columnName: PropTypes.string
};
