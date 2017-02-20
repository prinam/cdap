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
import MyWranglerApi from 'api/wrangler';
import Fuse from 'fuse.js';
import shortid from 'shortid';
import reverse from 'lodash/reverse';

require('./AutoComplete.scss');

// const keyMap = {
//   enter: 13,
//   esc: 27,
//   arrowUp: 38,
//   arrowDown: 40
// };

export default class WranglerAutoComplete extends Component {
  constructor(props) {
    super(props);

    this.state = {
      directives: []
    };
  }

  componentWillMount() {
    MyWranglerApi.getUsage({
      namespace: 'default'
    })
      .subscribe((res) => {
        this.setState({directives: res.values});

        const fuseOptions = {
          include: ['matches', 'score'],
          caseSensitive: false,
          threshold: 0,
          shouldSort: true,
          location: 0,
          distance: 100,
          minMatchCharLength: 1,
          maxPatternLength: 32,
          keys: [
            "directive"
          ]
        };

        this.fuse = new Fuse(this.state.directives, fuseOptions);
      });
  }

  handleRowClick(row) {
    if (typeof this.props.onRowClick !== 'function') { return; }

    let eventObject = {
      target: { value: `${row.item.directive} `}
    };

    this.props.onRowClick(eventObject);
    this.props.inputRef.focus();
  }

  searchMatch() {
    let results = [];
    let input = this.props.input;
    let spaceIndex = input.indexOf(' ');
    if (spaceIndex !== -1) {
      input = input.slice(0, spaceIndex);
    }

    if (this.fuse && this.props.input.length > 0) {
      results = this.fuse.search(input)
        .slice(0, 3)
        .filter((row, index) => {
          if (spaceIndex === -1) {
            return true;
          }

          return row.score === 0 && index === 0;
        })
        .map((row) => {
          row.uniqueId = shortid.generate();
          return row;
        });

        reverse(results);
    }

    return {
      results,
      matched: spaceIndex !== -1
    };
  }

  render() {
    let {results, matched} = this.searchMatch();

    return (
      <div className="wrangler-auto-complete-container">
        {
          results.length === 0 ? null : (
            results.map((row) => {
              return (
                <div
                  className="result-row"
                  key={row.uniqueId}
                  onClick={this.handleRowClick.bind(this, row)}
                >
                  <div className="directive-title">
                    <strong>{row.item.directive}</strong>
                  </div>
                  <div className="directive-description">
                    {row.item.description}
                  </div>

                  { matched || results.length === 1  ?
                      (
                        <div className="directive-usage">
                          <span>Usage: </span>
                          <pre>{row.item.usage}</pre>
                        </div>
                      )
                    :
                      null
                  }
                </div>
              );
            })
          )
        }
      </div>
    );
  }
}

WranglerAutoComplete.propTypes = {
  isOpen: PropTypes.bool,
  toggle: PropTypes.func,
  input: PropTypes.string,
  onRowClick: PropTypes.func,
  inputRef: PropTypes.any,
};

