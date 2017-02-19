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
        console.log('directives', res);
        this.setState({directives: res.value});
      });
  }

  render() {
    return (
      <div className="wrangler-auto-complete-container">

      </div>
    );
  }
}

WranglerAutoComplete.propTypes = {
  isOpen: PropTypes.bool,
  toggle: PropTypes.func
};

