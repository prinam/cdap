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

import React, {Component, PropTypes} from 'react';
import FastActions from 'components/EntityCard/FastActions';
import shortid from 'shortid';
import {humanReadableDate} from 'services/helpers';
import T from 'i18n-react';
import isEmpty from 'lodash/isEmpty';
import orderBy from 'lodash/orderBy';
import moment from 'moment';
require('./ProgramTable.scss');

export default class ProgramTable extends Component {
  constructor(props) {
    super(props);
    this.state = {
      entities: [],
      sortByColumn: 'name',
      sortOrder: 'asc'
    };
  }

  componentWillMount() {
    let entities = this.props.programs.map(prog => {
      return Object.assign({}, prog, {
        applicationId: prog.app,
        programType: prog.type,
        type: 'program',
        id: prog.id,
        uniqueId: shortid.generate()
      });
    });
    this.setState({
      entities
    });
  }

  sortBy(column) {
    let entities = this.state.entities;
    let sortOrder = this.state.sortOrder;
    let sortByColumn = this.state.sortByColumn;
    if (sortByColumn === column) {
      if (sortOrder === 'asc') { // already sorting in this column, sort the other way
        sortOrder = 'desc';
      } else {
        sortOrder = 'asc';
      }
    } else { // a new sort, so start with ascending sort
      sortByColumn = column;
      sortOrder = 'asc';
    }
    // have to convert latestRun back from string to seconds from epoch
    if (sortByColumn === 'latestRun') {
      entities = orderBy(entities, [function(entity) { return moment(entity.latestRun).valueOf(); }], [sortOrder]);
    } else {
      entities = orderBy(entities, [sortByColumn], [sortOrder]);
    }
    this.setState({
      entities,
      sortOrder,
      sortByColumn
    });
  }

  renderSortableColumnHeader(column, columnLabel) {
    if (this.state.sortByColumn !== column) {
      return (
        <span onClick={this.sortBy.bind(this, column)}>
          {columnLabel}
        </span>
      );
    }
    return (
      <span onClick={this.sortBy.bind(this, column)}>
        <span className="text-underline">{columnLabel}</span>
        {
          this.state.sortOrder === 'asc' ?
            <i className="fa fa-caret-down fa-lg"></i>
          :
            <i className="fa fa-caret-up fa-lg"></i>
        }
      </span>
    );
  }

  render() {
    return (
      <div className="program-table">
        <table className="table table-bordered">
        <thead>
          <tr>
            <th>
              {this.renderSortableColumnHeader('name', T.translate('features.ViewSwitch.nameLabel'))}
            </th>
            <th>
              {this.renderSortableColumnHeader('programType', T.translate('features.ViewSwitch.typeLabel'))}
            </th>
            <th>
              {this.renderSortableColumnHeader('latestRun', T.translate('features.ViewSwitch.ProgramTable.lastStartedLabel'))}
            </th>
            <th>
              {this.renderSortableColumnHeader('status', T.translate('features.ViewSwitch.ProgramTable.statusLabel'))}
            </th>
            <th>{T.translate('features.ViewSwitch.actionsLabel')}</th>
          </tr>
        </thead>
        <tbody>
          {
            this.state.entities.map(program => {
              return (
                <tr key={program.name}>
                  <td>{program.name}</td>
                  <td>{program.programType}</td>
                  <td>{
                    !isEmpty(program.latestRun) ? humanReadableDate(program.latestRun.start) : 'n/a'
                  }</td>
                  <td>{program.status}</td>
                  <td>
                    <div className="fast-actions-container">
                      <FastActions
                        className="text-xs-left"
                        entity={program}
                      />
                    </div>
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
}
ProgramTable.propTypes = {
  programs: PropTypes.arrayOf(PropTypes.object)
};
