/*
 * Copyright © 2014-2017 Cask Data, Inc.
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

package co.cask.cdap.logging.write;

import co.cask.cdap.api.Transactional;
import co.cask.cdap.api.TxRunnable;
import co.cask.cdap.api.common.Bytes;
import co.cask.cdap.api.data.DatasetContext;
import co.cask.cdap.api.dataset.DatasetManagementException;
import co.cask.cdap.api.dataset.table.Row;
import co.cask.cdap.api.dataset.table.Scanner;
import co.cask.cdap.api.dataset.table.Table;
import co.cask.cdap.common.conf.CConfiguration;
import co.cask.cdap.common.logging.LoggingContext;
import co.cask.cdap.data.dataset.SystemDatasetInstantiator;
import co.cask.cdap.data2.dataset2.DatasetFramework;
import co.cask.cdap.data2.dataset2.MultiThreadDatasetCache;
import co.cask.cdap.data2.transaction.Transactions;
import co.cask.cdap.data2.transaction.TxCallable;
import co.cask.cdap.logging.context.GenericLoggingContext;
import co.cask.cdap.logging.context.LoggingContextHelper;
import co.cask.cdap.logging.meta.LoggingStoreTableUtil;
import co.cask.cdap.proto.id.NamespaceId;
import com.google.common.base.Objects;
import com.google.common.base.Preconditions;
import com.google.common.collect.ImmutableMap;
import com.google.inject.Inject;
import org.apache.tephra.RetryStrategies;
import org.apache.tephra.TransactionFailureException;
import org.apache.tephra.TransactionSystemClient;
import org.apache.twill.filesystem.Location;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import javax.annotation.Nullable;

/**
 * Handles reading/writing of file metadata.
 */
public class FileMetaDataManager {
  private static final Logger LOG = LoggerFactory.getLogger(FileMetaDataManager.class);

  private static final byte[] ROW_KEY_PREFIX = LoggingStoreTableUtil.OLD_FILE_META_ROW_KEY_PREFIX;
  private static final byte[] ROW_KEY_PREFIX_END = Bytes.stopKeyForPrefix(ROW_KEY_PREFIX);

  private final DatasetFramework datasetFramework;
  private final Transactional transactional;

  // Note: The FileMetaDataManager needs to have a RootLocationFactory because for custom mapped namespaces the
  // location mapped to a namespace are from root of the filesystem. The FileMetaDataManager stores a location in
  // bytes to a hbase table and to construct it back to a Location it needs to work with a root based location factory.
  @Inject
  FileMetaDataManager(CConfiguration cConf, DatasetFramework datasetFramework, TransactionSystemClient txClient) {
    this.datasetFramework = datasetFramework;
    this.transactional = Transactions.createTransactionalWithRetry(
      Transactions.createTransactional(new MultiThreadDatasetCache(
        new SystemDatasetInstantiator(datasetFramework), txClient,
        NamespaceId.SYSTEM, ImmutableMap.<String, String>of(), null, null)),
      RetryStrategies.retryOnConflict(20, 100)
    );
  }

  /**
   * Returns the {@link Table} for storing metadata.
   */
  private Table getMetaTable(DatasetContext context) throws IOException, DatasetManagementException {
    return LoggingStoreTableUtil.getMetadataTable(datasetFramework, context);
  }

  /**
   * Persists meta data associated with a log file.
   *
   * @param loggingContext logging context containing the meta data.
   * @param startTimeMs    start log time associated with the file.
   * @param location       log file.
   */
  public void writeMetaData(final LoggingContext loggingContext,
                            final long startTimeMs,
                            final Location location) throws Exception {
    writeMetaData(loggingContext.getLogPartition(), startTimeMs, location);
  }

  /**
   * Persists meta data associated with a log file.
   * @param logPartition partition name that is used to group log messages
   * @param startTimeMs  start log time associated with the file.
   * @param location     log file.
   */
  private void writeMetaData(final String logPartition,
                             final long startTimeMs,
                             final Location location) throws Exception {
    LOG.debug("Writing meta data for logging context {} as startTimeMs {} and location {}",
              logPartition, startTimeMs, location);

    transactional.execute(new TxRunnable() {
      @Override
      public void run(DatasetContext context) throws Exception {
        getMetaTable(context).put(getRowKey(logPartition),
                                  Bytes.toBytes(startTimeMs),
                                  Bytes.toBytes(location.toURI().getPath()));
      }
    });
  }

  /**
   * Scans meta data and gathers the metadata files in batches of configurable batch size
   *
   * @param tableKey           table key with start and stop key for row and column from where scan will be started
   * @param batchSize          batch size for number of columns to be read
   * @param metaEntryProcessor Collects metadata files
   * @return next start and stop key + start column for next iteration, returns null if end of table
   */
  @Nullable
  public TableKey scanFiles(@Nullable final TableKey tableKey,
                            final long batchSize, final MetaEntryProcessor metaEntryProcessor) {
    try {
      return Transactions.execute(transactional, new TxCallable<TableKey>() {
        @Override
        public TableKey call(DatasetContext context) throws Exception {
          Table table = getMetaTable(context);
          byte[] startKey = tableKey == null ? ROW_KEY_PREFIX : getRowKey(tableKey.getStartKey());
          byte[] startColumn = tableKey == null ? null : tableKey.getStartColumn();
          byte[] stopKey = getStopKey(tableKey);

          try (Scanner scanner = table.scan(startKey, stopKey)) {
            Row row;
            long colCount = 0;

            while ((row = scanner.next()) != null) {
              // Get the next logging context
              byte[] rowKey = row.getRow();
              byte[] stopCol = null;

              // Go through files for a logging context
              for (final Map.Entry<byte[], byte[]> entry : row.getColumns().entrySet()) {
                byte[] colName = entry.getKey();

                // while processing a row key, if start column is present, then it should be considered only for the
                // first time. Skip any column less/equal to start column
                if (startColumn != null && Bytes.compareTo(startColumn, colName) >= 0) {
                  continue;
                }

                // Stop if we exceeded the batchSize
                if (colCount >= batchSize) {
                  byte[] key = tableKey == null ? ROW_KEY_PREFIX_END : tableKey.getStopKey();
                  //  return current row key if we exceeded the batchSize
                  return new TableKey(getLogPartition(rowKey).getBytes(), key, stopCol);
                }

                stopCol = colName;
                colCount++;

                metaEntryProcessor.process(new ScannedEntryInfo(rowKey, colName, getNamespaceId(rowKey),
                                                                new URI(Bytes.toString(entry.getValue()))));
              }
              startColumn = null;
            }
          }
          return null;
        }
      });
    } catch (TransactionFailureException e) {
      throw new RuntimeException(Objects.firstNonNull(e.getCause(), e));
    }
  }

  private byte[] getStopKey(@Nullable TableKey tableKey) {
    byte[] stopKey;
    if (tableKey == null) {
      stopKey = ROW_KEY_PREFIX_END;
    } else if (Arrays.equals(tableKey.getStopKey(), ROW_KEY_PREFIX_END)) {
      stopKey = tableKey.getStopKey();
    } else {
      stopKey = getRowKey(tableKey.getStopKey());
    }
    return stopKey;
  }

  /**
   * Remove metadata for provided list of log files
   *
   * @param entriesToRemove List of {@link ScannedEntryInfo} of files to be removed to namespace
   * @return count of removed meta files
   */
  public long cleanMetadata(final List<ScannedEntryInfo> entriesToRemove) {
    try {
      return Transactions.execute(transactional, new TxCallable<Long>() {

        @Override
        public Long call(DatasetContext context) throws Exception {
          Table table = getMetaTable(context);
          long count = 0;

          for (ScannedEntryInfo entryInfo : entriesToRemove) {
            table.delete(entryInfo.getRowKey(), entryInfo.getColumn());
            count++;
          }

          LOG.debug("Total deleted metadata entries {}", count);
          return count;
        }
      });
    } catch (TransactionFailureException e) {
      throw new RuntimeException(Objects.firstNonNull(e.getCause(), e));
    }
  }

  /**
   * Class which holds table key (start and stop key + column) for log meta
   */
  public static final class TableKey {
    private final byte[] startKey;
    private final byte[] stopKey;
    @Nullable
    private final byte[] startColumn;

    public TableKey(byte[] startKey, byte[] stopKey, @Nullable byte[] startColumn) {
      this.startKey = startKey;
      this.stopKey = stopKey;
      this.startColumn = startColumn;
    }

    public byte[] getStartKey() {
      return startKey;
    }

    public byte[] getStopKey() {
      return stopKey;
    }

    @Nullable
    public byte[] getStartColumn() {
      return startColumn;
    }
  }

  /**
   * Class which holds information about scanned meta entries
   */

  public static final class ScannedEntryInfo {
    private final byte[] rowKey;
    private final byte[] column;
    private final NamespaceId namespace;
    private final URI uri;

    public ScannedEntryInfo(byte[] rowKey, byte[] column, NamespaceId namespace, URI uri) {
      this.rowKey = rowKey;
      this.column = column;
      this.namespace = namespace;
      this.uri = uri;
    }

    public byte[] getRowKey() {
      return rowKey;
    }

    public byte[] getColumn() {
      return column;
    }

    public NamespaceId getNamespace() {
      return namespace;
    }

    public URI getUri() {
      return uri;
    }
  }

  private String getLogPartition(byte[] rowKey) {
    int offset = ROW_KEY_PREFIX_END.length;
    int length = rowKey.length - offset;
    return Bytes.toString(rowKey, offset, length);
  }

  private NamespaceId getNamespaceId(byte[] rowKey) {
    String logPartition = getLogPartition(rowKey);
    Preconditions.checkArgument(logPartition != null, "Log partition cannot be null");
    String[] partitions = logPartition.split(":");
    Preconditions.checkArgument(partitions.length == 3,
                                "Expected log partition to be in the format <ns>:<entity>:<sub-entity>");
    // don't care about the app or the program, only need the namespace
    return LoggingContextHelper.getNamespaceId(new GenericLoggingContext(partitions[0], partitions[1], partitions[2]));
  }

  private byte[] getRowKey(String logPartition) {
    return Bytes.add(ROW_KEY_PREFIX, Bytes.toBytes(logPartition));
  }

  private byte[] getRowKey(byte[] logPartition) {
    return Bytes.add(ROW_KEY_PREFIX, logPartition);
  }

  /**
   * Meta entry processor
   *
   * @param <T> Type of the result of processing all the inputs
   */
  public interface MetaEntryProcessor<T> {
    void process(ScannedEntryInfo info);

    T getCollectedEntries();
  }
}
