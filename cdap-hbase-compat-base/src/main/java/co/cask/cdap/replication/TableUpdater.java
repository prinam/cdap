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

package co.cask.cdap.replication;

import co.cask.cdap.api.common.Bytes;
import org.apache.hadoop.conf.Configuration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Timer;
import java.util.TimerTask;
import java.util.UUID;

/**
 * Utility class for Replication Status Tool
 */
public abstract class TableUpdater {

  private class TimeValue {
    private long time;
    private boolean stale;

    private TimeValue(long time, boolean stale) {
      this.time = time;
      this.stale = stale;
    }
  }

  private static final Logger LOG = LoggerFactory.getLogger(TableUpdater.class);
  private HashMap<String, TimeValue> cachedUpdates;
  private final Object cachedUpdatesLock = new Object();
  private Timer updateTimer;

  public final UUID rsID;
  public final byte[] columnFamily;
  public final String rowType;
  public final Configuration conf;
  public boolean tableExists = false;



  public TableUpdater(String rowType, final Configuration conf) {
    this.columnFamily = Bytes.toBytes(ReplicationConstants.ReplicationStatusTool.TIME_FAMILY);
    this.rowType = rowType;
    this.rsID = UUID.randomUUID();
    this.conf = conf;

    String configuredDelay = conf.get(ReplicationConstants.ReplicationStatusTool.REPLICATION_DELAY);
    String configuredPeriod = conf.get(ReplicationConstants.ReplicationStatusTool.REPLICATION_PERIOD);
    long delay = (configuredDelay != null)
      ? new Long(configuredDelay)
      : ReplicationConstants.ReplicationStatusTool.REPLICATION_DELAY_DEFAULT;
    long period = (configuredPeriod != null)
      ? new Long(configuredPeriod)
      : ReplicationConstants.ReplicationStatusTool.REPLICATION_PERIOD_DEFAULT;

    cachedUpdates = new HashMap<>();
    LOG.info("DW Thread:" + Thread.currentThread().getId() + " starting ROW: " + rowType);
    setupTimer(delay, period);
  }

  /**
   * Synchronized method used by replication status tool TableUpdate class to add timestamps
   * from coprocessors.
   * @param regionName is the key for the Map
   * @param time is the value for the Map
   */
  public void updateTime(String regionName, long time) throws IOException {
    LOG.info("DW Thread:" + Thread.currentThread().getId() + " UPDATE REGION "
               + regionName + " ROW " + rowType + " BEGIN");
    synchronized (cachedUpdatesLock) {
      try {
        LOG.info("DW Thread:" + Thread.currentThread().getId() + " SLEEP START WITH LOCK");
        Thread.sleep(1000);
        LOG.info("DW Thread:" + Thread.currentThread().getId() + " SLEEP FINISH");
      } catch (InterruptedException e) {
        // catch this
        LOG.info("catch Interrupted");
      }

      if (!cachedUpdates.containsKey(regionName) || time > cachedUpdates.get(regionName).time) {
        LOG.info("DW Mark {} {} new.", regionName, time);
        cachedUpdates.put(regionName, new TimeValue(time, false));
      }
    }
    LOG.info("DW Thread:" + Thread.currentThread().getId() + " UPDATE REGION " + regionName
               + " ROW " + rowType + " END");
  }

  protected final byte[] getRowKey(String regionName) {
    ReplicationStatusKey replicationStatusKey = new ReplicationStatusKey(rowType, regionName, rsID);
    return replicationStatusKey.getKey();
  }

  public void setupTimer(long delay, long period) {
    updateTimer = new Timer("UpdateTimer");
    TimerTask updateTask = new TimerTask() {
      @Override
      public void run() {
        try {
          LOG.info("DW RUN NOW!");
          if (!tableExists) {
            createTableIfNotExists(conf);
            tableExists = true;
          }
          HashMap<String, Long> updatesToWrite;
          synchronized (cachedUpdatesLock) {
            // Make a copy so HBase write can happen outside of the synchronized block
            updatesToWrite = getNewEntries(cachedUpdates);
            // Remove stale updates
            markMapDirty(cachedUpdates);
          }
          if (!updatesToWrite.isEmpty()) {
            LOG.debug("Update Replication State table now. {} entries.", updatesToWrite.size());
            writeState(updatesToWrite);
          }
        } catch (IOException ioe) {
          LOG.error("Put to Replication State Table failed.", ioe);
        }
      }
    };
    updateTimer.scheduleAtFixedRate(updateTask, delay, period);
  }

  private void markMapDirty(HashMap<String, TimeValue> updateMap) {
    for (Map.Entry<String, TimeValue> entry : updateMap.entrySet()) {
      LOG.info("DW Marking Region {} stale.", entry.getKey());
      entry.getValue().stale = true;
    }
  }

  private HashMap<String, Long> getNewEntries(HashMap<String, TimeValue> updateMap) {
    HashMap<String, Long> cleanMap = new HashMap<>();
    for (Map.Entry<String, TimeValue> entry : updateMap.entrySet()) {
      if (!entry.getValue().stale) {
        cleanMap.put(entry.getKey(), entry.getValue().time);
      } else {
        LOG.info("DW Not picking up stale entry {} {}", entry.getKey(), entry.getValue().time);
      }
    }
    return cleanMap;
  }

  public void cancelTimer() throws IOException {
    LOG.info("Cancelling Update Timer now.");
    synchronized (cachedUpdatesLock) {
      writeState(getNewEntries(cachedUpdates));
    }
    updateTimer.cancel();
  }

  protected abstract void writeState(Map<String, Long> cachedUpdates) throws IOException;

  protected abstract void createTableIfNotExists(Configuration conf) throws IOException;
}
