/*
 * Copyright © 2016 Cask Data, Inc.
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
import React, {PropTypes, Component} from 'react';
import { Modal, ModalHeader, ModalBody } from 'reactstrap';
require('./CaskMarketPlace.less');

import TabConfig from './TabConfig';
import ConfigurableTab from '../ConfigurableTab';

export default class CaskMarketPlace extends Component{
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <Modal
        isOpen={this.props.isOpen}
        toggle={this.props.onCloseHandler}
        className="cask-market-place"
        size="lg"
      >
        <ModalHeader>
          <span className="pull-left">
            Cask Market Place
          </span>
          <div className="pull-right">
            <button className="btn btn-sm btn-resource-center">
              Resource Center
            </button>
          </div>
        </ModalHeader>
        <ModalBody>
          <ConfigurableTab tabConfig={TabConfig} />
        </ModalBody>
      </Modal>
    );
  }
}

CaskMarketPlace.propTypes = {
  onCloseHandler: PropTypes.func,
  isOpen: PropTypes.bool
};