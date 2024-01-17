const http = require('http');

// only available in MagicMirror context
const NodeHelper = require('node_helper');
const Log = require('logger');

const ONE_MINUTE_MS = 60 * 1000;
const TEN_MINUTES_MS = 10 * ONE_MINUTE_MS;
const ONE_DAY_MS = 1 * 24 * 60 * ONE_MINUTE_MS;

const Notifications = {
  CONFIG: 'CONFIG',
  DATA: 'DATA',
  ERROR: 'ERROR',
  PRINT: 'PRINT',
};

const Types = {
  MOVIE: 'movie',
  EPISODE: 'episode',
  SEASON: 'season',
};

const PlexTypes = {
  [Types.MOVIE]: '1',
  // [Types.TV]: '2',
};

const fetchData = (url) => {
  return new Promise((resolve, reject) => {
    http
      .get(
        url,
        {
          headers: {
            Accept: 'application/json',
          },
        },
        (res) => {
          let responseBody = '';

          res.on('data', (chunk) => {
            responseBody += chunk;
          });

          res.on('end', () => {
            const data = JSON.parse(responseBody);
            resolve(data);
          });
        },
      )
      .on('error', (err) => {
        reject(err);
      });
  });
};

module.exports = NodeHelper.create({
  config: {},

  updateTimer: null,

  // Override start method.
  start: function () {
    Log.log(`Starting node helper for: ${this.name}`);
  },

  async socketNotificationReceived(notification, payload) {
    Log.info(`${this.name}: socketNotificationReceived ${notification}`);
    if (notification === Notifications.CONFIG && !this.client) {
      this.config = payload;

      // validate types
      for (const type of payload.types) {
        if (!Object.values(Types).includes(type)) {
          Log.error(`${this.name}: Invalid type '${type}' found`);
        }
      }

      // Process fetch for the first time
      this.process();
    }
    if (notification === Notifications.PRINT && !this.client) {
      Log.info("MODULE DEBUG PRINT:")
      Log.info(payload)
    }
  },

  scheduleNextFetch(delayMs) {
    clearTimeout(this.updateTimer);

    this.updateTimer = setTimeout(() => {
      this.process();
    }, Math.max(delayMs, ONE_DAY_MS));
  },

  async process() {
    try {
      Log.info(`Starting processing.`);
      var notificationQueue = []
      for (const t of this.config.types) {
        var sectionIds = await this.fetchLibrarySectionIds(t);
        var videos = await this.fetchSectionVideos(sectionIds);
        notificationQueue.push(this.sendSocketNotification(Notifications.DATA, {
          type: t,
          items: videos,
        }))
      }
      await Promise.all(notificationQueue)
      Log.info(`Finished processing.`);
    } catch (error) {
      Log.info(`Error processing.`);
      Log.error(error);
      this.sendSocketNotification(Notifications.ERROR, {
        error: error.message,
      });
    }

    // schedule the next fetch
    this.scheduleNextFetch(this.config.updateIntervalInMinute * ONE_MINUTE_MS);
  },

  async fetchSectionVideos(sectionId) {
    const url = new URL(
      `http://${this.config.hostname}:${this.config.port}/library/sections/${sectionId}/all`,
    );
    if (this.config.token) {
      url.searchParams.append('X-Plex-Token', this.config.token);
    }
    Log.info(`${this.name}: fetching ${url}`);
    const data = await fetchData(url);
    const items = data.MediaContainer.Metadata
    return items
  },

  async fetchLibrarySectionIds(type) {
    const url = new URL(
      `http://${this.config.hostname}:${this.config.port}/library/sections`,
    );
    if (this.config.token) {
      url.searchParams.append('X-Plex-Token', this.config.token);
    }
    Log.info(`${this.name}: fetching ${url}`);
    const data = await fetchData(url);

    var libraryDirectory = data.MediaContainer.Directory
    var sections =  libraryDirectory.filter( (section) => {
      return section.type == type
    })
    var sectionIds = sections.map(function(value,index) { return value.key; })
    return sectionIds
  },
});
