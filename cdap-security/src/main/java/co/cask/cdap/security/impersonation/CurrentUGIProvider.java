/*
 * Copyright © 2016-2017 Cask Data, Inc.
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

package co.cask.cdap.security.impersonation;

import co.cask.cdap.common.kerberos.ImpersonationRequest;
import co.cask.cdap.common.kerberos.UGIWithPrincipal;
import co.cask.cdap.security.spi.authentication.AuthenticationContext;
import com.google.inject.Inject;
import org.apache.hadoop.security.UserGroupInformation;

import java.io.IOException;

/**
 * A UGIProvider that always returns the current user.
 */
public class CurrentUGIProvider implements UGIProvider {

  private final AuthenticationContext authenticationContext;

  @Inject
  public CurrentUGIProvider(AuthenticationContext authenticationContext) {
    this.authenticationContext = authenticationContext;
  }

  @Override
  public UGIWithPrincipal getConfiguredUGI(ImpersonationRequest impersonationRequest) throws IOException {
    return new UGIWithPrincipal(authenticationContext.getPrincipal().getKerberosPrincipal(),
                                UserGroupInformation.getCurrentUser());
  }
}
