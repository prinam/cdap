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
import PublishPipelineWizard from 'components/CaskWizards/PublishPipeline';

import T from 'i18n-react';

export default class PublishPipelineUsecaseWizard extends Component {
  constructor(props) {
    super(props);

    this.buildSuccessInfo = this.buildSuccessInfo.bind(this);
  }

  buildSuccessInfo(name, namespace) {
    let successInfo = {};
    if (this.props.input.isLastStepInMarket) {
      let defaultSuccessMessage = T.translate('features.Wizard.PublishPipeline.success');
      let linkLabel = T.translate('features.Wizard.GoToHomePage');
      let buttonLabel = T.translate('features.Wizard.PublishPipeline.callToAction.view');
      let buttonUrl = `/pipelines/ns/${namespace}/view/${name}`;
      successInfo = {
        message: `${defaultSuccessMessage} "${name}".`,
        buttonLabel,
        buttonUrl,
        linkLabel,
        linkUrl: `/cdap/ns/${namespace}`
      };
    }
    return successInfo;
  }

  render() {
    return (
      <PublishPipelineWizard
        isOpen={this.props.isOpen}
        input={this.props.input}
        onClose={this.props.onClose}
        buildSuccessInfo={this.buildSuccessInfo}
      />
    );
  }
}

PublishPipelineUsecaseWizard.propTypes = {
  isOpen: PropTypes.bool,
  input: PropTypes.any,
  onClose: PropTypes.func,
};
