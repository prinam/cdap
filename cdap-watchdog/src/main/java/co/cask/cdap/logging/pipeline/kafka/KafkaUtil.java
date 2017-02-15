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

package co.cask.cdap.logging.pipeline.kafka;

import com.google.common.collect.ImmutableMap;
import kafka.api.OffsetRequest$;
import kafka.api.PartitionOffsetRequestInfo;
import kafka.common.TopicAndPartition;
import kafka.javaapi.OffsetRequest;
import kafka.javaapi.OffsetResponse;
import kafka.javaapi.consumer.SimpleConsumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;

/**
 * Utility class for Kafka.
 */
public class KafkaUtil {
  private static final Logger LOG = LoggerFactory.getLogger(KafkaUtil.class);

  /**
   * Fetch the starting offset of the last segment whose latest message is published before the given timestamp.
   * The timestamp can also be special value {@link OffsetRequest$#EarliestTime()}
   * or {@link OffsetRequest$#LatestTime()}.
   *
   * @param consumer the consumer to send request to and receive response from
   * @param topic the topic for fetching the offset from
   * @param partition the partition for fetching the offset from
   * @param timestamp the timestamp to use for fetching last offset before it
   * @return the latest offset
   * @throws IOException if there is error in fetching the offset
   */
  public static long getOffsetByTimestamp(SimpleConsumer consumer, String topic, int partition, long timestamp)
    throws IOException {
    // Fire offset request
    OffsetRequest request = new OffsetRequest(ImmutableMap.of(
      new TopicAndPartition(topic, partition),
      new PartitionOffsetRequestInfo(timestamp, 1)
    ), kafka.api.OffsetRequest.CurrentVersion(), consumer.clientId());

    OffsetResponse response = consumer.getOffsetsBefore(request);

    // Retrieve offsets from response
    long[] offsets = response.hasError() ? null : response.offsets(topic, partition);
    if (offsets == null || offsets.length <= 0) {
      short errorCode = response.errorCode(topic, partition);
      throw new IOException(String.format("Failed to fetch offset for %s:%s with timestamp %d. Error: %d.",
                                          topic, partition, timestamp, errorCode));
    }

    LOG.debug("Offset {} fetched for {}:{} with timestamp {}.", offsets[0], topic, partition, timestamp);
    return offsets[0];
  }
}
