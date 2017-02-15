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

import ch.qos.logback.classic.spi.ILoggingEvent;
import co.cask.cdap.logging.appender.kafka.LoggingEventSerializer;
import co.cask.cdap.logging.meta.Checkpoint;
import kafka.api.FetchRequest;
import kafka.api.FetchRequestBuilder;
import kafka.common.ErrorMapping;
import kafka.javaapi.FetchResponse;
import kafka.javaapi.consumer.SimpleConsumer;
import kafka.javaapi.message.ByteBufferMessageSet;
import kafka.message.MessageAndOffset;
import org.apache.kafka.common.KafkaException;
import org.apache.twill.kafka.client.BrokerInfo;
import org.apache.twill.kafka.client.BrokerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import javax.annotation.Nullable;

/**
 * Resolve matching Kafka offset with given checkpoint.
 */
class KafkaOffsetResolver {
  private static final Logger LOG = LoggerFactory.getLogger(KafkaOffsetResolver.class);

  // TODO: (CDAP-8439) determine the appropriate size
  private static final int FETCH_SIZE = 50 * 1024;        // The maximum size of a single message
  private static final int BUFFER_SIZE = 1000 * FETCH_SIZE;
  private static final int SO_TIMEOUT_MILLIS = 5 * 1000;           // 5 seconds.
  private final long replicationDelayMillis;
  private final long eventOutOfOrderMillis;

  private final BrokerService brokerService;
  private final String topic;
  private final LoggingEventSerializer serializer;

  KafkaOffsetResolver(BrokerService brokerService, KafkaPipelineConfig config) {
    this.brokerService = brokerService;
    this.topic = config.getTopic();
    this.eventOutOfOrderMillis = config.getEventOutOfOrderMillis();
    this.replicationDelayMillis = config.getReplicationDelayMillis();
    this.serializer = new LoggingEventSerializer();
  }

  /**
   * Check whether the message fetched with the offset {@code checkpoint.getNextOffset() - 1} contains the
   * same timestamp as in the given checkpoint. If they match, directly return {@code checkpoint.getNextOffset()}.
   * If they don't, search for the smallest offset of the message with the same log event time
   * as {@code checkpoint.getNextEventTime()}
   *
   * @param checkpoint A {@link Checkpoint} containing the next offset of a message and its log event timestamp.
   *                   {@link Checkpoint#getNextOffset()}, {@link Checkpoint#getNextEventTime()}
   *                   and {@link Checkpoint#getMaxEventTime()} all must return a non-negative long
   * @param partition the partition in the topic for searching matching offset
   * @return the next offset of the message with smallest offset and log event time equal to
   *         {@code checkpoint.getNextEventTime()}.
   *         {@code -1} if no such offset can be found or {@code checkpoint.getNextOffset()} is negative.
   */
   long getMatchingOffset(final Checkpoint checkpoint, final int partition) throws IOException {
     // No message should have next offset 0.
     if (checkpoint.getNextOffset() == 0) {
       return -1;
     }
    // Get BrokerInfo for constructing SimpleConsumer in OffsetFinderCallback
    BrokerInfo brokerInfo = brokerService.getLeader(topic, partition);
    if (brokerInfo == null) {
      throw new KafkaException(String.format("BrokerInfo from BrokerService is null for topic %s partition %d. " +
                                               "Will retry in next run.",
                               topic, partition));
    }
    SimpleConsumer consumer
      = new SimpleConsumer(brokerInfo.getHost(), brokerInfo.getPort(),
                           SO_TIMEOUT_MILLIS, BUFFER_SIZE, "simple-kafka-client");

    String clientId = topic + "_" + partition;
    // Check whether the message fetched with the offset in the given checkpoint has the timestamp from
    // checkpoint.getNextOffset() - 1 to get the offset corresponding to the timestamp in checkpoint
    long timeStamp = getEventTimeByOffset(consumer, partition, clientId, checkpoint.getNextOffset() - 1);
    if (timeStamp == checkpoint.getNextEventTime()) {
      LOG.debug("Checkpoint {} contains matching offset and timestamp. No need to search.", checkpoint);
      return checkpoint.getNextOffset();
    }

    long smallestMatchingOffset = findOffsetByTime(consumer, partition, clientId, checkpoint.getNextEventTime());
    if (smallestMatchingOffset >= 0) {
      // Increment smallestMatchingOffset to get the next offset if it's a valid non-negative offset
      smallestMatchingOffset++;
    }
    return smallestMatchingOffset;
  }

  /**
   * Determine the lower-bound and upper-bound of offsets to search for the smallest offset of the message
   * with log event time equal to {@code targetTime}, and then perform the search.
   *
   * @return the matching offset or {@code -1} if not found
   */
  private long findOffsetByTime(SimpleConsumer consumer, int partition, String clientName, long targetTime)
    throws IOException {
    // the offset of the earliest message
    long minOffset;
    try {
      minOffset = KafkaUtil.getOffsetByTimestamp(consumer, topic, partition, targetTime);
    } catch (IOException e) {
      LOG.debug("Failed to find the segment with latest message published later than target time {}. " +
                  "Find the offset with kafka.api.OffsetRequest.EarliestTime() instead.", targetTime, e);
      minOffset = KafkaUtil.getOffsetByTimestamp(consumer, topic, partition, kafka.api.OffsetRequest.EarliestTime());
    }
    // the next offset after the latest message
    long maxOffset = KafkaUtil.getOffsetByTimestamp(consumer, topic, partition, kafka.api.OffsetRequest.LatestTime());
    return linearSearchForOffset(consumer, partition, clientName, minOffset, maxOffset, targetTime,
                                 targetTime + replicationDelayMillis + eventOutOfOrderMillis);
  }

  /**
   * Performs a linear search to find the smallest offset of the message with log event time
   * equal to {@code targetTime}. Stop searching when the current message has log event time
   * later than {@code maxTime} or offset larger than {@code maxOffset}
   *
   * @return the matching offset or {@code -1} if not found
   */
  private long linearSearchForOffset(SimpleConsumer consumer, int partition, String clientName,
                                     long startOffset, long maxOffset, long targetTime, long maxTime)
    throws IOException {
    // search from startOffset and backward first
    long searchOffset = startOffset;
    while (searchOffset < maxOffset) {
      LOG.debug("Fetch request for searchOffset={}", searchOffset);
      ByteBufferMessageSet messageSet =
        getResponseMessageSet(consumer, partition, clientName, BUFFER_SIZE, searchOffset);
      if (messageSet == null) {
        return -1;
      }
      for (MessageAndOffset messageAndOffset : messageSet) {
        try {
          // TODO: [CDAP-8470] need a serializer for deserializing ILoggingEvent Kafka message to get time only
          ILoggingEvent event = serializer.fromBytes(messageAndOffset.message().payload());
          long time = event.getTimeStamp();
          if (time > maxTime) {
            LOG.debug("Failed to find the message with timestamp {} in topic {} partition {} after " +
                        "exceeding the max time limit {} with time {}", targetTime, topic, partition, maxTime, time);
            return -1;
          }
          if (time == targetTime) {
            LOG.debug("Matched offset {} for time {} found", messageAndOffset.offset(), time);
            return messageAndOffset.offset();
          }
          searchOffset = messageAndOffset.offset();
        } catch (IOException e) {
          LOG.warn("Message with offset {} in topic {} partition {} is ignored because of failure to decode.",
                   messageAndOffset.offset(), topic, partition, e);
        }
      }
      searchOffset++;
    }
    LOG.debug("Failed to find message with timestamp {} after searching until offset {}.", targetTime, searchOffset);
    return -1;
  }

  /**
   * Fetch a log event with {@code requestOffset} and deserialize it to get the log event time.
   *
   * @return the log event time of the message with {@code requestOffset} or {@code -1} if no message found.
   */
  private long getEventTimeByOffset(SimpleConsumer consumer, int partition, String clientName, long requestOffset) {
    ByteBufferMessageSet messageSet = getResponseMessageSet(consumer, partition, clientName, FETCH_SIZE, requestOffset);
    if (messageSet == null) {
      return -1;
    }
    for (MessageAndOffset messageAndOffset : messageSet) {
      long offset = messageAndOffset.offset();
      try {
        // TODO: [CDAP-8470] need a serializer for deserializing ILoggingEvent Kafka message to get time only
        ILoggingEvent event = serializer.fromBytes(messageAndOffset.message().payload());
        return event.getTimeStamp();
      } catch (IOException e) {
        LOG.warn("Message with offset {} in topic {} partition {} is ignored because of failure to decode.",
                 offset, topic, partition, e);
      }
    }
    return -1;
  }

  @Nullable
  private ByteBufferMessageSet getResponseMessageSet(SimpleConsumer consumer, int partition,
                                                String clientName, int fetchSize, long requestOffset) {
    FetchRequest req = new FetchRequestBuilder()
      .clientId(clientName).addFetch(topic, partition, requestOffset, fetchSize).build();
    FetchResponse fetchResponse = consumer.fetch(req);

    if (fetchResponse.hasError()) {
      // Something went wrong!
      short code = fetchResponse.errorCode(topic, partition);
      if (code == ErrorMapping.OffsetOutOfRangeCode()) {
        // We asked for an invalid offset. For simple case ask for the last element to reset
        LOG.debug("FetchRequest offset: {} out of range.", requestOffset);
        return null;
      }
      LOG.warn("Failed to fetch message for topic: {} partition: {} with error code {}.",
               topic, partition, code);
      return null;
    }
    return fetchResponse.messageSet(topic, partition);
  }
}
