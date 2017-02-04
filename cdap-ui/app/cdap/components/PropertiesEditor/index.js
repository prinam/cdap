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
import {MyMetadataApi} from 'api/metadata';
import NamespaceStore from 'services/NamespaceStore';
import map from 'lodash/map';
import shortid from 'shortid';
import AddPropertyModal from 'components/PropertiesEditor/AddPropertyModal';
import T from 'i18n-react';

require('./PropertiesEditor.scss');

const convertObjToArr = (obj) => {
  let properties = map(obj, (value, key) => ({key, value}))
    .map((row) => {
      row.id = shortid.generate();
      return row;
    });
  return properties;
};

export default class PropertiesEditor extends Component {
  constructor(props) {
    super(props);

    this.state = {
      systemProperties: [],
      userProperties: [],
      activeEdit: null,
      newValue: ''
    };

    this.fetchUserProperties = this.fetchUserProperties.bind(this);
    this.handleNewValueChange = this.handleNewValueChange.bind(this);
  }

  componentWillMount() {
    let namespace = NamespaceStore.getState().selectedNamespace;
    const baseRequestObject = {
      namespace,
      entityType: this.props.entityType,
      entityId: this.props.entityId
    };

    let systemParams = Object.assign({}, baseRequestObject, { scope: 'SYSTEM' });
    let userParams = Object.assign({}, baseRequestObject, { scope: 'USER' });

    MyMetadataApi.getProperties(systemParams)
      .map(convertObjToArr)
      .combineLatest(MyMetadataApi.getProperties(userParams).map(convertObjToArr))
      .subscribe((res) => {
        this.setState({
          systemProperties: res[0].filter((row) => row.key !== 'schema'),
          userProperties: res[1]
        });
      });
  }

  componentDidUpdate() {
    if (this.state.activeEdit && this.state.newValue.length === 0) {
      document.getElementById(this.state.activeEdit).focus();
    }
  }

  fetchUserProperties() {
    let namespace = NamespaceStore.getState().selectedNamespace;
    const params = {
      namespace,
      entityType: this.props.entityType,
      entityId: this.props.entityId,
      scope: 'USER'
    };

    MyMetadataApi.getProperties(params)
      .map(convertObjToArr)
      .subscribe((res) => {
        this.setState({
          userProperties: res,
          activeEdit: null,
          newValue: ''
        });
      });
  }

  deleteProperty(key) {
    let namespace = NamespaceStore.getState().selectedNamespace;
    const params = {
      namespace,
      key,
      entityType: this.props.entityType,
      entityId: this.props.entityId,
    };

    MyMetadataApi.deleteProperty(params)
      .subscribe(this.fetchUserProperties, (err) => {
        console.log('Error', err);
      });
  }

  saveProperty(row) {
    if (!this.state.newValue) { return; }
    let namespace = NamespaceStore.getState().selectedNamespace;
    const params = {
      namespace,
      entityType: this.props.entityType,
      entityId: this.props.entityId,
      scope: 'USER'
    };

    let requestBody = {};
    requestBody[row.key] = this.state.newValue;

    MyMetadataApi.addProperties(params, requestBody)
      .subscribe(() => {
        this.fetchUserProperties();
      }, (err) => {
        console.log('Error', err);
      });
  }

  handleNewValueChange(e) {
    this.setState({newValue: e.target.value});
  }

  renderSystemProperties() {
    return this.state.systemProperties.map((row) => {
      return (
        <tr key={row.id}>
          <td>{row.key}</td>
          <td>{row.value}</td>
          <td>{T.translate('features.PropertiesEditor.system')}</td>
          <td></td>
        </tr>
      );
    });
  }

  renderActions(row) {
    if (this.state.activeEdit === row.id) {
      return (
        <span>
          <span
            className="action-link"
            onClick={this.saveProperty.bind(this, row)}
          >
            {T.translate('features.PropertiesEditor.save')}
          </span>

          <span
            className="action-link"
            onClick={this.setEdit.bind(this, null)}
          >
            {T.translate('features.PropertiesEditor.cancel')}
          </span>
        </span>
      );
    }

    return (
      <span>
        <span
          className="fa fa-pencil"
          onClick={this.setEdit.bind(this, row.id)}
        />
        <span
          className="fa fa-trash"
          onClick={this.deleteProperty.bind(this, row.key)}
        />
      </span>
    );
  }

  renderUserProperties() {
    return this.state.userProperties.map((row) => {
      return (
        <tr key={row.id}>
          <td>{row.key}</td>
          <td className="value">
            {
              this.state.activeEdit !== row.id ?
                (<span>{row.value}</span>)
              :
                (
                  <input
                    type="text"
                    id={row.id}
                    className="form-control"
                    value={this.state.newValue}
                    onChange={this.handleNewValueChange}
                    placeholder={T.translate('features.PropertiesEditor.newValuePlaceholder')}
                  />
                )
            }
          </td>
          <td>{T.translate('features.PropertiesEditor.user')}</td>
          <td className="actions">
            {this.renderActions(row)}
          </td>
        </tr>
      );
    });
  }

  setEdit(id) {
    this.setState({
      activeEdit: id,
      newValue: ''
    });
  }

  render() {
    return (
      <div className="properties-editor-container">
        <table className="table">
          <thead>
            <tr>
              <th className="key">{T.translate('features.PropertiesEditor.name')}</th>
              <th className="value">{T.translate('features.PropertiesEditor.value')}</th>
              <th className="scope">{T.translate('features.PropertiesEditor.scope')}</th>
              <th className="actions"></th>
            </tr>
          </thead>

          <tbody>
            {this.renderUserProperties()}
            {this.renderSystemProperties()}
          </tbody>
        </table>

        <AddPropertyModal
          entityId={this.props.entityId}
          entityType={this.props.entityType}
          existingProperties={this.state.userProperties}
          onSave={this.fetchUserProperties}
        />

      </div>
    );
  }
}

PropertiesEditor.propTypes = {
  entityId: PropTypes.string,
  entityType: PropTypes.oneOf(['datasets', 'streams', 'apps'])
};
