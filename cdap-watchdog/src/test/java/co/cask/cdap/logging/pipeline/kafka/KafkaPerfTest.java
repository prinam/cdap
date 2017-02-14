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

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.LoggingEvent;
import co.cask.cdap.common.conf.CConfiguration;
import co.cask.cdap.common.conf.Constants;
import co.cask.cdap.common.conf.KafkaConstants;
import co.cask.cdap.common.guice.ConfigModule;
import co.cask.cdap.common.guice.KafkaClientModule;
import co.cask.cdap.common.guice.ZKClientModule;
import co.cask.cdap.common.logging.LoggingContext;
import co.cask.cdap.common.utils.Tasks;
import co.cask.cdap.logging.appender.kafka.LoggingEventSerializer;
import co.cask.cdap.logging.context.GenericLoggingContext;
import co.cask.cdap.proto.id.NamespaceId;
import com.google.common.base.Charsets;
import com.google.common.base.Function;
import com.google.common.base.Joiner;
import com.google.common.base.Preconditions;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.inject.Guice;
import com.google.inject.Injector;
import com.google.inject.Module;
import kafka.api.FetchRequest;
import kafka.api.FetchRequestBuilder;
import kafka.javaapi.FetchResponse;
import kafka.javaapi.consumer.SimpleConsumer;
import kafka.javaapi.message.ByteBufferMessageSet;
import kafka.message.MessageAndOffset;
import org.apache.twill.common.Cancellable;
import org.apache.twill.internal.kafka.EmbeddedKafkaServer;
import org.apache.twill.internal.utils.Networks;
import org.apache.twill.internal.zookeeper.InMemoryZKServer;
import org.apache.twill.kafka.client.BrokerInfo;
import org.apache.twill.kafka.client.BrokerService;
import org.apache.twill.kafka.client.Compression;
import org.apache.twill.kafka.client.FetchedMessage;
import org.apache.twill.kafka.client.KafkaClientService;
import org.apache.twill.kafka.client.KafkaConsumer;
import org.apache.twill.kafka.client.KafkaPublisher;
import org.apache.twill.zookeeper.ZKClientService;
import org.junit.Assert;
import org.junit.rules.TemporaryFolder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Properties;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public class KafkaPerfTest {
  private static final Logger LOG = LoggerFactory.getLogger(KafkaPerfTest.class);

  private static Injector injector;
  private static InMemoryZKServer zkServer;
  private static EmbeddedKafkaServer kafkaServer;
  private static ZKClientService zkClient;
  private static BrokerService brokerService;
  private static KafkaClientService kafkaClient;

  private static CConfiguration cConf;
  private static TemporaryFolder tmpFolder;

  private static final int PUBLISH_BATCH_SIZE = 1024;
  private static final int PUBLISH_TIMES = 1024 * 1024 / 1089;
  private static final int TOTAL_EVENTS_COUNT = PUBLISH_BATCH_SIZE * PUBLISH_TIMES;

  public static void main(String[] args) throws Exception {
    String topic = "kafkaPerfTest";
    init();
    String stackTrace = Joiner.on(", ").join(Thread.currentThread().getStackTrace());
    List<ILoggingEvent> events = new ArrayList<>();
    long timestamp = System.currentTimeMillis();
    while (events.size() < PUBLISH_BATCH_SIZE) {
      events.add(createLoggingEvent("test.logger", Level.INFO, stackTrace, timestamp));
    }

    for (int i = 0; i < PUBLISH_TIMES; i++) {
      publishLog(topic, events);
    }

    BrokerInfo brokerInfo = brokerService.getLeader(topic, 0);
    if (brokerInfo == null) {
      return;
    }

    SimpleConsumer consumer
      = new SimpleConsumer(brokerInfo.getHost(), brokerInfo.getPort(),
                           5000, 210000, "simple-kafka-client");
    int messageCount = 0;
    long nextOffset = 0;
    long now = System.currentTimeMillis();
    while (messageCount < TOTAL_EVENTS_COUNT) {
      FetchRequest req = new FetchRequestBuilder()
        .clientId("kafka-perf").addFetch(topic, 0, nextOffset, 200000).build();
      FetchResponse fetchResponse = consumer.fetch(req);
      if (fetchResponse.hasError()) {
        LOG.warn("Fetch response contains error.");
        Thread.sleep(50);
      }
      int batchSize = 0;
      ByteBufferMessageSet messageSet = fetchResponse.messageSet(topic, 0);
      for (MessageAndOffset messageAndOffset : messageSet) {
        nextOffset = messageAndOffset.offset();
        batchSize++;
      }
      messageCount += batchSize;
      LOG.debug("Total {} messages with average size in bytes: {}", batchSize, messageSet.sizeInBytes() / batchSize);
    }
    LOG.info("{} millis taken to iterate through {} messages", System.currentTimeMillis() - now, TOTAL_EVENTS_COUNT);

    brokerService.stopAndWait();
    kafkaClient.stopAndWait();
    zkClient.stopAndWait();
    kafkaServer.stopAndWait();
    zkServer.stopAndWait();
  }
  
  private static void init() throws Exception {
    int kafkaPort = Networks.getRandomPort();
    Preconditions.checkState(kafkaPort > 0, "Failed to get random port.");
    int zkServerPort = Networks.getRandomPort();
    Preconditions.checkState(zkServerPort > 0, "Failed to get random port.");
    tmpFolder = new TemporaryFolder();
    tmpFolder.create();
    zkServer = InMemoryZKServer.builder().setDataDir(tmpFolder.newFolder()).setPort(zkServerPort).build();
    zkServer.startAndWait();
    LOG.info("In memory ZK started on {}", zkServer.getConnectionStr());

    kafkaServer = new EmbeddedKafkaServer(generateKafkaConfig(kafkaPort));
    kafkaServer.startAndWait();
    initializeCConf(kafkaPort);
    injector = createInjector();
    zkClient = injector.getInstance(ZKClientService.class);
    zkClient.startAndWait();
    kafkaClient = injector.getInstance(KafkaClientService.class);
    kafkaClient.startAndWait();
    brokerService = injector.getInstance(BrokerService.class);
    brokerService.startAndWait();
    LOG.info("Waiting for Kafka server to startup...");
    waitForKafkaStartup();
    LOG.info("Started kafka server on port {}", kafkaPort);
  }

  private static void initializeCConf(int kafkaPort) throws IOException {
    cConf = CConfiguration.create();
    cConf.unset(KafkaConstants.ConfigKeys.ZOOKEEPER_NAMESPACE_CONFIG);
    cConf.set(Constants.CFG_LOCAL_DATA_DIR, tmpFolder.newFolder().getAbsolutePath());
    cConf.set(Constants.Zookeeper.QUORUM, zkServer.getConnectionStr());
  }

  private static Injector createInjector() throws IOException {
    List<Module> modules = ImmutableList.<Module>builder()
      .add(new ConfigModule(cConf))
      .add(new ZKClientModule())
      .add(new KafkaClientModule())
      .build();

    return Guice.createInjector(modules);
  }

  private static void waitForKafkaStartup() throws Exception {
    Tasks.waitFor(true, new Callable<Boolean>() {
      public Boolean call() throws Exception {
        final AtomicBoolean isKafkaStarted = new AtomicBoolean(false);
        try {
          KafkaPublisher kafkaPublisher = kafkaClient.getPublisher(KafkaPublisher.Ack.LEADER_RECEIVED,
                                                                   Compression.NONE);
          final String testTopic = "kafkatester.test.topic";
          final String testMessage = "Test Message";
          kafkaPublisher.prepare(testTopic).add(Charsets.UTF_8.encode(testMessage), 0).send().get();
          getPublishedMessages(testTopic, ImmutableSet.of(0), 1, 0, new Function<FetchedMessage, String>() {
            @Override
            public String apply(FetchedMessage input) {
              String fetchedMessage = Charsets.UTF_8.decode(input.getPayload()).toString();
              if (fetchedMessage.equalsIgnoreCase(testMessage)) {
                isKafkaStarted.set(true);
              }
              return "";
            }
          });
        } catch (Exception e) {
          // nothing to do as waiting for kafka startup
        }
        return isKafkaStarted.get();
      }
    }, 60, TimeUnit.SECONDS, 100, TimeUnit.MILLISECONDS);
  }

  /**
   * Return a list of messages from the specified Kafka topic.
   *
   * @param topic the specified Kafka topic
   * @param expectedNumMsgs the expected number of messages
   * @param offset the Kafka offset
   * @param converter converter function to convert payload bytebuffer into type T
   * @param <T> the type of each message
   * @return a list of messages from the specified Kafka topic
   */
  public static <T> List<T> getPublishedMessages(String topic, Set<Integer> partitions, int expectedNumMsgs, int offset,
                                          final Function<FetchedMessage, T> converter) throws InterruptedException {
    final CountDownLatch latch = new CountDownLatch(expectedNumMsgs);
    final CountDownLatch stopLatch = new CountDownLatch(1);
    final List<T> actual = new ArrayList<>(expectedNumMsgs);
    KafkaConsumer.Preparer preparer = kafkaClient.getConsumer().prepare();
    for (int partition : partitions) {
      preparer.add(topic, partition, offset);
    }
    Cancellable cancellable = preparer.consume(
      new KafkaConsumer.MessageCallback() {
        @Override
        public long onReceived(Iterator<FetchedMessage> messages) {
          long offset = 0L;
          while (messages.hasNext()) {
            FetchedMessage message = messages.next();
            actual.add(converter.apply(message));
            latch.countDown();
            offset = message.getNextOffset();
          }
          return offset;
        }

        @Override
        public void finished() {
          stopLatch.countDown();
        }
      }
    );
    Assert.assertTrue(String.format("Expected %d messages but found %d messages", expectedNumMsgs, actual.size()),
                      latch.await(15, TimeUnit.SECONDS));
    cancellable.cancel();
    Assert.assertTrue(stopLatch.await(15, TimeUnit.SECONDS));
    return actual;
  }

  private static Properties generateKafkaConfig(int port) throws IOException {
    Properties properties = new Properties();
    properties.setProperty("broker.id", "1");
    properties.setProperty("port", Integer.toString(port));
    properties.setProperty("num.network.threads", "2");
    properties.setProperty("num.io.threads", "2");
    properties.setProperty("socket.send.buffer.bytes", "1048576");
    properties.setProperty("socket.receive.buffer.bytes", "1048576");
    properties.setProperty("socket.request.max.bytes", "104857600");
    properties.setProperty("log.dir", tmpFolder.newFolder().getAbsolutePath());
    properties.setProperty("num.partitions", String.valueOf(1));
    properties.setProperty("log.flush.interval.messages", "10000");
    properties.setProperty("log.flush.interval.ms", "1000");
    properties.setProperty("log.retention.hours", "1");
    properties.setProperty("log.segment.bytes", "536870912");
    properties.setProperty("log.cleanup.interval.mins", "1");
    properties.setProperty("zookeeper.connect", zkServer.getConnectionStr());
    properties.setProperty("zookeeper.connection.timeout.ms", "1000000");
    return properties;
  }

  /**
   * Creates a new {@link ILoggingEvent} with the given information.
   */
  private static ILoggingEvent createLoggingEvent(String loggerName, Level level, String message, long timestamp) {
    LoggingEvent event = new LoggingEvent();
    event.setLevel(level);
    event.setLoggerName(loggerName);
    event.setMessage(message);
    event.setTimeStamp(timestamp);
    return event;
  }

  /**
   * Publishes multiple log events.
   */
  private static void publishLog(String topic, Iterable<ILoggingEvent> events) {
    publishLog(topic, events, new GenericLoggingContext(NamespaceId.DEFAULT.getNamespace(), "app", "entity"));
  }

  private static void publishLog(String topic, Iterable<ILoggingEvent> events, LoggingContext context) {
    KafkaPublisher.Preparer preparer = kafkaClient.getPublisher(KafkaPublisher.Ack.LEADER_RECEIVED, Compression.NONE)
      .prepare(topic);

    LoggingEventSerializer serializer = new LoggingEventSerializer();
    for (ILoggingEvent event : events) {
      byte[] payloadBytes = serializer.toBytes(event, context);
//      LOG.debug("Event size in bytes = {}", payloadBytes.length);
      preparer.add(ByteBuffer.wrap(payloadBytes), context.getLogPartition());
    }
    preparer.send();
  }
}
