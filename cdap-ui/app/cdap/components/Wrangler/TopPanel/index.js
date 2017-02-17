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
import WorkspaceModal from 'components/Wrangler/TopPanel/WorkspaceModal';
require('./TopPanel.scss');

export default class WranglerTopPanel extends Component {
  constructor(props) {
    super(props);

    this.state = {
      workspaceId: 'test',
      workspaceModal: false
    };

    this.toggleWorkspaceModal = this.toggleWorkspaceModal.bind(this);
  }

  toggleWorkspaceModal() {
    // this.setState({workspaceModal: !this.state.workspaceModal});
  }

  renderWorkspaceModal() {
    if (!this.state.workspaceModal) { return null; }

    return <WorkspaceModal />;
  }

  render() {
    return (
      <div className="top-panel clearfix">
        <div className="workspace-mgmt float-xs-left">
          <strong>Workspace: </strong>

          <span
            onClick={this.toggleWorkspaceModal}
          >
            {this.state.workspaceId}
            {this.renderWorkspaceModal()}
          </span>
        </div>
      </div>
    );
  }
}
