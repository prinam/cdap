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
import { Modal, ModalHeader, ModalBody } from 'reactstrap';
import SchemaStore from 'components/SchemaEditor/SchemaStore';
import SchemaEditor from 'components/SchemaEditor';
import {getParsedSchema} from 'components/SchemaEditor/SchemaHelpers';
import MyWranglerApi from 'api/wrangler';
import WranglerStore from 'components/Wrangler/store';

export default class SchemaModal extends Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: true,
      error: null
    };
  }

  componentWillUnmount() {
    SchemaStore.dispatch({
      type: 'RESET'
    });
  }

  componentDidMount() {
    let state = WranglerStore.getState().wrangler;
    let workspaceId = state.workspaceId;

    let requestObj = {
      namespace: 'default',
      workspaceId
    };

    let directives = state.directives;

    if (directives) {
      requestObj.directive = directives;
    }

    MyWranglerApi.getSchema(requestObj)
      .subscribe((res) => {
        let tempSchema = {
          name: 'avroSchema',
          type: 'record',
          fields: res
        };

        let fields = getParsedSchema(tempSchema);
        SchemaStore.dispatch({
          type: 'FIELD_UPDATE',
          payload: {
            schema: { fields }
          }
        });

        this.setState({loading: false});
      }, (err) => {
        console.log('Error fetching Schema', err);

        this.setState({
          loading: false,
          error: err.message
        });
      });
  }

  render() {
    let content;

    if (this.state.loading) {
      content = (
        <div className="text-xs-center">
          <h4>
            <span className="fa fa-spin fa-spinner" />
          </h4>
        </div>
      );
    } else if (this.state.error) {
      content = (
        <div className="text-xs-center text-danger">
          {this.state.error}
        </div>
      );
    } else {
      content = (
        <fieldset disabled>
          <SchemaEditor />
        </fieldset>
      );
    }

    return (
      <Modal
        isOpen={true}
        toggle={this.props.toggle}
        zIndex="1070"
        className="wrangler-schema-modal"
      >
        <ModalHeader>
          <span>
            Schema
          </span>

          <div
            className="close-section float-xs-right"
            onClick={this.props.toggle}
          >
            <span className="fa fa-times" />
          </div>
        </ModalHeader>
        <ModalBody>
          {content}
        </ModalBody>
      </Modal>
    );
  }
}

SchemaModal.propTypes = {
  toggle: PropTypes.func
};

