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
import {Modal, ModalHeader, ModalBody, ModalFooter} from 'reactstrap';
import CardActionFeedback from 'components/CardActionFeedback';
import {MyMetadataApi} from 'api/metadata';
import NamespaceStore from 'services/NamespaceStore';

require('./AddPropertyModal.scss');

export default class AddPropertyModal extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isOpen: false,
      keyInput: '',
      valueInput: '',
      error: null
    };

    this.toggleModal = this.toggleModal.bind(this);
    this.handleKeyChange = this.handleKeyChange.bind(this);
    this.handleValueChange = this.handleValueChange.bind(this);
    this.onSave = this.onSave.bind(this);
  }

  toggleModal() {
    this.setState({
      isOpen: !this.state.isOpen,
      keyInput: '',
      valueInput: '',
      error: null
    });
  }

  handleKeyChange(e) {
    this.setState({keyInput: e.target.value});
  }
  handleValueChange(e) {
    this.setState({valueInput: e.target.value});
  }

  componentDidUpdate() {
    if (this.state.isOpen && this.state.keyInput.length === 0 && this.state.valueInput.length === 0) {
      document.getElementById('add-property-modal-key-input').focus();
    }
  }

  onSave() {
    let uniqueCheck = this.props.existingProperties.filter((row) => {
      return row.key === this.state.keyInput;
    });

    if (uniqueCheck.length > 0) {
      this.setState({
        error: `Property ${this.state.keyInput} already exists`
      });
      return;
    }

    let reqObj = {};
    reqObj[this.state.keyInput] = this.state.valueInput;

    let namespace = NamespaceStore.getState().selectedNamespace;
    let params = {
      namespace,
      entityType: this.props.entityType,
      entityId: this.props.entityId
    };

    MyMetadataApi.addProperties(params, reqObj)
      .subscribe(() => {
        this.toggleModal();
        this.props.onSave();
      }, (err) => {
        this.setState({
          error: err
        });
      });
  }

  renderFeedback() {
    if (!this.state.error) { return null; }

    return (
      <ModalFooter>
        <CardActionFeedback
          type='DANGER'
          message="Failed to add property"
          extendedMessage={this.state.error}
        />
      </ModalFooter>
    );
  }

  renderModal() {
    if (!this.state.isOpen) { return null; }

    let disabled = this.state.keyInput.length === 0 || this.state.valueInput.length === 0;

    return (
      <Modal
        isOpen={this.state.isOpen}
        toggle={this.toggleModal}
        size="lg"
        className="add-property-modal"
      >
        <ModalHeader>
          <span>
            Add Property for {this.props.entityType} {this.props.entityId}
          </span>

          <div
            className="close-section float-xs-right"
            onClick={this.toggleModal}
          >
            <span className="fa fa-times" />
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="row input-properties">
            <div className="col-xs-3">
              <input
                type="text"
                id="add-property-modal-key-input"
                className="form-control"
                placeholder="Enter name"
                value={this.state.keyInput}
                onChange={this.handleKeyChange}
              />
            </div>

            <div className="col-xs-9">
              <input
                type="text"
                className="form-control"
                placeholder="Enter value"
                value={this.state.valueInput}
                onChange={this.handleValueChange}
              />
            </div>
          </div>

          <div className="text-xs-right">
            <button
              className="btn btn-primary"
              onClick={this.onSave}
              disabled={disabled}
            >
              Add Property
            </button>
          </div>
        </ModalBody>

        {this.renderFeedback()}

      </Modal>
    );
  }

  render() {
    return (
      <div>
        <button
          className="btn btn-secondary"
          onClick={this.toggleModal}
        >
          Add Property
        </button>

        {this.renderModal()}

      </div>
    );
  }
}

AddPropertyModal.propTypes = {
  entityId: PropTypes.string,
  entityType: PropTypes.oneOf(['datasets', 'streams', 'apps']),
  existingProperties: PropTypes.array,
  onSave: PropTypes.func
};
