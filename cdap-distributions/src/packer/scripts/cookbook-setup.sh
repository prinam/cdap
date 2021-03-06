#!/bin/bash
#
# Copyright © 2015-2017 Cask Data, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License. You may obtain a copy of
# the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
# WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
# License for the specific language governing permissions and limitations under
# the License.

#
# Download cookbooks from Chef Supermarket
#

die() { echo $*; exit 1; }

# Grab cookbooks using knife
for cb in cdap idea maven openssh; do
  knife cookbook site install $cb || die "Cannot fetch cookbook $cb"
done

### TODO: remove this hack when chef-cookbooks/ark#181 is solved
knife cookbook site install ark 2.1.0 || die "Cannot fetch ark cookbook 2.1.0"

# Due to limitations on the Chef version required, pull these manually
knife cookbook site install build-essential 7.0.3 || die "Cannot fetch build-essential 7.0.3"
knife cookbook site install yum 4.2.0 || die "Cannot fetch yum 4.2.0"
knife cookbook site install apt 5.1.0 || die "Cannot fetch apt 5.1.0"

# Do not change HOME for cdap user
sed -i '/ home /d' /var/chef/cookbooks/cdap/recipes/sdk.rb

exit 0
